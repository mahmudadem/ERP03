# 103 — PR4: API Idempotency + Negative-Stock Enforcement

**Status:** ✅ COMPLETE
**Date:** 2026-05-19
**Branch:** `fix/project-responsiveness`
**Scope:** Second of six PRs in the [alpha-readiness remediation plan](../tasks/alpha-readiness-remediation-plan.md). Closes P0-8 (Idempotency-Key middleware) and P0-9 (`allowNegativeStock` enforcement).

## Context

Two operational-safety gaps from the second-pass audit:

- **P0-8** — no request-level idempotency. A double-click or network retry on a posting endpoint produced duplicate vouchers.
- **P0-9** — `InventorySettings.allowNegativeStock` flag existed but was never enforced. Negative stock was always allowed; the flag was decorative.

PR4 closes both with minimal surface area: an Express middleware for idempotency and a single conditional check in `RecordStockMovementUseCase.processOUT`.

## What changed

### Idempotency middleware

- New entity: `IdempotencyKeyRecord` with 24h TTL constant
- New repo interface + Firestore implementation (`companies/{cid}/idempotency_keys/{key}`)
- New middleware reads `Idempotency-Key` header, hashes body (SHA-256), looks up the record, and either replays the cached response, returns 409 on body conflict, or proceeds + persists on first call
- Wired into 12 routes (Sales + Purchases POST/PUT endpoints that drive posting or payment)
- Storage is Firestore-only; SQL parity not needed for idempotency
- Warn-only when header missing (`console.warn` rather than `400`); future PR can flip to enforce mode

### Negative-stock enforcement

- New error class: `NegativeStockError` with structured `policyId: 'allow-negative-stock'`
- Added `inventorySettingsRepository` as a required dep on `RecordStockMovementUseCase`
- Added `preFetchedInventorySettings` optional input on `ProcessOUTInput` so high-volume callers can pre-fetch once and pass through
- Inserted the check inside `processOUT` *before* mutating `level.qtyOnHand`. Only fires when projected qty would be negative
- Updated 4 call sites (3 controllers + 1 test) to pass the new dep

## Files changed

New:
- `backend/src/domain/system/entities/IdempotencyKey.ts`
- `backend/src/repository/interfaces/system/IIdempotencyKeyRepository.ts`
- `backend/src/infrastructure/firestore/repositories/system/FirestoreIdempotencyKeyRepository.ts`
- `backend/src/api/middlewares/idempotencyMiddleware.ts`
- `backend/src/domain/inventory/errors/NegativeStockError.ts`
- `backend/src/tests/api/middlewares/idempotencyMiddleware.test.ts` (7 cases)
- `backend/src/tests/application/inventory/NegativeStockEnforcement.test.ts` (4 cases)
- `docs/architecture/idempotency.md`

Modified:
- `backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts` — new dep + check
- `backend/src/api/routes/sales.routes.ts` — middleware applied to 6 routes
- `backend/src/api/routes/purchases.routes.ts` — middleware applied to 6 routes
- `backend/src/api/controllers/sales/SalesController.ts` — pass new dep
- `backend/src/api/controllers/purchases/PurchaseController.ts` — pass new dep
- `backend/src/api/controllers/inventory/InventoryController.ts` — pass new dep
- `backend/src/infrastructure/di/bindRepositories.ts` — bind new repo
- `backend/src/repository/interfaces/system/index.ts` — re-export new interface
- `backend/src/tests/application/inventory/RecordStockMovementUseCase.test.ts` — pass stub dep
- `docs/architecture/inventory.md` — document enforcement semantics

## Verification

- `cd backend && npx tsc --noEmit` → exit 0
- `cd backend && npx jest --testPathPatterns="(idempotencyMiddleware|NegativeStockEnforcement)"` → 11/11 pass
- `cd backend && npx jest --testPathPatterns="(RecordStockMovementUseCase|SalesPostingUseCases|PurchasePostingUseCases)"` → 48/48 pass (no regression)

## Notes / next steps

- Unpost endpoints intentionally don't get idempotency middleware — they're manual, rare, and already gated by document-status checks.
- Frontend will need to be updated to generate and send `Idempotency-Key` per posting intent. Until then, warn-only mode means current behavior is preserved.
- A Firestore TTL policy on `companies/{cid}/idempotency_keys/{key}.expiresAt` should be configured at deploy time so old records auto-delete. Lazy expiry in code is the safety net.

## Next PR

PR6 (Firestore production security rules) is independent and can run next. PR2 (PostingLog) is the next foundation piece for PR3 and PR5.
