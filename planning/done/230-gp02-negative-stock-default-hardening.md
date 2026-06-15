# GP02 Negative-Stock Default Hardening

**Date:** 2026-06-14  
**Actual time:** ~0.5h  
**Scope:** Golden Path 02, Inventory step 9 only.

## Technical Developer View

### What changed

- `backend/src/domain/inventory/entities/InventorySettings.ts`
  - New default inventory settings now use `allowNegativeStock=false`.
  - Hydrated legacy settings with a missing `allowNegativeStock` flag now resolve to `false`.
- `backend/src/application/inventory/use-cases/InitializeInventoryUseCase.ts`
  - Fresh inventory initialization defaults to blocking negative stock unless explicitly enabled.
- `backend/src/api/controllers/inventory/InventoryController.ts`
  - Settings updates without an existing/current value default to blocking negative stock.
- `frontend/src/modules/inventory/wizards/InventoryInitializationWizard.tsx`
  - New company inventory setup starts with **Allow Negative Stock** unchecked.
- `frontend/src/modules/inventory/pages/InventorySettingsPage.tsx`
  - Inventory Settings sections now show their local **Save Settings** button instead of relying only on the floating unsaved-changes bar.
- `backend/src/tests/domain/inventory/InventorySettings.test.ts`
  - Locks the new default/hydration behavior.

### Follow-up (2026-06-14): transfer path also bypassed the guard

After the default-hardening fix, fresh-company QA showed a **stock transfer** still drove the source warehouse hugely negative with negative stock disabled+saved. The guard only existed in `processOUT`; the transfer source (OUT) leg had none.

- `backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts`
  - `processTRANSFER` now loads `InventorySettings` once (drives the costing basis **and** the guard, mirroring `processOUT`) and passes it to `processTRANSFERGlobal`.
  - Both transfer paths throw `NegativeStockError` (`NEGATIVE_STOCK_BLOCKED`) **before** decrementing the source `qtyOnHand` when the projected source qty < 0 and `allowNegativeStock===false`. The destination IN leg is never guarded (a receipt can't create a deficit).
- `backend/src/tests/application/inventory/NegativeStockEnforcement.test.ts`
  - +3 regression cases: WAREHOUSE transfer blocks, WAREHOUSE transfer allowed when opt-in is on, GLOBAL transfer blocks.

### Follow-up (2026-06-15): draft transfers were uncancelable

Live QA exposed a second gap: a DRAFT transfer that can't complete (now correctly blocked by negative stock) was a dead document — the page/API offered only create, complete, and list. No way to edit, cancel, or delete it.

- `backend/src/application/inventory/use-cases/StockTransferUseCases.ts` — new `CancelStockTransferUseCase` (DRAFT-only hard delete; refuses COMPLETED / not-found / cross-company).
- `backend/src/api/controllers/inventory/InventoryController.ts` — `cancelTransfer` handler.
- `backend/src/api/routes/inventory.routes.ts` — `DELETE /transfers/:id` (`inventory.stock.adjust`).
- `frontend/src/api/inventoryApi.ts` — `cancelTransfer(id)`.
- `frontend/src/modules/inventory/pages/StockTransfersPage.tsx` — red **Cancel** button on DRAFT rows (confirm dialog).
- `backend/src/tests/application/inventory/CancelStockTransferUseCase.test.ts` — 4 cases.

Also clarified (not a bug): the VALUED-transfer GL entry does **not** bypass the ledger guard — it posts through `PostingGateway.record()` (period lock + policies) and is APPROVED because the completion action is its authorization. Documented in `docs/architecture/inventory.md`.

### Follow-up (2026-06-15): simple correction layer for stock transfers

The product owner correctly pushed on the product vision: small companies should not need to understand manual reversal accounting just to fix a mistaken transfer. The safe design is **simple UI, controlled backend**.

- `UpdateStockTransferUseCase` + `PUT /transfers/:id`
  - DRAFT transfers can now be edited in place.
  - The edit reuses the same transfer validation/cost snapshot logic as create.
  - COMPLETED transfers are refused.
- `UndoStockTransferUseCase` + `POST /transfers/:id/undo`
  - COMPLETED transfers now have a one-click **Undo** path.
  - Undo creates and completes a mirror-image transfer (source/destination swapped, same lines), then links the documents with `reversesTransferId` / `reversedByTransferId`.
  - It does **not** hard-delete posted movements or GL entries. The original remains visible for audit; the reversal is traceable.
  - Guards: only COMPLETED transfers can be undone; already-undone transfers and reversal transfers cannot be undone again.
- `frontend/src/modules/inventory/pages/StockTransfersPage.tsx`
  - DRAFT rows now show **Edit**, **Complete**, **Delete**.
  - COMPLETED rows now show **Undo** unless already undone or themselves a reversal.
  - Raw `window.confirm` was replaced with shared `ConfirmDialog`.
- `backend/prisma/schema.prisma` and `PrismaStockTransferRepository`
  - Added reversal-link fields to preserve SQL migration parity.
- `backend/src/tests/application/inventory/StockTransferCorrectionUseCase.test.ts`
  - Covers draft edit, completed-only undo, double-undo refusal, and reversal-undo refusal.

### Accounting / ERP impact

Negative stock is now opt-in, not opt-out. This is the safer ERP control posture: stock and cost can only go below zero when the company deliberately allows it. When disabled, `RecordStockMovementUseCase.processOUT` still throws before mutating stock levels or creating movement/ledger effects.

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/domain/inventory/InventorySettings.test.ts backend/src/tests/application/inventory/NegativeStockEnforcement.test.ts` passed.
- `npm --prefix backend run build` passed.
- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed with existing bundle/Browserslist warnings.

### Transfer follow-up verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/inventory/NegativeStockEnforcement.test.ts` → 7/7 (incl. 3 new transfer cases).
- `npm --prefix backend test -- --runInBand backend/src/tests/application/inventory` → 56/56 (full inventory suite, transfer valuation tests unaffected).
- `npm --prefix backend run build` passed; compiled `lib/` carries the transfer guard.
- `npm --prefix backend test -- --runInBand backend/src/tests/application/inventory/CancelStockTransferUseCase.test.ts backend/src/tests/application/inventory/StockTransferCorrectionUseCase.test.ts backend/src/tests/application/inventory/StockTransferValuedVoucher.test.ts` → 12/12.
- `npm --prefix frontend run typecheck` passed.

## End-User View

For new companies, Inventory will reject any stock issue that would make quantity negative unless the admin intentionally enables **Allow Negative Stock** in Inventory Settings and saves it.

Admins now see a normal **Save Settings** button inside the Inventory Settings section, so changing the checkbox has a clear save action.

## Remaining Review

- Owner should hard refresh/restart the frontend and rerun GP02 step 9 on the fresh company.
- If the stock row already reached `-1`, reverse it with a correcting stock adjustment after the code is rebuilt, or recreate the item/test sequence on a clean item.
