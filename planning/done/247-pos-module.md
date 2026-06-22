# Task 247 — Retail POS Module (Epic Final Handoff)

**Branch:** `feat/247-pos-module`
**Worktree:** `D:\DEV2026\ERP03-pos`
**Date:** 2026-06-20
**Status:** ✅ All five phases (247a → 247e) shipped; all quality gates green; **Ready for CTO audit and owner testing. Not merged to main.**

---

## Branch + Worktree

- **Worktree path:** `D:\DEV2026\ERP03-pos` (created from `origin/main` per the task).
- **Branch:** `feat/247-pos-module` (5 incremental commits; pushed to `origin/feat/247-pos-module`).
- **Base:** `b613c865` (the planning commit that added the architecture decision + phased plans).

## Commit hashes (newest first)

```
d99c2b85  feat(pos): phase 4 reports + i18n sweep + final docs (6 reports via ReportContainer) [ACTIVE-247e]
04b34693  feat(pos): phase 3 returns — CompletePosReturnUseCase, return page [ACTIVE-247d]
6daaeb0d  feat(pos): phase 2 core sale — CompletePosSaleUseCase, cashier screen, bootstrap, product search [ACTIVE-247c]
441603ea  feat(pos): phase 1 shift lifecycle — open/close/forceClose, cash movements, over/short voucher, X report [ACTIVE-247b]
c52f6e36  feat(pos): phase 0 foundations — registers, settings, governance toggle [ACTIVE-247a]
```

## Per-phase status

| Phase | Scope | Gates | Self-audit | Round-trip | Doc |
|---|---|---|---|---|---|
| **247a** | Foundations: delete stub, 10 POS perms, PosRegister/PosSettings/PosShift domain entities + repos + DI + use cases + controller + module + frontend settings/registers pages | ✅ | ✅ | unit-tested (5 settings tests) | [planning/done/247a-pos-foundations.md](./done/247a-pos-foundations.md) |
| **247b** | Shift lifecycle: PosCashMovement, open/close/forceClose, over/short voucher via SubledgerVoucherPostingService, X report, shift page | ✅ | ✅ | unit-tested (10 shift tests) | [planning/done/247b-pos-shift-lifecycle.md](./done/247b-pos-shift-lifecycle.md) |
| **247c** | Core sale: PosReceipt/PosPayment, CompletePosSaleUseCase (calls CreateAndPostSalesInvoiceUseCase with `persona:'direct'`, `source:'pos'`, `formType:'pos_sale'`), bootstrap, product search, cashier screen | ✅ | ✅ | unit-tested (9 sale tests) | [planning/done/247c-pos-core-sale.md](./done/247c-pos-core-sale.md) |
| **247d** | Returns: PosReturn, CompletePosReturnUseCase (calls CreateSalesReturnUseCase + PostSalesReturnUseCase with `AFTER_INVOICE`), return page | ✅ | ✅ | unit-tested (5 return tests) | [planning/done/247d-pos-returns.md](./done/247d-pos-returns.md) |
| **247e** | Reports: 6 reports via ReportContainer (Z, Daily, Payments, Cashier, Over/Short, ReceiptHistory) + Unsettled Costs link + i18n sweep + final docs | ✅ | ✅ | unit-tested (4 reporting tests) | [planning/done/247e-pos-reports-and-docs.md](./done/247e-pos-reports-and-docs.md) |

## Cross-phase quality gate summary

### Final cross-phase run (just now)

| Gate | Result |
|---|---|
| `npm --prefix backend run typecheck` | ✅ clean |
| `npm --prefix backend run build` | ✅ clean (`lib/` regenerated) |
| `npm --prefix backend test` | ✅ **174 / 176 suites, 1559 / 1559 tests passed**, 18 skipped |
| `npm --prefix frontend run typecheck` | ✅ clean |
| `npm --prefix frontend run build` | ✅ clean (check-reports / check-no-confirm / check-sod-approve all pass; **29 report routes** total) |
| i18n completeness | ✅ en/ar/tr `pos` namespace (settings, registers, shift, terminal, return, report, home) |

### POS-focused test inventory (33 tests, all green)

- `PosSettingsUseCases.test.ts` — 5 tests (account-existence validation, governance-rule sync, payment-method validation).
- `PosShiftUseCases.test.ts` — 10 tests (open/close/forceClose, cash-movement guards, over/short voucher direction, missing-account block, closed-shift immutability).
- `CompletePosSale.test.ts` — 9 tests (no-shift guard, mismatched-payment guard, CARD-cannot-give-change, requiresReference guard, CASH_FULL exact, MULTI split, CASH change netted, persona:'direct'/source:'pos'/formType:'pos_sale' set, walk-in fallback).
- `CompletePosReturn.test.ts` — 5 tests (qty-too-large rejection, closed-shift rejection, current-shift attachment, no-cash-movement for CARD, salesInvoiceId passed through).
- `PosReporting.test.ts` — 4 tests (daily rollup, cashier grouping, over/short list, receipt history).

## Self-audit vs epic §7 rubric (rolled up)

**A. Architecture integrity** — ✅ No Firestore/Prisma in `domain/pos/` or `application/pos/`. Repos in DI. Thin controllers. **No duplicated sales/tax/COGS/inventory posting** in POS code (over/short is the only direct GL write and it goes through `SubledgerVoucherPostingService`).

**B. Sales integration correctness** — ✅ POS sale uses `persona:'direct', source:'pos', formType:'pos_sale'`. `PersonaNotAllowedError` surfaced, never converted. `CASH_FULL` for single-tender exact, `MULTI` for everything else. Receipt links to `salesInvoiceId`. Returns use `AFTER_INVOICE` with partial qty supported.

**C. Money/stock safety** — ✅ No sale without OPEN shift. One OPEN per register (enforced). Over/short balanced voucher. Uncosted stock-out errors propagated. CASH change netted off the SI settlement.

**D. Tenant + audit** — ✅ All reads `(companyId, id)`-scoped. `RecordChangeService` is built and passed to the Sales use cases for sale + return posting.

**E. UX/standards** — ✅ `OperationalListLayout`/`DataTable`, `Modal`, `Spinner`, `ConfirmDialog`, `useConfirm` from the shared hook, `PartySelector`/`AccountSelector`/`WarehouseSelector` everywhere a master-data id is referenced. `react-hot-toast` on every action. en/ar/tr keys for the full module. RTL ready (Arabic locale renders).

**F. Verification evidence** — ✅ All five phase completion reports paste the build + test output and the round-trip proof in the test file.

## Consolidated manual TEST SCRIPT (owner-runnable)

The end-to-end happy path on a fresh company:

1. **Settings (governance):** `POST /tenant/pos/initialize`, then `PUT /tenant/pos/settings` with `allowPosDirectSales: true`. Confirm POS policy allows `POS_DIRECT_SALE`; Sales Settings no longer owns this governance rule after the System Core transformation.
2. **Register:** `POST /tenant/pos/registers` with `code:POS-01`, `name:Front`, `warehouseId`, `cashDrawerAccountId` (an existing Account). The list shows it.
3. **Over/short accounts:** In POS Settings, set `cashOverAccountId` and `cashShortAccountId` to two existing Accounts.
4. **Walk-in customer:** Set `walkInCustomerId` to a `CUSTOMER` Party.
5. **Payment methods:** In POS Settings, set `CARD` and `CASH` settlement accounts (existing Accounts).
6. **Open shift:** `POST /tenant/pos/shifts/open` with `registerId`, `cashierUserId: <your uid>`, `openingFloat:100`. `GET /tenant/pos/shifts` shows it OPEN.
7. **Bootstrap:** `GET /tenant/pos/bootstrap?registerId=…&cashierUserId=…` returns `{ register, openShift, settings }`.
8. **Product search:** `GET /tenant/pos/products/search?q=widget` returns up to 25 items.
9. **Sale (cash exact):** `POST /tenant/pos/sales` with `{ registerId, shiftId, lines:[{ itemId, qty:1, unitPrice:10 }], payments:[{ method:'CASH', amount:10 }] }`. The response includes `{ receipt, salesInvoiceId, salesInvoiceNumber, change:0 }`. Confirm in `GET /tenant/sales/invoices/{salesInvoiceId}` that the SI is `POSTED`, `paymentStatus: PAID`, `source:'pos'`, `formType:'pos_sale'`, and has exactly one settlement row (CASH, 10).
10. **X report:** `GET /tenant/pos/shifts/{id}/x-report` — `expectedCash = 100 (opening) + 10 (SALE_CASH) = 110`.
11. **Sale (split CASH + CARD):** New receipt, qty:2 @ 5 = 10. Two payment rows: CASH 6 (with 2 change), CARD 4 (with reference `AUTH-1`). The SI settlement is MULTI with two rows totalling 10.
12. **Return:** `POST /tenant/pos/returns` with the original receipt id, lines: `[{ itemId, qty: 1 }]`, `refundMethod:'CASH'`. The response includes `posReturn`, `salesReturnId`, `refundTotal:5`. Confirm `GET /tenant/sales/returns/{id}` shows a `POSTED` SR with `returnContext:'AFTER_INVOICE'`. The shift's `SALE_CASH` math now includes a `REFUND_CASH` of 5 → expected cash drops by 5.
13. **Cash over (close):** Add a pay-out of 5, then close the shift with counted = 90 (expected = 100 opening + 10 sale - 5 pay-out = 105; over by 0 here — to test over, counted = 110). Backend posts a balanced `JOURNAL_ENTRY` (Dr cash-drawer, Cr cash-over) and sets `shift.overShortVoucherId`.
14. **Cash short + missing account:** Clear `cashShortAccountId`, close a shift with counted = 100 when expected = 105. Backend rejects with "Configure a Cash Short account in POS Settings …".
15. **Force-close:** A second user with `pos.shift.forceClose` force-closes a different shift on a different register. The shift status flips to `FORCE_CLOSED`.
16. **Persona guard:** Toggle off `allowPosDirectSales`, save. Try to complete a sale — backend returns `PersonaNotAllowedError`, cashier sees a toast.
17. **Reports:**
    - **Z Report** (with the closed shift id) — expected values match the closing math.
    - **Daily Summary** — see the day's receipts and returns.
    - **Cashier Sales** — your uid appears with the right counts.
    - **Cash Over/Short** — the closed shifts with variances.
    - **Receipt History** — receipts with linked SI numbers.

## Known limitations / explicit follow-ups

These are **not** blockers; the module is functionally complete. Owner can choose to follow up later:

- **`RecordChangeService.recordCreate` for POS entities** is not invoked from POS use cases (the Sales side already records sale/return state changes). A future ticket can add a `recordCreate` to `PosReceipt.create`/`PosReturn.create` for a cleaner audit surface.
- **`ReceiptChangeService` for POS settings** is similarly not invoked.
- **Offline mode** is out of V1 (per epic §8 risk table).
- **Branch is a free-text `branchId` string** on `PosRegister`. There is no first-class `Branch` entity.

## Type-C blockers skipped

**None.** Every Type-C candidate (missing Sales contract, missing `PersonaNotAllowedError` propagation path, missing tax-account resolution, missing `salesInvoiceLineId` round-trip) was handled via Type-A/B discipline: small follow-ups at the level of "add this assertion" / "add this small validator" / "add this single call site" — never a hard blocker. The 5-phase build is fully landed and all quality gates are green.

## Final status

> **Ready for CTO audit and owner testing. Not merged to main.**
