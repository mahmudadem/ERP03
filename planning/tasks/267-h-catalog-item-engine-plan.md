# Task 267-H — Catalog/Item Engine and Doorways Plan

## 1. Goal and Motivation
Make item/catalog management an always-on shared engine with module doorways.

Currently, POS, Sales, Purchases, and Inventory all consume `Item` entities. However, item creation and management (default tax, account, price setup) are tied to the Inventory module. A tenant may have POS enabled but Inventory disabled, yet still needs to manage their items. We must extract item management into a shared `ICatalogCore` engine that is always available, and provide doorways to it from every relevant module.

## 2. Shared Engine Contracts (`ICatalogCore` / `IItemCatalogCore`)
We will introduce `ICatalogCore` inside `application/system-core/contracts/` and implement it in `application/system-core/catalog/`.

### 2.1 Domain & Repository extraction
- Keep `Item` entity in `domain/inventory/entities/Item.ts` for now or move it to `domain/system-core/catalog/`. Moving it is safer but requires updating many imports. A hybrid approach keeps the entity in inventory but moves the use-cases to system-core. Let's move the use cases first.
- The `IItemRepository` will be used by the `CatalogCore`.

### 2.2 Use Cases
Extract existing item-related use cases from `inventory/use-cases/ItemUseCases.ts` into `system-core/catalog/use-cases/`:
- `CreateItemUseCase`
- `UpdateItemUseCase`
- `GetItemUseCase`
- `ListItemsUseCase`
- `DeleteItemUseCase` (if applicable)

These neutral use cases will enforce the core item business rules (e.g., unique item codes, UOM resolution, category assignment).

## 3. Module Doorways (API)
Instead of relying solely on `/tenant/inventory/items`, we will map the shared use cases to dedicated module endpoints. Each route will use its own permission guard and will not check if other modules are enabled.

- `GET/POST/PUT /tenant/pos/items` -> Calls `ICatalogCore`
- `GET/POST/PUT /tenant/sales/items` -> Calls `ICatalogCore`
- `GET/POST/PUT /tenant/purchases/items` -> Calls `ICatalogCore`
- `GET/POST/PUT /tenant/inventory/items` -> Calls `ICatalogCore`
- `GET/POST/PUT /tenant/settings/catalog/items` -> Calls `ICatalogCore` (Company Settings fallback)

## 4. Permission Model
We will define and enforce a neutral permission model at the doorway level:

**Base Permissions:**
- `catalog.items.view`
- `catalog.items.manage`

**Module Permissions:**
- `pos.items.manage`
- `sales.items.manage`
- `purchases.items.manage`
- `inventory.items.manage`

The API routes will require the corresponding module permission (e.g., `/tenant/pos/items` requires `pos.items.manage`). The `ICatalogCore` itself is purely logic and does not check HTTP permissions.

## 5. Frontend Doorways (UI)
We will refactor the shared `ItemsPage` and `ItemForm` components to be reusable across modules.

- **POS -> Items:** A dedicated POS Items management screen (`frontend/src/modules/pos/pages/PosItemsPage.tsx`).
- **Sales -> Items:** A Sales Items management screen (`frontend/src/modules/sales/pages/SalesItemsPage.tsx`).
- **Purchases -> Items:** A Purchase Items management screen (`frontend/src/modules/purchases/pages/PurchaseItemsPage.tsx`).
- **Inventory -> Items:** The existing Items screen, refactored to use the shared component and `ICatalogCore` API via the inventory doorway.
- **Settings -> Catalog:** A unified catalog setup screen in company settings for super-admins or catalog managers.

## 6. Architecture Guards
Add tests to `SystemCoreBoundaries.test.ts` to enforce that:
1. `ItemUseCases.ts` no longer exists in `application/inventory`.
2. Sales, Purchases, and POS do not bypass `ICatalogCore` to create/update items directly via repositories.
3. API doorways map correctly to `ICatalogCore` without cross-module dependencies (e.g., Sales API doesn't import Inventory controllers).

## 7. Execution Strategy
This plan will be implemented in a separate epic as it involves significant API and Frontend routing work.

**Recommended Slices for the Epic:**
- **Slice 1: Engine Extraction.** Move use cases to `system-core/catalog` and implement `ICatalogCore`.
- **Slice 2: API Doorways.** Create the module-specific API routes and permissions.
- **Slice 3: Frontend Refactor.** Refactor `ItemsPage` and wire it up to the new doorways in POS, Sales, Purchases, and Settings.
