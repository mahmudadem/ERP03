# Task 243 — Pricing policy management (selectable policy, per-party assignment, per-document override, document settings)

**Status:** Planned (owner-requested 2026-06-19). **Builds on:** [241](./241-party-item-price-memory.md) + [242](./242-strict-pricing-policy-resolution.md).
**Module:** Sales + Purchases + Inventory (cross-cutting) + Form Designer.
**Source:** owner manual-test notes [NOTE-15, 16, 17, 18](../qa/241-manual-test-notes.md).

## Goal
Turn the pricing policy from a hidden company setting into a **user-controlled, multi-level, overridable** system, surfaced consistently on native document pages **and** Form-Designer forms.

## Scope (four parts)

### Part A — Selectable pricing policy at two levels (NOTE-15)
- **Document level:** the user can choose the line-price source — `PRICE_LIST` / `LAST_PARTY_PRICE` (this customer/vendor's last) / `LAST_EVENT` (last sold/bought to anyone) / `ITEM_DEFAULT`. Builds on `InventorySettings.defaultLinePriceSource` (added in 241). Resolution stays **strict** per [242](./242-strict-pricing-policy-resolution.md) — selecting a policy picks the single active source.
- **Party level:** assign a party to a **price list** (e.g. Wholesale). Customer/vendor master gains a default price-list link (some of this already exists: `customer.defaultPriceListId` / `customerGroup.defaultPriceListId` — reconcile, don't duplicate). Party level = price lists only.

### Part B — Document Settings / Management page (NOTE-16)
A page to configure **per-document-type defaults** for native documents, **extensible** so options can be added later. Initial options:
- **Pricing policy** (Part A).
- **Default accounts / dimensions:** default cash/bank account, default warehouse, default salesperson, default cost center, … per document type.
- Design the store generically (key/value per document type) so new defaults don't need schema churn.

### Part C — Per-document right-click override (NOTE-18)
On a sales/purchase document line table, **right-clicking the Price column** opens a context menu to **override the pricing policy for this one document** (e.g. switch this invoice to `PRICE_LIST` or manual and re-resolve the lines). A per-document override layered on top of the company/party default. Needs a small context-menu component + a re-resolve action over current lines.

### Part D — Native ↔ Form-Designer parity (NOTE-17, standing principle)
All of the above must work the **same** on native document pages **and** Form-Designer–rendered forms. The shared line-price resolvers (`salesLinePriceResolver.ts` / `purchaseLinePriceResolver.ts`) are already shared by both surfaces — keep that. **If the Form Designer is missing any capability the native page has (or vice-versa), add it** so the two stay at feature parity. This is a general rule for this codebase, not just pricing.

## Key existing code to reuse / reconcile
- Resolver (shared, both surfaces): `frontend/src/modules/sales/services/salesLinePriceResolver.ts`, `.../purchases/services/purchaseLinePriceResolver.ts`.
- Effective price API + `source` field: `frontend/src/api/salesMasterDataApi.ts`.
- Backend resolution: `PriceListUseCases.ts` (sales) / `PurchasePriceListUseCases.ts` (purchases).
- Price lists module: see `planning/done/131-purchase-price-lists.md`.
- Settings enum: `InventorySettings.defaultLinePriceSource`.

## Acceptance / QA
- User can change the document-level policy and see line defaults change accordingly (strict, per 242).
- A party assigned to a price list defaults its documents from that list.
- Right-click on a line's Price column overrides the policy for that document and re-resolves lines; override is clearly indicated.
- Document Settings page persists per-document-type defaults (pricing + at least one default account) and they apply on new documents.
- Identical behavior verified on a native page **and** a Form-Designer form for the same document type.
- Firestore + SQL parity; no backfill (no production data).

## Out of scope
Contract/effective-dated pricing (reserved in 241). Volume/tier pricing.

## Definition of Done
Code merged · `docs/architecture/pricing.md` + a document-settings architecture doc · user-guide pages · `planning/done/243-*.md` report (QA script) · JOURNAL + ACTIVE updated.
