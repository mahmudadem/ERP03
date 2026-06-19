# Task 243 — Pricing policy management and per-form settings

**Status:** Planned (owner-requested 2026-06-19). **Builds on:** [241](./241-party-item-price-memory.md) + [242](./242-strict-pricing-policy-resolution.md).
**Module:** Sales + Purchases + Inventory (cross-cutting) + Form Designer.
**Source:** owner manual-test notes [NOTE-15, 16, 17, 18](../qa/241-manual-test-notes.md).

## Goal
Turn pricing policy and future form-level behavior from hidden/global settings into a **user-controlled, per-form settings system**.

The key concept is **form instance settings**, not document-type settings. A native React form and a Form-Designer form that both create a Sales Invoice may have different settings because they are different forms used for different workflows.

Examples:
- Native Sales Invoice form -> `LAST_PARTY_PRICE`.
- Wholesale Sales Invoice clone -> `PRICE_LIST`.
- Retail Sales Invoice clone -> `ITEM_DEFAULT` or `LAST_PARTY_PRICE`.

This task must make **Forms Management** the central place where users see and configure every form in a module:
- built-in/native forms shipped by the module;
- locked default designer forms;
- user-created or cloned designer forms.

Each form row should expose a **Form Settings** action. The settings surface starts with defaults, but it must be named and structured as broader **form settings** so later tabs can add non-default behavior without a new concept.

## Scope (four parts)

### Part A — Selectable pricing policy at two levels (NOTE-15)
- **Document level:** the user can choose the line-price source — `PRICE_LIST` / `LAST_PARTY_PRICE` (this customer/vendor's last) / `LAST_EVENT` (last sold/bought to anyone) / `ITEM_DEFAULT`. Builds on `InventorySettings.defaultLinePriceSource` (added in 241). Resolution stays **strict** per [242](./242-strict-pricing-policy-resolution.md) — selecting a policy picks the single active source.
- **Party level:** assign a party to a **price list** (e.g. Wholesale). Customer/vendor master gains a default price-list link (some of this already exists: `customer.defaultPriceListId` / `customerGroup.defaultPriceListId` — reconcile, don't duplicate). Party level = price lists only.

### Part B — Forms Management: per-form settings (NOTE-16, revised by owner 2026-06-19)
Do **not** build settings per document type. Build settings per actual form.

#### B1. Forms Management list includes built-in/native forms
Extend the existing module **Forms Management** page so it lists all forms known to that module:
- **Built-in/native forms**: React pages shipped by the module, represented with stable built-in form keys such as `native.sales.invoice`, `native.purchase.invoice`, `native.sales.order`.
- **Default designer forms**: locked system/default Form-Designer forms already installed for the company/module.
- **Cloned/custom designer forms**: user-created forms from the Form Designer.

The user should be able to open settings for each listed form. Built-in/native forms are not layout-editable designer forms, but they are configurable through the same Form Settings action.

#### B2. Form Settings modal
Each form row gets a **Settings** action that opens a modal for that exact form. The modal should use vertical tabs because settings will grow over time.

Initial tab order:
1. **Account Defaults**
   - First visible tab, even if the first implementation only wires the safe subset.
   - Future home for default cash/bank account, AR/AP account where appropriate, cost center, salesperson, default warehouse, and other accounting/dimension defaults.
   - Any account default must remain visible on the final document and pass normal validation. It must never become a hidden posting rule.
2. **Pricing Behavior**
   - Contains the line price source default for that form: `PRICE_LIST`, `LAST_PARTY_PRICE`, `LAST_EVENT`, `ITEM_DEFAULT`.
   - Applies to new documents opened through that form.
   - Strict resolution from Task 242 remains unchanged: a selected source miss leaves the price blank/manual; no fallback chain.

Later tabs may be added for numbering behavior, workflow behavior, approval/help text, UI behavior, or other per-form options. The storage model should not require a schema migration for every new tab.

#### B3. Store settings generically per form instance
Design the backend contract as a generic per-form settings store, not a document-type settings table.

Identity should support both:
- `builtInFormKey` for native forms;
- `formId` for persisted designer forms.

The record should also carry enough context for validation and listing:
- `companyId`
- `module`
- `documentKind` / voucher type being produced
- `formKind` (`BUILT_IN_NATIVE`, `DESIGNER_DEFAULT`, `DESIGNER_CLONE`)
- `settings` object grouped by tab/namespace, for example:

```ts
{
  accountDefaults: {
    defaultWarehouseId?: string;
    defaultCashAccountId?: string;
    defaultCostCenterId?: string;
  },
  pricingBehavior: {
    linePriceSource?: 'PRICE_LIST' | 'LAST_PARTY_PRICE' | 'LAST_EVENT' | 'ITEM_DEFAULT';
  }
}
```

#### B4. Cloning behavior
When a Form-Designer form is cloned, its Form Settings should clone with it. The clone starts with the same settings as the source form, then can be edited independently.

This is required because cloning a form means cloning its workflow/persona, not only its visual layout. Example: cloning a Wholesale Sales Invoice form should copy its `PRICE_LIST` behavior unless the user changes it.

#### B5. Initial implementation boundary
For the first 243-B implementation, keep the behavior narrow:
- add the per-form settings model and API;
- show built-in/native forms in Forms Management;
- add the Form Settings modal with vertical tabs;
- wire **Pricing Behavior** end-to-end for at least Sales Invoice and Purchase Invoice native forms, plus one designer-rendered form path if already available through the shared resolver;
- expose **Account Defaults** as the first tab and persist safe account/default values only where the target document already has a visible, validated field.

If account-default application needs broader accounting decisions, persist the tab structure now but defer applying risky account defaults until the exact document field and posting validation path are clear.

### Part C — Per-document right-click override (NOTE-18)
On a sales/purchase document line table, **right-clicking the Price column** opens a context menu to **override the pricing policy for this one document** (e.g. switch this invoice to `PRICE_LIST` or manual and re-resolve the lines). A per-document override layered on top of the company/party default. Needs a small context-menu component + a re-resolve action over current lines.

### Part D — Native ↔ Form-Designer parity (NOTE-17, standing principle)
All of the above must work under one concept for native document pages **and** Form-Designer-rendered forms. The shared line-price resolvers (`salesLinePriceResolver.ts` / `purchaseLinePriceResolver.ts`) are already shared by both surfaces — keep that. **If the Form Designer is missing any capability the native page has (or vice-versa), add it** so the two stay at feature parity. This is a general rule for this codebase, not just pricing.

For 243-B specifically, parity means:
- built-in/native forms appear in Forms Management as configurable forms;
- designer/default/cloned forms appear in the same list;
- both native and designer forms can read a form-level `pricingBehavior.linePriceSource`;
- cloned designer forms copy their source settings.

## Key existing code to reuse / reconcile
- Resolver (shared, both surfaces): `frontend/src/modules/sales/services/salesLinePriceResolver.ts`, `.../purchases/services/purchaseLinePriceResolver.ts`.
- Effective price API + `source` field: `frontend/src/api/salesMasterDataApi.ts`.
- Backend resolution: `PriceListUseCases.ts` (sales) / `PurchasePriceListUseCases.ts` (purchases).
- Price lists module: see `planning/done/131-purchase-price-lists.md`.
- Settings enum: `InventorySettings.defaultLinePriceSource`.
- Existing Forms Management surface: `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx` and `frontend/src/modules/tools/pages/ToolsFormsDesignerPage.tsx`.
- Existing form APIs: `frontend/src/api/voucherFormApi.ts` and backend voucher/form controller/repository paths.
- Existing form grouping/sidebar policy docs: `docs/architecture/sidebar-forms-grouping.md`, `docs/user-guide/forms-management.md`.

## Recommended implementation plan for 243-B

Estimated time: 4-6 hours for the first safe slice, assuming no major Form Designer API gap.

1. **Repository orientation and final file map (30-45 min)**
   - Inspect existing Forms Management list composition, form metadata shape, clone flow, form APIs, and native route registry.
   - Confirm where built-in/native form definitions should be declared so they are not hardcoded in multiple pages.

2. **Backend per-form settings contract (60-90 min)**
   - Add a repository interface for company-scoped form settings.
   - Add Firestore implementation with company scoping.
   - Add use cases: list/get, upsert, clone/copy settings.
   - Keep the settings payload generic and namespace-based (`accountDefaults`, `pricingBehavior`, future namespaces).
   - Register through DI. Do not instantiate Firestore repositories directly in controllers/use cases.

3. **Form Management listing integration (60-90 min)**
   - Add built-in/native forms to the existing Forms Management list with stable keys.
   - Clearly distinguish built-in/native, default designer, and cloned/custom forms.
   - Add a Settings action per row without making built-in/native forms layout-editable.

4. **Form Settings modal (90-120 min)**
   - Build modal with vertical tabs.
   - First tab: **Account Defaults**.
   - Second tab: **Pricing Behavior**.
   - Use shared selectors for any master-data/account/warehouse fields. No raw ID inputs.
   - Use toast feedback on save/error.
   - Add i18n strings.

5. **Apply pricing behavior defaults (60-90 min)**
   - Load the selected form's `pricingBehavior.linePriceSource` when creating a document.
   - Apply first to Sales Invoice and Purchase Invoice native forms.
   - If a designer-rendered sales/purchase form already flows through the shared resolver with a stable form id, wire the same setting there too.
   - Keep precedence explicit:

```text
Manual line edit
  > per-document/session override from 243-C
  > per-form setting from 243-B
  > company default InventorySettings.defaultLinePriceSource
```

6. **Clone propagation (30-60 min)**
   - When cloning a designer form, copy the source form settings to the clone.
   - Built-in/native form settings are not cloned directly unless a native form is used as the base for a designer clone; if that path exists, decide explicitly whether defaults should be copied.

7. **Docs and verification (45-60 min)**
   - Update `docs/architecture/pricing.md` and add/update a form-settings architecture doc.
   - Update `docs/user-guide/forms-management.md`.
   - Add `planning/done/243b-per-form-settings.md`.
   - Update `planning/JOURNAL.md`, `planning/ACTIVE.md`, and `planning/PRIORITIES.md`.
   - Run focused backend tests, backend build, frontend typecheck/build.

## Acceptance / QA
- Forms Management shows built-in/native forms alongside designer default and cloned forms for the module.
- Each form row has a Form Settings action.
- Form Settings opens a vertical-tabs modal with **Account Defaults** first and **Pricing Behavior** second.
- User can save a per-form pricing behavior and see new documents opened through that form use the configured line price source (strict, per 242).
- A party assigned to a price list defaults its documents from that list.
- Right-click on a line's Price column overrides the policy for that document and re-resolves lines; override is clearly indicated.
- Cloning a designer form copies its form settings, and editing the clone's settings does not mutate the source form.
- Account Defaults tab exists and persists safe values; any value that affects posting remains visible/editable on the document and passes normal validation before post/save.
- Identical per-form pricing behavior verified on a native form and a Form-Designer form for the same document kind where the renderer path is available.
- Firestore + SQL parity; no backfill (no production data).

## Out of scope
Contract/effective-dated pricing (reserved in 241). Volume/tier pricing. Hidden account posting rules. Full dynamic posting scripts. Automatic defaulting for every possible form field without type/financial safety review.

## Definition of Done
Code merged · `docs/architecture/pricing.md` + a form-settings architecture doc · user-guide pages · `planning/done/243b-*.md` report (QA script) · JOURNAL + ACTIVE updated.
