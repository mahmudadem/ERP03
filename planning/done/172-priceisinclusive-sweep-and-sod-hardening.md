# Task 172 — `priceIsInclusive` math sweep + SoD structural hardening

**Status:** ✅ Complete (math + SoD); QA verification pending (Task 17)
**Date completed:** 2026-06-05
**Branch:** `feat/init-wizard-forms-selection`
**Time spent:** ~6h across two sessions
**Linked architecture doc:** [`docs/architecture/posting-authority.md`](../../docs/architecture/posting-authority.md) §4.1, §4.2 (new)
**Linked planning entries:** Tasks 168, 170A/B/C, 171, 19, 20

---

## Definition of Done — Checklist

- [x] Code merged (10 commits, see § Files Changed)
- [x] `docs/architecture/posting-authority.md` updated — new §4.2 "Enforcement layers" + §8 conformance row
- [ ] `docs/user-guide/<module>/<feature>.md` — N/A (no new user-facing feature; tax inclusive UI already existed)
- [x] This completion report links the architecture doc above
- [x] `planning/JOURNAL.md` appended
- [ ] `planning/ACTIVE.md` updated with next task — see § Next Recommended Step

---

## 1. Technical Developer View

### What Was Built

Two threads that started independently but converged into the same architectural insight:
*the principles in `posting-authority.md` were not structurally enforced anywhere*.

1. **Inclusive-tax math sweep (Tasks 168 + 170A/B/C)** — the `priceIsInclusive` flag was
   honoured by the SI domain entity (after Task 168) but silently ignored elsewhere: the SO,
   PI, SR, and PR entities did exclusive-only math; the PI form computed inclusive correctly
   for display but stripped the flag from the API payload; the SI posting code credited
   revenue with `grossLineTotalDoc` (gross-with-tax-embedded for inclusive lines) while
   debiting AR with the grand total, breaking voucher balance.
2. **SoD hardening (Tasks 19 + 20)** — the SoD rule "source modules never approve" was being
   leaked through UI paths (Settlement-on-Post button, postDraft's `approveSI`/`approvePI`
   branch). Patching individual leaks was whack-a-mole. Moved the approve methods out of
   `salesApi`/`purchasesApi` into `accountingApi` and added a build-time guard
   (`check-sod-approve.mjs`) so source-module code can neither type-check nor build if it
   tries to call approve.

### Files Changed

**Backend**
- `backend/src/domain/sales/entities/SalesOrder.ts` — `priceIsInclusive` on line, divisor split in `normalizeLine` (Task 170B)
- `backend/src/domain/sales/entities/SalesReturn.ts` — same shape; subtotal recompute splits gross/net (Task 170C)
- `backend/src/domain/purchases/entities/PurchaseInvoice.ts` — added flag + divisor split (Task 170A)
- `backend/src/domain/purchases/entities/PurchaseReturn.ts` — same shape (Task 170C)
- `backend/src/application/sales/use-cases/SalesOrderUseCases.ts` — input DTO + buildLine forwards the flag
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` — **posting bug fix**: revenue credit and discount debit now scaled by `1/(1+taxRate)` for inclusive lines so AR debit balances revenue credit + tax credit
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts` — map + post-recompute paths inherit flag from source SI line
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — input DTO + buildLine forwards flag + **defaults from tax code when input omits it** (safety net for any caller)
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts` — map + post-recompute paths inherit flag from source PI line

**Backend tests (new)**
- `backend/src/tests/domain/sales/SalesOrder.test.ts` — inclusive + exclusive regression
- `backend/src/tests/domain/sales/SalesReturn.test.ts` — same shape
- `backend/src/tests/domain/purchases/PurchaseInvoice.test.ts` — same shape
- `backend/src/tests/domain/purchases/PurchaseReturn.test.ts` — same shape
- Existing `backend/src/tests/domain/sales/SalesInvoice.test.ts` — Task 168 regression already in place

**Frontend**
- `frontend/src/api/accountingApi.ts` — gains `approveSI` and `approvePI` (moved here from source APIs)
- `frontend/src/api/salesApi.ts` — `approveSI` removed; SoD comment in its place
- `frontend/src/api/purchasesApi.ts` — `approvePI` removed; SoD comment in its place
- `frontend/src/api/purchasesApi.ts` — `PurchaseInvoiceLineInputDTO` gains `priceIsInclusive`
- `frontend/src/modules/accounting/pages/ApprovalsPage.tsx` — calls `accountingApi.approve*` (dropped sales/purchases imports)
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` — `postDraft` refuses to approve from Sales; settlement card gated on `status === 'DRAFT'`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx` — same shape; `EditableLine` + `buildLinePayload` carry `priceIsInclusive`; PI form math + display now honour it; **migrated to the new `ClassicLineItemsTable`** (Task 16)
- `frontend/src/components/shared/ClassicLineItemsTable.tsx` — new shared component (Task 15)
- `frontend/src/components/shared/formatMoney.ts` — earlier work this session, fixes SYP/JPY/KRW currency display rounding via explicit `minimumFractionDigits`

**Frontend tooling (new)**
- `frontend/scripts/check-sod-approve.mjs` — build-time SoD guard, wired into `npm run build`
- `frontend/package.json` — `check:sod-approve` script registered before `tsc + vite build`

**Docs**
- `docs/architecture/posting-authority.md` — new §4.2 "Enforcement layers", §8 conformance row added
- `planning/QA-NOW.md` — re-entry checklist for the QA pass (still pending — see Task 17)
- `planning/done/172-priceisinclusive-sweep-and-sod-hardening.md` — this report

### Architecture / Behavior

**Inclusive-tax math contract.** Every monetary entity that carries a tax rate now honours
`priceIsInclusive` consistently:

- `grossLineTotalDoc = qty × unitPrice` (always — this is what the user typed × qty)
- `lineTotalDoc` = NET (taxable base): `gross / (1 + taxRate)` if inclusive, else `gross`
- `taxAmountDoc` = `gross − lineTotalDoc` if inclusive, else `lineTotalDoc × taxRate`
- `subtotalDoc = Σ lineTotalDoc` (always NET)
- `grandTotalDoc = subtotalDoc + taxTotalDoc` (always equals `Σ grossLineTotalDoc` for an
  invoice with no document-level charges)

The flag flows: tax code carries a *default*; line input may override; entity preserves the
*effective* flag for downstream readers (return creation, posting, conversion). When the
input omits the flag, backend buildLine paths default from the tax code so legacy clients
(scripts, future SDKs, any UI that forgets to set it) still produce correct math.

**SoD enforcement layers.** See [`posting-authority.md` §4.2](../../docs/architecture/posting-authority.md) for the full table. Three layers:
1. Backend permission guard (was always there)
2. Frontend UI render gate (new this session — settlement card gated on `status === 'DRAFT'`,
   `postDraft` refuses to call approve)
3. Build-time SoD check + API surface move (new this session — `approveSI`/`approvePI` live
   only on `accountingApi`; build fails if they leak into source modules)

### Verification

- [x] `cd backend && npx tsc --noEmit` clean
- [x] `cd backend && npx jest src/tests/domain` — 247/247 (was 243; +4 new tests this sweep)
- [x] `cd frontend && npx tsc --noEmit` clean
- [x] `cd frontend && node scripts/check-sod-approve.mjs` — passes
- [x] `cd frontend && node scripts/check-sod-approve.mjs` — verified it *fires* by injecting
      a probe symbol into `SalesInvoicesListPage`, confirming exit code 1, reverting cleanly
- [x] Manual: SI created with `tax10 INC` produced balanced voucher (`Journal Entry #42c8...`):
      AR debit 10.00, revenue credit 9.09, VAT credit 0.91, diff 0.00
- [ ] Manual: PI flow end-to-end (Task 17 — user QA pending)

### Known Issues / Follow-ups

- **Task 17 — UI verification of PI inclusive math + Classic table look.** Posted to QA-NOW.
- **Task 18 — Backend regression test asserting create-and-post parks as PENDING_APPROVAL
  when approval is required.** Defence-in-depth on the backend path. Not blocking; on the
  task list.
- **SalesOrder promotion-discount branch.** When a promotion discount applies to an
  inclusive-priced SO line, the discount/tax recompute path (~`SalesOrderUseCases.ts:244`)
  still uses exclusive-only math. Filed in the Task 170B commit message; needs business
  clarification (discount on gross vs net for inclusive lines) before fixing.
- **PO doesn't carry `priceIsInclusive`.** PI derived from PO defaults to exclusive. Worth
  filing if inclusive PO pricing is needed.
- **Per-line `priceIsInclusive` override checkbox** only exists on SI form. SO/PI/SR/PR
  honour the tax code's default but don't expose a per-line toggle. Filed as item #6 in
  `planning/QA-NOW.md`.
- **Native SI, SO, SR, PR forms still use ad-hoc tables.** The new `ClassicLineItemsTable`
  exists; only PI migrated. Each migration is its own ~1h task.
- **GVR adoption** of `ClassicLineItemsTable` deferred until the component grows the
  column-resize + row-context-menu features GVR currently relies on.

---

## 2. End-User View

### What's New

Three product-visible changes from this session, plus invisible architectural improvements:

1. **Inclusive-tax invoices now produce balanced ledger entries.** When you enter a price
   with tax already embedded (e.g. SYP 1,500 inclusive of 10%), the system correctly splits
   it into a net 1,363.64 and tax 136.36 — across Sales Invoices, Sales Orders, Purchase
   Invoices, Sales Returns, and Purchase Returns. Previously the math was right on the
   Sales Invoice form alone; everywhere else silently used exclusive math even when the tax
   code said inclusive.
2. **Currency display fix.** Currencies like SYP, JPY, KRW (which Intl.NumberFormat defaults
   to 0 decimal places) now display two decimals so 1.50 doesn't appear as "SYP 2".
3. **New Line Items table on the Purchase Invoice form.** Matches the polished "Classic"
   look used on other invoice forms. Same shared component will roll out to other forms
   later.
4. **Sales and Purchases pages can no longer approve invoices.** This was always the
   *intent* (approval belongs to Accounting → Approval Center per SoD), but several UI
   paths still surfaced an Approve button. All paths are now closed; trying to add one
   back fails the build.

### How to Use It

For inclusive-tax invoices (any document type):

1. **Settings → Tax Codes:** edit your tax code, set rate to e.g. `0.1` for 10%, tick
   **"Price is tax-inclusive by default"**, save.
2. On any invoice form, pick that tax code on a line. The price you type is treated as
   already including tax.
3. The Grand Total will equal `qty × unitPrice` exactly — tax is embedded.

For approval workflow with Strict Mode on:

1. Create a Sales Invoice or Purchase Invoice in Sales/Purchases.
2. Click Post → it lands in **PENDING_APPROVAL** (yellow banner appears).
3. Go to **Accounting → Approval Center → Source Documents tab** to approve it.
4. The Sales/Purchases page itself will never show an Approve button.

### Where to Find It

- Tax code settings: **Settings → Tax Codes**
- Approval Center: **Accounting → Approval Center**
- Required permission for approving: `accounting.financialApproval.approve`

### Limitations

- A per-line "Price includes tax" checkbox only exists on the **Sales Invoice** form.
  Sales Orders, Purchase Invoices, Sales Returns, and Purchase Returns honour the tax
  code's default but don't yet offer a per-line override.
- The new Classic Line Items table is currently on the **Purchase Invoice** form only.
  Other forms still use their original layouts; they'll be migrated in subsequent sessions.
- The `priceIsInclusive` flag does not flow from Purchase Order → Purchase Invoice. If you
  later support inclusive POs, this needs a separate task.

---

## Next Recommended Step

1. **User completes Task 17 (QA verification in browser).** Use `planning/QA-NOW.md` as the
   checklist. ~15 minutes.
2. If QA passes, **Task 18 (backend regression test for create-and-post + approval-required
   parking)** as defence-in-depth. ~30 minutes.
3. **Migrate native SI, SO, SR, PR forms to `ClassicLineItemsTable`** one per session.
   Continues the consistency work without big-batch risk.

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
