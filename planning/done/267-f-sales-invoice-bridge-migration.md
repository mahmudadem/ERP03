# Task 267-F (SI slice) — Accounting Bridge Migration: SalesInvoice Document Vouchers

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Slice:** 267-F SI — SalesInvoice document voucher path migrated to `IAccountingBridge`-only.

---

## What Changed

### Problem

The `PostSalesInvoiceUseCase` held a direct `SubledgerVoucherPostingService` field alongside `IAccountingBridge`. Document vouchers (revenue + COGS) were posted via `new SubledgerDocumentPoster(this.accountingPostingService, this.accountingBridge)` — the posting service was the fallback when no bridge was wired.

### Approach: Golden Tests First

`SalesInvoiceGoldenVoucher.test.ts` (7 tests) was written **before** migration, run green against pre-migration code, then remained green after — proving zero accounting output drift. Tests pin:
- **G1:** Service-item SI posts REVENUE voucher with exact AR debit, revenue credit, currency, exchange rate, posting lock policy, source metadata.
- **G2:** Stock-item SI posts REVENUE + COGS vouchers with exact account ids (COGS-200/INV-200), sides, base/doc amounts (qty × cost).
- **G3:** Minimal mode (engine not initialized) — bridge returns null voucher ids; `si.voucherId = null`, `si.cogsVoucherId = null`.
- **G4:** Period-lock override metadata forwarded into both REVENUE and COGS vouchers.
- **G5:** Foreign-currency SI — currency and exchangeRate passed into the revenue voucher; base/doc amounts computed correctly.
- **G6:** PERIODIC mode — REVENUE voucher posted, NO COGS voucher.
- **G7:** Output stability — same SI posted twice produces identical `subledgerVoucher` fields.

### Migration

**`SubledgerDocumentPoster.ts`:** `postingService` made optional (`postingService?: ISubledgerPostingService`). Backward-compatible — PI/SR still pass both args unchanged. The `post()` method now throws if neither bridge nor postingService is configured.

**`SalesInvoiceUseCases.ts`:**
- Removed `import { SubledgerVoucherPostingService }` entirely.
- Removed the `accountingPostingService` field and constructor param.
- `accountingBridge` is now **required** — moved from position 27 (optional, after `numberingEngine?`) to position 17 (required, right after `transactionManager`). Compile-time enforced.
- Poster construction: `new SubledgerDocumentPoster(this.accountingPostingService, this.accountingBridge)` → `new SubledgerDocumentPoster(undefined, this.accountingBridge)`.
- `PostingGateway` import retained for settlement receipt path (FUP-5 — out of scope for this slice).

**`SalesController.ts`:** Both SI construction sites updated — removed `accountingPostingService` local + arg, moved `buildAccountingBridge(true)` to the required bridge position.

**Test files updated:** `SalesPostingUseCases.test.ts` (19 SI constructions + `buildUseCase` helper), `ErrorTaxonomyBusinessRuleMapping.test.ts`, `SalesInvoiceSettlementPosting.test.ts`, `SalesRuleErrorMapping.test.ts` — all SI constructions rewired to pass a `LegacyAccountingBridgeAdapter` as the required bridge arg.

**Architecture guard:** New `267-F (SI)` guard in `SystemCoreBoundaries.test.ts`: `SalesInvoiceUseCases.ts` must not import `SubledgerVoucherPostingService`, must use `SubledgerDocumentPoster` + `IAccountingBridge`. 17 existing guards untouched.

### Files Touched

| File | Change |
|---|---|
| `backend/src/tests/application/sales/SalesInvoiceGoldenVoucher.test.ts` | **New** — 7 golden voucher-output tests |
| `backend/src/application/accounting/services/SubledgerDocumentPoster.ts` | `postingService` made optional (backward-compatible); updated `post()` error handling; fixed wording |
| `backend/src/application/accounting/services/postFinancialEvent.ts` | Fixed wording: "Accounting App/module is disabled" → "Accounting Engine is initialized / not initialized" |
| `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` | Removed `SubledgerVoucherPostingService` import + field + constructor param; `accountingBridge` now required (moved before optional params); poster uses bridge-only; fixed settlement comment wording |
| `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts` | Fixed missed wording from prior slice: "Accounting App disabled" → "Accounting Engine not initialized" |
| `backend/src/api/controllers/sales/SalesController.ts` | 2 SI construction sites updated to new constructor signature |
| `backend/src/tests/application/sales/SalesPostingUseCases.test.ts` | 19 SI constructions + `buildUseCase` helper updated to wire bridge |
| `backend/src/tests/application/sales/ErrorTaxonomyBusinessRuleMapping.test.ts` | SI construction updated to wire bridge |
| `backend/src/tests/application/sales/SalesInvoiceSettlementPosting.test.ts` | SI construction updated to wire bridge |
| `backend/src/tests/application/sales/SalesRuleErrorMapping.test.ts` | SI construction updated to wire bridge |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | Added 267-F (SI) guard |
| `docs/architecture/accounting.md` | Updated cross-module touchpoints + 267-F SI section |
| `docs/architecture/module-boundaries.md` | Updated FUP-3 line |
| `docs/architecture/posting-log.md` | Updated SI row from Pending to bridge-routed |

---

## Accounting / Control Impact

**None.** Golden tests prove identical voucher output (revenue + COGS). The bridge already owned the full-vs-minimal decision; this slice only removes the dead-weight fallback dependency from the SI use case. No posting math, tax, COGS, inventory valuation, settlement, period-lock, or approval behavior changed.

---

## Verification (all green)

```
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesInvoiceGoldenVoucher.test.ts
→ 7/7 PASS

npm --prefix backend test -- --runInBand src/tests/application/sales/SalesPostingUseCases.test.ts
→ 29/29 PASS

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
→ 18/18 PASS (17 existing + 1 new 267-F SI guard)

npm --prefix backend run build
→ tsc clean
```

Additional: `ErrorTaxonomyBusinessRuleMapping` + `SalesInvoiceSettlementPosting` + `SalesRuleErrorMapping` = 14/14 PASS.

---

## Reviewer-Blocker Check

- Posting, tax, COGS, stock valuation, AP/AR, settlement, period-lock behavior changed? — **no.** Golden tests prove identical voucher output.
- Direct new `SubledgerVoucherPostingService` source-module usage introduced? — **no.** SI no longer imports it.
- `SubledgerDocumentPoster` change forced PI/SR changes? — **no.** `postingService` made optional is backward-compatible; PI/SR still pass both args unchanged.
- New `StockMovement` / `StockLevel` construction outside inventory core? — **no.**
- Tests or architecture guards weakened? — **no.** 17 existing guards still pass; 1 new guard added.
- `opencode.json` modified? — **no.**
- Golden tests fail if voucher lines/metadata drift? — **yes.** G1/G2/G5/G7 pin exact fields; G3 pins minimal-mode null; G4 pins period-lock override metadata; G6 pins PERIODIC no-COGS.
- `accountingBridge` is compile-time required? — **yes.** Moved before optional params; TypeScript enforces.

---

## End-User View

No user-facing change. The SalesInvoice posting behavior is identical. This is an internal architecture improvement: the SI document voucher path now depends solely on the accounting bridge instead of holding a direct reference to the legacy posting service. A tenant whose Accounting Engine is not initialized still gets correct minimal-journal event recording. The Accounting App/UI visibility toggle (`isEnabled`) never gates this — only engine readiness (`initialized`) does.

---

## Next Slice

- **SalesReturnUseCases** — same `SubledgerDocumentPoster` pattern; remove the posting-service field, make bridge required.
- **PaymentSyncUseCases** — settlement `postFull` closure uses `PostingGateway` (FUP-5); migrate to not import `PostingGateway` directly.
- **Purchases** — PI/PR/GRN/PaymentSync, same patterns.
- **Inventory** — StockAdjustment/StockTransfer/OpeningStock/Revaluation, same `postFinancialEvent` pattern.
