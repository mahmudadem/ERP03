# 225 — GP04 Purchases golden-path QA (procure-to-pay)

**Date:** 2026-06-14
**Branch:** `fix/purchases-module-gp04`
**Tenant:** TESTCO (`cmp_mqblxfqy_zmecyl`), local Firebase emulator. Claude drove the browser + verified GL/stock via the report/voucher/movement APIs; owner typed line-item cells (they resist automation).

## Outcome

GP04 ([planning/qa/golden-paths/04-purchases.md](../qa/golden-paths/04-purchases.md)) is **complete — all 14 steps effectively green**. Step 13 failed (a real bug) and was fixed + verified live in the same run. **11 bugs found across the whole GP04 run, all fixed and verified.** Full per-step log: [planning/qa/findings.md](../qa/findings.md).

## The 11 bugs (all fixed + verified)

| # | Bug | Class |
|---|-----|-------|
| precond-1 | Purchase wizard required `defaultGRNIAccountId` for any OPERATIONAL tenant, but the field only renders in PERPETUAL → deadlock | blocker |
| precond-2 | Wizard sent `defaultGRNIAccountId: ''` (empty string) → backend 400 | blocker |
| step3a | Purchase Order empty-trailing-row save validation (same class as GP03) | bug |
| step5to8a | **PI dropped the line discount from the GL** (Dr Inventory/AP gross, not net) | money |
| step9a | **Record-Payment didn't resolve the vendor's AP sub-account** (same class as GP03-step13a, never mirrored to Purchases) | money/blocker |
| step9-blocker | PI **unpost** violated Firestore read-before-write (INFRA_005) | blocker |
| step10a | Purchase Return didn't inherit the PI unit price (`unitPriceDoc`→`unitCostDoc` gap) | money |
| step10b | **Purchase Return dropped the line discount from the GL** | money |
| step10c | Return **unpost** read-before-write (INFRA_005) | blocker |
| step3-empty | PO empty-row (above) + PR empty-row pattern | bug |
| **step13** | **PI double-receives stock for GRN-backed PO lines** (this report's headline fix) | money/stock |

## Step 13 — the PI double-receipt bug (headline)

**Symptom:** ITEM-A on hand read **103** but the true figure was **53**. The movement history held two `PURCHASE_RECEIPT +50` for one 50-unit purchase: one `GOODS_RECEIPT` (GRN-00001) and one `PURCHASE_INVOICE` (PI-00001 itself). The linked PI re-received goods the GRN had already received. (Step 4 had recorded 58 — one receipt; PI posting bumped it to 108. It slipped past step 8, which only checked GL/AP, not stock qty.)

**Root cause:** A PI built from a PO (`toEditableLinesFromPurchaseOrder`, `PurchaseInvoiceDetailPage.tsx:355`) carries `poLineId` but **not** `grnLineId`, and there is no "create PI from GRN" UI builder. The posting receipt gate keyed only on `grnLineId` (`!hasGRNForThisLine(line)`), so with `allowDirectInvoicing` ON the PI treated the line as a fresh direct receipt and posted a second movement.

**Fix** (`backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`):
- New helper `goodsAlreadyReceived(line, po) = hasGRNForThisLine(line) || (poLine && poLine.receivedQty > 0)`.
- Replaced `!hasGRNForThisLine(line)` with `!goodsAlreadyReceived(line, po)` in all three receipt gates (prefetch stock level, prefetch UOM conversions, receipt creation) **and** in `hasReceiptBackedFlow`.
- **Mode-safe:** `DocumentPolicyResolver.shouldPurchaseInvoiceClearGRNI` keys on PERPETUAL mode, not on `grnLineId`. So invoice-driven (PERIODIC) tenants keep `Dr Inventory / Cr AP` (value still posts once) and just drop the duplicate quantity; PERPETUAL tenants now correctly clear GRNI instead of double-debiting inventory. True direct invoicing (no PO, or an unreceived PO line) is unchanged.
- No frontend change needed — the backend is the integrity boundary and now handles this regardless of whether the UI stamps `grnLineId`.

**Out of scope (logged):** the invoice-driven GRN-gross-vs-PI-net **cost-basis drift** (backlog 223). After this fix the *quantity* is correct; only the per-unit cost basis differs by the line discount. Revisit in GP05.

## Verification

- **Unit test:** `PurchasePostingUseCases.test.ts` **case 7b** — PERIODIC + `allowDirectInvoicing` + PO `receivedQty 50` + no `grnLineId` → asserts `writeStockMovement` NOT called and GL `Dr Inventory 500 / Cr AP 500`. Posting suite **17/17**, purchases suite **74/74** green. Backend rebuilt (`tsc` → `lib/`).
- **Live, end-to-end on the running emulator:** fresh `PO-00002 → GRN-00002` (ITEM-A receipt count 2→3) → `PI-00002` built from the PO (`poLineId` only, **no** `grnLineId`) → posted **POSTED**, GL `Dr Finished Goods 20 / Cr AP-VEND-1 20` (balanced), receipt count **stayed 3** (pre-fix would be 4). The test cycle was then unposted (PI + GRN) to restore the documented QA state — receipts back to 2, ITEM-A on hand back to 103.
- **Reports tie out** at −47.50: Vendor Statement VEND-1 (BILL 495 → PAYMENT 495 → DEBIT_NOTE 47.50) closing −47.50 = AP Aging −47.50 (unallocated debit note, aging buckets 0) = Trial Balance AP sub-account `20100-VEND-1` −47.50; Trial Balance balanced (Dr 2616.97 = Cr 2616.97).

## Files

- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — `goodsAlreadyReceived` helper + gates (step 13 fix)
- `backend/src/application/purchases/use-cases/PaymentSyncUseCases.ts` — vendor AP resolution (step 9)
- `backend/src/api/controllers/purchases/PurchaseController.ts` — record-payment wiring + MULTI default (step 9)
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts` — return discount-in-GL + unpost txn ordering (step 10)
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx` — return unit-price inheritance (step 10)
- Tests: `PurchasePostingUseCases.test.ts` (7b, 6c), `PurchasePaymentSyncUseCases.test.ts`, `PurchaseReturnUseCases.test.ts`
- Docs: `docs/architecture/purchases.md` ("PI does not re-receive GRN-received goods")
- Planning: `planning/qa/findings.md`, `planning/JOURNAL.md`, `planning/ACTIVE.md`

## Known residue / follow-ups

- **Tenant residue:** `PO-00002` + DRAFT `GRN-00002`/`PI-00002` from the live test (zero posted effect).
- **Backlog 223:** invoice-driven cost-basis drift (per-unit cost vs GL) — revisit in GP05.
- **Cosmetic (logged):** PI posted-view allocation grid shows "no rows" though charges are intact in data; PO-ref fields show raw UUID instead of PO number; no dedicated purchase-discount account (invoice discount credits the charge's account).
- **Next:** GP05 cross-module books check.
