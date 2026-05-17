# Inventory Module — Master Plan

> **Module ID:** `inventory`
> **Dependencies:** `accounting` (shared currencies, periods, COA integration)
> **Priority:** Phase 1 (prerequisite for Sales & Purchases)

## Business Context

The Inventory module manages items (products, services, raw materials), warehouses, stock levels, and stock movements. It is the **foundation** for both Sales and Purchases — items created here are referenced by invoices, POs, and SOs.

## Current State

Existing stubs:
- **Domain entities:** `Item` (basic), `Warehouse` (basic), `StockMovement` (basic) in `backend/src/domain/inventory/entities/`
- **Repository interfaces:** `IItemRepository`, `IWarehouseRepository`, `IStockMovementRepository` in `backend/src/repository/interfaces/inventory/`
- **Firestore implementation:** `FirestoreInventoryRepositories.ts` (basic CRUD)
- **Module registration:** `InventoryModule.ts` registered in `modules/index.ts`
- **Frontend pages:** `InventoryHomePage`, `ItemsListPage` (placeholders)
- **Prisma schema:** Basic `Item` model exists

All stubs need significant expansion.

## Architectural Decisions

### AD-1: Firestore Save Path Pattern
Follow existing `SettingsResolver` tier system:
```
companies/{companyId}/inventory/Settings        → Module settings
companies/{companyId}/inventory/Data/items       → Items collection
companies/{companyId}/inventory/Data/warehouses  → Warehouses collection
companies/{companyId}/inventory/Data/categories  → Item categories
companies/{companyId}/inventory/Data/stock_levels → Materialized stock
companies/{companyId}/inventory/Data/stock_movements → Movement history
```

### AD-2: Shared Accounting Data
Items reference accounting COA accounts for automatic journal entries:
- `salesAccountId` → Revenue account (used by Sales module)
- `purchaseAccountId` → Expense/COGS account (used by Purchases module)
- `inventoryAccountId` → Asset account (for tracked items, Inventory control)

These are **account IDs** from the existing Chart of Accounts — no new accounting entities.

### AD-3: DB-Agnostic Pattern
- Repository interface first → Firestore implementation → Prisma schema ready
- Domain entities are plain TypeScript classes (no Firestore-specific types)
- All persistence logic isolated in `infrastructure/firestore/repositories/inventory/`

### AD-4: Stock Level as Materialized View
`StockLevel` is a computed aggregate (not a raw transaction log). It is updated atomically when `StockMovement` records are created via use cases. This avoids expensive real-time aggregation queries.

## Feature Index

| # | Feature | File | Est. Effort |
|---|---------|------|-------------|
| 01 | Item Management (CRUD + Categories) | [01-item-management.md](./features/01-item-management.md) | 3-4 days |
| 02 | Warehouse Management | [02-warehouse-management.md](./features/02-warehouse-management.md) | 1-2 days |
| 03 | Stock Levels & Movements | [03-stock-levels-movements.md](./features/03-stock-levels-movements.md) | 3-4 days |
| 04 | Stock Adjustments & Transfers | [04-stock-adjustments-transfers.md](./features/04-stock-adjustments-transfers.md) | 2-3 days |
| 05 | Inventory Dashboard & Reports | [05-inventory-dashboard-reports.md](./features/05-inventory-dashboard-reports.md) | 2-3 days |
| 06 | COA Alignment & Accounting Integration | [06-coa-alignment.md](./features/06-coa-alignment.md) | 1-2 days |

## COA Requirements

The Chart of Accounts must include these control accounts (auto-created during module initialization or manually mapped by user):

| Account | Classification | Purpose |
|---------|---------------|---------|
| Inventory (Asset) | ASSET | Tracks value of on-hand stock |
| Cost of Goods Sold | EXPENSE | Recognized when goods are delivered |
| Purchase Returns | EXPENSE (contra) | Returns to vendors |
| Sales Returns | REVENUE (contra) | Returns from customers |
| Stock Adjustment | EXPENSE | Manual stock adjustments |

## Execution Order

1. **Feature 06** — COA alignment (ensures accounts exist)
2. **Feature 01** — Items (core entity)
3. **Feature 02** — Warehouses
4. **Feature 03** — Stock levels & movements
5. **Feature 04** — Adjustments & transfers
6. **Feature 05** — Dashboard & reports

## Agent Instructions

Each feature file is self-contained. An executing agent should:
1. Read the feature file completely
2. Implement all listed files in order
3. Run the verification steps
4. Report results to the auditing agent

**Critical rules:**
- Follow `SettingsResolver` path patterns for Firestore
- Use `BaseFirestoreRepository` pattern for implementations
- Share accounting data (currencies, periods) via existing repos
- Never create parallel accounting entities — reference existing ones
- All new collections scoped by `companyId`
