# Task 267-F (SR slice) — Accounting Bridge Migration: SalesReturn Document Vouchers

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Slice:** 267-F SR — SalesReturn document voucher path migrated to `IAccountingBridge`-only.

---

## What Changed

### Problem

The `PostSalesReturnUseCase` held a direct `SubledgerVoucherPostingService` field alongside `IAccountingBridge`. Document vouchers (revenue reversal + COGS reversal, plus the optional refund settlement voucher) were posted via `new SubledgerDocumentPoster(this.accountingPostingService, this.accountingBridge)` — the posting service was the fallback when no bridge was wired.

### Approach: Golden Tests First

`SalesReturnGoldenVoucher.test.ts` (7 tests) was written **before** migration, run green against pre-migration code (where the poster already preferred the bridge when one was wired), then remained green after migration → proving zero accounting output drift. Tests pin:
- **G1:** AFTER_INVOICE posts COGS then REVENUE vouchers with exact account ids (INV-200/COGS-200, REV-200/TAX-200/AR-200), sides (Dr inventory / Cr COGS; Dr revenue / Dr tax / Cr AR), base/doc amounts (2 x 4 = 8 COGS; 2 x 10 = 20 revenue + 2 tax + 22 AR settlement), currency, exchange rate, posting lock policy, source metadata, voucher numbers (`SR-COGS-SR-00001`, `SR-REV-SR-00001`), settlement mode + reason code metadata.
- **G2:** BEFORE_INVOICE posts the COGS voucher **only** (no revenue voucher — there is no invoice to reverse); `revenueVoucherId = null`.
- **G3:** Minimal mode (engine not initialized) — bridge returns `{ mode: 'minimal', voucher: null }` → `cogsVoucherId = null`, `revenueVoucherId = null`, but the events still flow to the bridge.
- **G4:** Period-lock override metadata forwarded into **both** COGS and REVENUE vouchers; `postingLockPolicy = FLEXIBLE_LOCKED`.
- **G5:** Foreign-currency return keeps EUR + rate on the REVENUE voucher (20 EUR doc / 30 USD base) and base currency USD on the COGS voucher (exchangeRate 1).
- **G6:** PERIODIC mode posts the REVENUE voucher but **no** COGS voucher.
- **G7:** Output stability — the same return posted twice through the bridge produces identical `subledgerVoucher` fields.

### Migration

**`backend/src/application/sales/use-cases/SalesReturnUseCases.ts`:**
- Removed `import { SubledgerVoucherPostingService }` entirely.
- Removed the `accountingPostingService` field and constructor param (was position 15).
- `accountingBridge` is now **required** — moved from optional (last position) to the required slot right after `transactionManager` (now position 17), before the optional `auditEngine?` / `postingLogRepo?` / `partyItemPriceRepo?` / `profitFactRecorder?`. Compile-time enforced.
- Poster construction: `new SubledgerDocumentPoster(this.accountingPostingService, this.accountingBridge)` → `new SubledgerDocumentPoster(undefined, this.accountingBridge)`.

**`backend/src/api/controllers/sales/SalesController.ts`:**
- `postReturn` removed the `accountingPostingService` local + the 15th constructor arg.
- `buildAccountingBridge()` moved to the required bridge position (before the optional audit/log repos).

**`backend/src/tests/application/sales/SalesReturnUseCases.test.ts`:**
- Added `LegacyAccountingBridgeAdapter` import.
- Wrapped each of the 14 inline `new SubledgerVoucherPostingService(...)` constructions in `new LegacyAccountingBridgeAdapter(new SubledgerVoucherPostingService(...), makeCompanyModuleRepo() as any)` and reordered it to the required bridge position (after `transactionManager`). Each existing posting-service instance still runs verbatim in full mode (the adapter delegates to `postInTransaction`), so the existing `voucherRepo.save` assertions are unchanged.
- The one stub-only construction (test 22 — DIRECT standalone blocked in PERPETUAL) was rewired to the new arg order: `undefined` (accountRepo), `{}` (transactionManager), `{}` (bridge stub — never reached since the use case throws before posting).

**`backend/src/tests/architecture/SystemCoreBoundaries.test.ts`:**
- New `267-F (SR)` guard: `SalesReturnUseCases.ts` must not import `SubledgerVoucherPostingService`, must use `SubledgerDocumentPoster` + `IAccountingBridge`. 18 existing guards untouched.

`SubledgerDocumentPoster` was **not** changed in this slice — `postingService` was already made optional in the 267-F SI slice. PI/PR still pass both args unchanged → backward-compatible.

### Files Touched

| File | Change |
|---|---|
| `backend/src/tests/application/sales/SalesReturnGoldenVoucher.test.ts` | **New** — 7 golden voucher-output tests |
| `backend/src/application/sales/use-cases/SalesReturnUseCases.ts` | Removed `SubledgerVoucherPostingService` import + field + constructor param; `accountingBridge` now required (moved before optional params); poster uses bridge-only |
| `backend/src/api/controllers/sales/SalesController.ts` | `postReturn` updated to new constructor signature; removed posting-service local |
| `backend/src/tests/application/sales/SalesReturnUseCases.test.ts` | 14 inline SVPS constructions wrapped in `LegacyAccountingBridgeAdapter` at the required bridge position; 1 stub construction rewired; added import |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | Added 267-F (SR) guard |
| `docs/architecture/accounting.md` | Updated cross-module touchpoints + added 267-F SR subsection |
| `docs/architecture/module-boundaries.md` | Updated FUP-3 line |
| `docs/architecture/posting-log.md` | Updated SR row from Pending to bridge-routed |

---

### CTO Review Fixes

- Corrected one adapted legacy test so the uninitialized-engine fixture also passes an uninitialized repo into `LegacyAccountingBridgeAdapter`.
- Replaced stale App/UI-toggle wording in `SalesController.buildAccountingBridge()` and `docs/architecture/module-boundaries.md`; full/minimal language now refers to Accounting Engine initialized/not initialized.
- Cleaned the golden-test fixture mode type typo.

---

## Accounting / Control Impact

**None.** Golden tests prove identical voucher output (COGS reversal + revenue reversal). The bridge already owned the full-vs-minimal decision; this slice only removes the dead-weight fallback dependency from the SR use case. No posting math, tax, COGS, inventory valuation, settlement/refund, period-lock, or approval behavior changed.

---

## Verification (all green, run on `D:\DEV2026\ERP03-267-engine-audit`)

```
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesReturnGoldenVoucher.test.ts
→ 7/7 PASS

npm --prefix backend test -- --runInBand src/tests/application/sales/SalesReturnUseCases.test.ts
→ 15/15 PASS

npm --prefix backend test -- --runInBand src/tests/application/sales/SalesPostingUseCases.test.ts
→ 29/29 PASS

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
→ 19/19 PASS (18 existing + 1 new 267-F SR guard)

npm --prefix backend run build
→ tsc clean

git diff --check
→ no whitespace errors (CRLF normalization warnings only)
```

---

## Reviewer-Blocker Check

- Posting, tax, COGS, stock valuation, AP/AR, settlement/refund, period-lock behavior changed? — **no.** Golden tests prove identical voucher output.
- Direct new `SubledgerVoucherPostingService` source-module usage introduced? — **no.** SR no longer imports it.
- `SubledgerDocumentPoster` change forced PI/PR changes? — **no.** `postingService` was already optional from the SI slice; no poster change in this slice; PI/PR still pass both args unchanged.
- New `StockMovement` / `StockLevel` construction outside inventory core? — **no.**
- Tests or architecture guards weakened? — **no.** 18 existing guards still pass; 1 new guard added.
- `opencode.json` modified? — **no.**
- Golden tests fail if voucher lines/metadata drift? — **yes.** G1/G2/G5/G7 pin exact fields; G3 pins minimal-mode null ids; G4 pins period-lock override metadata on both vouchers; G6 pins PERIODIC no-COGS.
- `accountingBridge` is compile-time required? — **yes.** Moved before optional params; TypeScript enforces.

---

## End-User View

No user-facing change. The Sales Return posting behavior (revenue reversal, tax reversal, COGS reversal, refund settlement) is identical. This is an internal architecture improvement: the Sales Return document voucher path now depends solely on the accounting bridge (the system's single financial-event doorway) instead of holding a direct reference to the legacy posting service. A tenant whose Accounting Engine is not initialized (not linked to accounting) still gets correct minimal-journal event recording. The Accounting App/UI visibility toggle (`isEnabled`) never gates this — only engine readiness (`initialized`) does.

---

## Next Slice

- **PaymentSyncUseCases** — settlement `postFull` closure uses `PostingGateway` (FUP-5). Migrate so the use case no longer imports `PostingGateway` directly.
- **Purchases** — PI/PR/GRN/PaymentSync, same `SubledgerDocumentPoster` pattern.
- **Inventory** — StockAdjustment/StockTransfer/OpeningStock/Revaluation, same `postFinancialEvent` pattern.
