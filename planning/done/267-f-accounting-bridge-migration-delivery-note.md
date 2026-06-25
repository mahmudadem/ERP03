# Task 267-F — Accounting Bridge Migration: Sales DeliveryNote COGS (Golden Tests First)

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Worktree:** `D:\DEV2026\ERP03-267-engine-audit`
**Slice:** 267-F — first module path migrated to `IAccountingBridge`-only with golden voucher-output tests.

---

## What Changed

### Problem

The audit (`planning/audits/267-system-core-boundary-inventory.md`) found that Sales, Purchases, and Inventory use cases still held a direct `SubledgerVoucherPostingService` field alongside the `IAccountingBridge`. While the bridge was already wired and used as the primary posting path (via `postFinancialEvent` / `SubledgerDocumentPoster`), the posting service remained as a fallback — meaning the use case directly imported and depended on the legacy posting service.

### Approach: Golden Tests First

Per the task prompt, golden voucher-output tests were added **before** any code change:

1. **`SalesDeliveryNoteGoldenVoucher.test.ts`** (7 tests) — a `CapturingBridge` implements `IAccountingBridge` and records the exact `FinancialEvent` (the `subledgerVoucher` input) that the use case sends to the bridge. The tests pin:
   - **G1:** Exact account ids, debit/credit sides, base/doc amounts, currency, exchange rate, voucher type, posting lock policy, reference, base-currency override, and source metadata (sourceModule, sourceType, sourceId, referenceType, referenceId).
   - **G2:** Minimal mode (engine not initialized) — bridge returns `{ mode: 'minimal', voucher: null }` → `dn.cogsVoucherId = null`.
   - **G3:** PERIODIC mode does not post a COGS voucher (no event sent to the bridge).
   - **G4:** COGS account fallback to inventory financial settings when the item has no explicit accounts.
   - **G5:** Period-lock override metadata is forwarded into the voucher metadata.
   - **G6:** Foreign-currency DN resolves base currency for the voucher, `exchangeRate = 1`.
   - **G7:** Stability — the same DN posted twice produces identical `subledgerVoucher` fields.

These tests were run green against the **pre-migration** code (where the bridge was already wired via the controller), then the migration was applied, and the same tests remain green — proving **zero accounting output drift**.

### Migration

**`backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts`:**
- Removed the `import { SubledgerVoucherPostingService }` import.
- Removed the `accountingPostingService: SubledgerVoucherPostingService` constructor param (was the 12th positional arg).
- Changed `postFinancialEvent({ bridge: this.accountingBridge, postingService: this.accountingPostingService })` → `postFinancialEvent({ bridge: this.accountingBridge })` — bridge-only, no legacy fallback.
- The use case now depends **only** on `IAccountingBridge` for GL posting.

**`backend/src/api/controllers/sales/SalesController.ts`:**
- Removed the `accountingPostingService` local variable in `postDN`.
- Removed the 12th arg from `new PostDeliveryNoteUseCase(...)`.
- The `accountingBridge` constructor param is now **required** (not optional). It was reordered ahead of the optional `auditEngine?` param so TypeScript enforces it at compile time — every caller must wire a bridge; there is no fallback. The controller passes `SalesController.buildAccountingBridge()` then `IAuditEngine`.

**`backend/src/tests/application/sales/SalesPostingUseCases.test.ts`:**
- Updated 8 `PostDeliveryNoteUseCase` constructions: removed the 12th arg (posting service), wired a `LegacyAccountingBridgeAdapter` wrapping the same posting service as the required bridge arg. The bridge sees `companyModuleRepo.initialized = true` → full mode → calls `postInTransaction` → same `voucherRepo.save` behavior. Existing assertions unchanged.

**`backend/src/tests/architecture/SystemCoreBoundaries.test.ts`:**
- Added guard `267-F: Sales DeliveryNote COGS posting must route through IAccountingBridge, not legacy posting services`:
  - `DeliveryNoteUseCases.ts` must NOT contain `SubledgerVoucherPostingService`.
  - Must NOT contain `PostingGateway`.
  - Must contain `postFinancialEvent` and `IAccountingBridge`.
- No existing guard was weakened, skipped, or deleted.

### Files Touched

| File | Change |
|---|---|
| `backend/src/tests/application/sales/SalesDeliveryNoteGoldenVoucher.test.ts` | **New** — 7 golden voucher-output tests |
| `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts` | Removed `SubledgerVoucherPostingService` import + constructor param; bridge-only `postFinancialEvent`; `accountingBridge` now required (reordered before `auditEngine?`) |
| `backend/src/api/controllers/sales/SalesController.ts` | Removed posting-service local + 12th constructor arg in `postDN`; swapped bridge/auditEngine arg order |
| `backend/src/tests/application/sales/SalesPostingUseCases.test.ts` | Updated 8 DN constructions to wire bridge instead of posting service |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | Added 267-F guard |
| `backend/src/application/system-core/contracts/IAccountingBridge.ts` | Fixed wording: "Accounting App is enabled" → "Accounting Engine is initialized" |
| `docs/architecture/accounting.md` | Updated cross-module touchpoints + added 267-F section; fixed "Accounting App enabled/disabled" → "Accounting Engine initialized/not initialized" wording |
| `docs/architecture/system-core.md` | Fixed "Accounting App is enabled/disabled" → "Accounting Engine is initialized/not initialized" wording in Accounting Bridge section |
| `docs/architecture/module-boundaries.md` | Updated FUP-3 line |
| `docs/architecture/posting-log.md` | Updated DN row from Pending to bridge-routed |

**5 code/test files across 3 directories** (under the 8-file cap).

---

## Accounting / Control Impact

**None.** The voucher output (account ids, sides, amounts, currency, metadata, posting lock policy, reference) is byte-for-byte identical before and after the migration, proven by the golden tests. The bridge already owned the full-vs-minimal decision; this slice only removes the dead-weight fallback dependency from the use case. No posting math, tax, COGS, inventory valuation, settlement, period-lock, or approval behavior changed.

---

## Verification (all green, run on `D:\DEV2026\ERP03-267-engine-audit`)

```
npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
→ 17/17 PASS (16 existing + 1 new 267-F guard)

npm --prefix backend test -- --runInBand src/tests/application/sales
→ 27 suites / 287 tests PASS (26 existing + 1 new golden suite / 7 tests)

npm --prefix backend test -- --runInBand src/tests/application/system-core
→ 12 suites / 73 tests PASS

npm --prefix backend run build
→ tsc clean (no errors)
```

---

## Reviewer-Blocker Check

- Shared logic added inside Sales instead of System Core? — **no.** The bridge and `postFinancialEvent` helper live in System Core / accounting-services; the use case only calls them.
- Posting, tax, COGS, stock valuation, AP/AR, settlement, period-lock behavior changed? — **no.** Golden tests prove identical voucher output.
- Direct new `SubledgerVoucherPostingService` or `PostingGateway` source-module usage introduced? — **no.** The DN path no longer imports either.
- New `StockMovement` / `StockLevel` construction outside inventory core? — **no.**
- Tests or architecture guards weakened? — **no.** 16 existing guards still pass; 1 new non-failing guard added.
- `opencode.json` modified? — **no.**
- Golden tests fail if voucher lines/metadata drift? — **yes.** G1, G4, G5, G6, G7 pin exact fields; G2 pins minimal-mode null behavior; G3 pins PERIODIC no-post.

---

## Review Fixes (post-review, pre-commit)

Two items from the review were fixed before commit:

1. **P1 — docs/control wording bug:** Several docs/comments said "Accounting App is enabled/disabled" implying the UI toggle gates posting. Fixed to precise Engine-readiness wording in `docs/architecture/accounting.md`, `docs/architecture/system-core.md`, `backend/src/application/system-core/contracts/IAccountingBridge.ts`, and this completion report. The correct rule: full = `companyModule.accounting.initialized === true`; minimal = engine not initialized; `isEnabled` / Accounting App UI visibility never gates posting correctness.

2. **P2 — typing cleanup:** `accountingBridge` was still optional (`?: IAccountingBridge`) despite the posting-service fallback being removed. Made it **required** by reordering the constructor param ahead of the optional `auditEngine?` (TypeScript forbids a required param after an optional one). All 11 call sites (1 controller + 8 test constructions + 2 golden test constructions) were updated to the new arg order. This gives compile-time enforcement — a caller that forgets to wire the bridge won't compile.

**Verification after fixes (all green):**
- `SalesDeliveryNoteGoldenVoucher.test.ts` — 7/7 PASS
- `SystemCoreBoundaries.test.ts` — 17/17 PASS
- `SalesPostingUseCases.test.ts` — 29/29 PASS
- `npm run build` — tsc clean

---

## End-User View

No user-facing change. The DeliveryNote COGS posting behavior is identical. This is an internal architecture improvement: the Sales module's DeliveryNote posting path now depends solely on the accounting bridge (the system's single financial-event doorway) instead of holding a direct reference to the legacy posting service. This makes the system more maintainable and ensures that a tenant whose Accounting Engine is not initialized (not linked to accounting) still gets correct financial event recording (minimal journal mode) without any code-level workaround. The Accounting App/UI visibility toggle (`isEnabled`) never gates this — only engine readiness (`initialized`) does.

---

## Next Slice

The remaining Sales paths (`SalesInvoiceUseCases`, `SalesReturnUseCases`, `PaymentSyncUseCases`) and all Purchases/Inventory posting paths still hold a `SubledgerVoucherPostingService` field. They already route through the bridge, but migrating each to bridge-only (with golden tests first) is the natural follow-up. Recommended order:

1. **SalesInvoiceUseCases** — SI revenue + COGS vouchers use `SubledgerDocumentPoster(postingService, bridge)`. Migration: make the poster's `postingService` arg optional (it's already only used as fallback), remove the field from the SI use case, update controller + tests.
2. **SalesReturnUseCases** — same `SubledgerDocumentPoster` pattern.
3. **PaymentSyncUseCases** — settlement `postFull` closure uses `PostingGateway` (FUP-5 sanctioned pattern). Migration: the use case should not import `PostingGateway` directly; the `postFull` closure should be provided by the bridge or a shared helper.
4. **Purchases** — PI/PR/GRN/PaymentSync, same patterns.
5. **Inventory** — StockAdjustment/StockTransfer/OpeningStock/Revaluation, same `postFinancialEvent` pattern.

Each slice: golden tests first → migrate → verify → guard.
