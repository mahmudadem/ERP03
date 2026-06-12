# Deferred Task — Per-Item Promotions from the Item Card

**Status:** Deferred / backlog
**Logged:** 2026-06-12 (during Task 204 line-discount QA)
**Owner decision:** Promotions must be manageable from **two** entry points, both
writing to the same promotion-rule store:

1. **System-wide** — the existing Promotions page (`/sales/promotions`,
   [PromotionsPage.tsx](../../frontend/src/modules/sales/pages/PromotionsPage.tsx)).
   Stays as-is: create/list/edit rules across ALL / ITEMS / CATEGORIES scopes.
2. **Per-item** — a new **Promotions** section/tab on the **Item Card**
   (`ItemMasterCard`) for creating and viewing promotions scoped to that one
   item. Opening it pre-selects the current item; the list shows only rules that
   target this item.

## Why

A user editing a specific item (e.g. a "buy 5 get 1 free" reward) should be able
to set up its promotion right there, without leaving the item to go find the
global Promotions page and re-pick the item. The global page stays for
cross-item / category / store-wide campaigns.

## Single source of truth

Both UIs read/write the same promotion rules — **do not** fork the data model:
- API: `salesOperationalApi` promotions endpoints (`/tenant/sales/promotions`):
  `listPromotions`, `getPromotion`, `createPromotion`, `updatePromotion`,
  `deletePromotion` ([salesOperationalApi.ts](../../frontend/src/api/salesOperationalApi.ts)).
- DTO: `PromotionRuleDTO` — `type: 'BUY_X_GET_Y' | 'THRESHOLD_DISCOUNT'`,
  `scope: 'ALL' | 'ITEMS' | 'CATEGORIES'`, plus the item/category target lists.
- Engine: server-side evaluation already runs at invoice/order **create** time and
  appends free-goods / discount lines (see the free-goods push in
  [SalesInvoiceUseCases.ts](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts)
  around the `promoResult.freeGoods` loop). No engine change needed.

## Scope of work

**Frontend (primary):**
- Add a **Promotions** tab/section to `ItemMasterCard`.
  - List: `listPromotions()` filtered to rules whose `scope === 'ITEMS'` and whose
    target item list includes this item id (and arguably category-scoped rules
    that match the item's category, shown read-only as "inherited").
  - Create/Edit: reuse the same form the global page uses (extract the rule
    editor from `PromotionsPage` into a shared component if it isn't already), with
    the current item pre-filled and `scope` defaulted to `ITEMS`.
  - Delete/deactivate from the item card too.
- Keep the global Promotions page unchanged.

**Backend:** likely none — verify `listPromotions` supports filtering by item, or
filter client-side. Add a query param (e.g. `?itemId=`) only if list payloads get
large.

## Acceptance

- From an Item Card, create a BUY_X_GET_Y rule scoped to that item; it then fires
  on a new invoice for that item (free-goods line appears, badged **FREE • PROMO**).
- The same rule is visible/editable from the global Promotions page (one record,
  two views).
- Editing the rule in either place reflects in the other.

## Related

- Free-goods lines are now badged in the document grid (Task 204 QA follow-up):
  backend DTO passes `appliedPromotionId`/`appliedPromotionName`; the SI line grid
  renders a `FREE • PROMO` badge.
- ACTIVE.md carried-forward note: "Promotion evaluator built + tested" — the
  evaluator is live on create; this task is purely about a second management UI.
