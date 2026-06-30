# 278b — Purchase item-management API route

**Status:** Ready for commit and deployment  
**Estimated time:** 0.5–1 hour  
**Actual time:** approximately 0.5 hour

## Technical developer view

The reused item list and item card derived API URLs from the browser route.
Purchases uses `/purchases/items` for navigation but its backend module is
mounted at `/tenant/purchase/items`. The browser consequently called the
nonexistent `/tenant/purchases/items` route.

Changed:

- `ItemsListPage.tsx` now keeps Purchases navigation and API paths separate.
- `ItemMasterCard.tsx` uses the singular Purchase API prefix for load/save.
- Inventory architecture and the item-list user guide document the contract.

Tenant isolation and permission checks are unchanged. The existing Purchase
catalog doorway continues to use `purchase.items.view` and
`purchase.items.manage`.

## End-user view

Purchases -> Products & Services can load and manage the same item catalog used
by the other operational modules. The page no longer displays “Endpoint not
found.”

## Verification

- Frontend TypeScript check: passed.
- Full frontend production build and report/action guards: passed.
- LAN Vite process restarted on port 5173 after dependency restoration.

## Acceptance criteria

- Purchase item list/search uses `/tenant/purchase/items`.
- Purchase item load/create/update uses `/tenant/purchase/items`.
- Browser navigation remains `/purchases/items`.
- Other module item routes remain unchanged.
