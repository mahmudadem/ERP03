# Task 270 - Stock Level Reporting, Negative Valuation, and Item Movement

**Status:** Complete locally  
**Date:** 2026-06-26  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Estimated time:** 5-8 hours  
**Actual time:** ~3.1 hours

## Technical Developer View

Task 270 fixed stock-level reporting for allowed negative stock and added the Item Movement report.

Changed files:

- `backend/src/application/inventory/use-cases/StockLevelUseCases.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/api/dtos/InventoryDTOs.ts`
- `backend/src/tests/application/inventory/StockLevelUseCases.test.ts`
- `frontend/src/api/inventoryApi.ts`
- `frontend/src/modules/inventory/pages/StockLevelsPage.tsx`
- `frontend/src/modules/inventory/pages/ItemMovementReportPage.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/config/moduleMenuMap.ts`
- `docs/architecture/inventory.md`
- `docs/user-guide/inventory/README.md`

Backend behavior:

- `GetStockLevelsUseCase.executeReport(...)` now returns report valuation fields:
  - `reportUnitCostBase/CCY`
  - `reportValueBase/CCY`
  - `costBasis`
  - `unvaluedNegativeStock`
- Positive stock still uses moving average.
- Negative stock with missing average but existing last-known cost uses last-known cost for report value.
- Negative stock with no cost basis returns null report value and a warning flag instead of a silent zero.

Frontend behavior:

- Stock Levels now uses the mandatory `ReportContainer`.
- Stock Levels supports item, warehouse, zero-quantity, negative-stock, and view-mode filters.
- Negative valued stock is visually marked, and unvalued negative stock displays a warning.
- Item Movement is available under `Inventory -> Reports`.
- Item Movement requires an item, supports warehouse/date/source/direction/movement filters, and shows running quantity/value.
- Source references open known document routes; unsupported route types remain plain text.

## End-User View

Stock Levels now makes negative inventory financially visible. If an item is at `-2` and the system knows the cost is `1200`, the report shows value `-2400` instead of `0`. If the system does not know any cost, the report says the negative stock is unvalued so the user knows the stock needs correction.

The new Item Movement report shows the history of one item: receipts, issues, returns, transfers, adjustments, running quantity, and running value. It helps explain how the current stock balance was built.

## Verification

Passed:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/inventory/StockLevelUseCases.test.ts
npm --prefix backend test -- --runInBand src/tests/application/inventory/services/InventoryValuationService.test.ts
npm --prefix frontend run check:reports
npm --prefix frontend run typecheck
npm --prefix backend run build
npm --prefix frontend run build
git diff --check
```

Notes:

- `git diff --check` reported CRLF normalization warnings only.
- `graphify update .` was not run because `graphify` is not installed in this shell.

## Known Follow-Ups

- Item Movement drill-down is limited to document routes that currently exist in `routes.config.ts`.
- Existing `Inventory -> Movements` remains as the operational movement list; Item Movement is the report-style per-item audit view.
