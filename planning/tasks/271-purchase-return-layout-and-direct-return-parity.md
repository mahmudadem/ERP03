# Task 271 - Sales/Purchase Return Layout Parity and Direct Purchase Return

**Status:** Planned  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Created:** 2026-06-26  
**Estimated time:** 6-10 hours  
**Priority:** P1 purchase workflow parity follow-up from manual QA

## Context

Manual QA of Purchase Return from a posted Purchase Invoice passed accounting reversal checks, but exposed workflow and UX gaps:

- New Purchase Return page still shows raw source ids such as `Purchase Invoice ID`.
- The layout does not match the newer SI/PI document detail pattern.
- The return lines table opens with too many empty rows and feels unlike the current document pages.
- Vendor selector label says `customer or vendor`.
- Purchase Return is source-driven only; user requested a **direct return** option, not only return-from-PI/GRN/source.

Owner then clarified the scope: **Sales Return and Purchase Return both need UI/layout parity with Sales Invoice**, including buttons, controls, document chrome, and posted-view treatment.

This task should modernize Sales Return and Purchase Return without changing existing posted SR/PR voucher output for source-based returns.

## Goal

Bring Sales Return and Purchase Return to the same document UX standard as Sales Invoice / Purchase Invoice, and add a direct purchase return workflow.

## Scope

In scope:

- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx` or current PR page equivalent.
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx` or current SR page equivalent.
- Purchase Return API/types if direct return requires payload support.
- Backend Purchase Return use case only where direct return needs explicit support.
- Focused tests for direct return validation/posting.
- Docs/planning updates.

Out of scope:

- Changing existing source-based SR/PR accounting output.
- Changing Purchase Invoice posting.
- Changing Sales Invoice posting.
- Non-recoverable tax behavior from Task 269.
- Broader document layout refactor across other vouchers.

## Shared UX Requirements for SR and PR

### Layout

Rework Sales Return and Purchase Return detail/create pages to align with the current Sales Invoice / Purchase Invoice document detail pattern:

- Header with document number/status pills.
- Source mode segmented control.
- Header fields as business labels, not raw ids.
- Source document fields must use selector/search controls, not hand-typed ids.
- Side rail for status, settlement/account impact, totals, and warnings where appropriate.
- Footer action bar matching document pages.
- Compact return lines table with only a small number of blank rows by default.
- Customer/vendor-specific selector labels.
- Use shared selectors:
  - `PartySelector` with vendor role.
  - `PartySelector` with customer role.
  - `ItemSelector`.
  - `WarehouseSelector`.
  - `TaxCodeSelector`.
  - shared `DatePicker`.
- Posted view should be read-only and expose legal actions only.
- Buttons/controls should match SI/PI density and placement:
  - Back to list
  - New
  - Post
  - GL Impact
  - source fetch/load action where applicable
  - attachment/print/export placeholders only where already supported.

### GL Impact Requirement

SR and PR posted document pages must expose a **GL Impact** action consistent with SI/PI.

For stock returns, the GL Impact modal must show all vouchers for the return together:

- Sales Return:
  - revenue/tax reversal voucher
  - COGS/inventory reversal voucher
- Purchase Return:
  - AP/tax/inventory or GRNI/inventory reversal voucher, depending on return context

The modal must not show only the first voucher when multiple vouchers exist. Voucher role badges should use return-appropriate wording, not only invoice/revenue wording.

### Sales Return Modes

Sales Return should match SI layout and controls.

If current business behavior supports only source-based returns, preserve it, but the UI should still avoid raw ids and use source selectors/search.

Potential modes:

- From SI
- Direct sales return, only if already supported or a safe design exists.

Source selection requirement:

- `From SI` must use a Sales Invoice selector/search, not a raw Sales Invoice ID input.
- Selector should show invoice number, customer, date, status, total, and outstanding/returnable quantity context where available.
- Selecting an SI should populate customer and allow fetching returnable lines.

Direct Sales Return is **not required** in this task unless the current backend already supports it safely. If adding direct SR would require new accounting decisions, log a follow-up instead.

### Purchase Return Modes

Purchase Return should show:

- `Direct`
- `From PI`
- `From GRN`

Source selection requirement:

- `From PI` must use a Purchase Invoice selector/search, not a raw Purchase Invoice ID input.
- `From GRN` must use a Goods Receipt selector/search, not a raw Goods Receipt ID input.
- Selectors should show document number, vendor, date, status, total/receipt context, and returnable quantity context where available.
- Selecting a PI/GRN should populate vendor and allow fetching returnable lines.

## Source-Based Return

Existing source-based flow must remain:

- Sales Return from Sales Invoice.
- From Purchase Invoice (`AFTER_INVOICE`).
- From Goods Receipt (`BEFORE_INVOICE`) if currently supported.
- Fetch items from source.
- Preserve source quantities/cost/tax behavior.

## Direct Purchase Return

Add a direct purchase return option where no source PI/GRN is required.

User should be able to:

- Choose vendor.
- Choose warehouse.
- Add item lines manually.
- Enter return qty, UOM, unit cost, tax code, discount if supported by current PR model.
- Post the PR directly.

Accounting rules for direct return must be explicit:

- If returning stock that exists in inventory, reduce inventory at the appropriate cost basis.
- If direct return has no source PI/GRN, the system must define whether unit cost is user-entered return cost or inventory cost.
- AP/vendor account impact must be clear.
- Tax reversal must follow the selected tax code and price basis.

Recommended v1 direct-return rule:

- Direct PR is a vendor credit/debit note style return.
- User-entered unit cost drives AP/tax document amount.
- Inventory reduction should use inventory core cost if stock-tracked and available; if this conflicts with AP amount, stop and design variance handling.

If current inventory/posting architecture cannot safely support direct PR without source cost snapshots, stop and propose a narrower design before implementation.

## Backend Requirements

1. Confirm current `PostPurchaseReturnUseCase` supports a direct/no-source context. If not, add it deliberately.
2. Confirm Sales Return source-based behavior remains unchanged.
3. Add validation for direct purchase returns:
   - vendor required.
   - warehouse required for stock lines.
   - item lines required.
   - qty > 0.
   - no raw/free-text master-data ids from frontend.
4. Preserve existing source-based SR and PR tests and voucher golden outputs.
5. Add direct PR tests:
   - draft/create direct return.
   - post direct return.
   - voucher output.
   - inventory movement.
   - tax inclusive/exclusive behavior if current PR supports tax code selection.

## Frontend Requirements

1. Sales Return page opens in list/detail style consistent with Sales Invoice.
2. Purchase Return page opens in list/detail style consistent with Purchase Invoice.
3. `New Purchase Return` supports mode selection:
   - Direct
   - From PI
   - From GRN
4. `New Sales Return` should use source selectors/search instead of raw ids, and match SI controls.
5. `New Purchase Return` should use Purchase Invoice and Goods Receipt selectors/search instead of raw ids, matching the source selection quality already used on PI where applicable.
6. From-source fields should use selectors/search, not raw id inputs.
7. Direct PR mode hides source id fields.
8. From-source mode labels show source numbers/names, not raw ids.
9. Line tables should not render a long stack of empty rows on first load.
10. Posted SR and PR views should include `GL Impact` / voucher visibility consistent with SI/PI if not already present.
11. SR/PR GL Impact must group all vouchers created by the return source document in one modal.

## Acceptance Criteria

- Source-based SR still posts the same voucher output as before.
- Source-based PR still posts the same voucher output as before.
- Direct PR can be created and posted without a PI/GRN source.
- Direct PR accounting and inventory movement are tested and documented.
- PR page no longer exposes raw source id fields as the main workflow.
- SR page no longer exposes raw Sales Invoice ID fields as the main workflow.
- PR page no longer exposes raw Purchase Invoice / Goods Receipt ID fields as the main workflow.
- SR and PR pages visually follow SI/PI document detail conventions.
- SR GL Impact shows both revenue/tax reversal and COGS/inventory reversal for stock returns.
- PR GL Impact shows the complete reversal voucher set for the purchase return context.
- Vendor selector text is vendor-specific.
- Customer selector text is customer-specific.
- Frontend and backend verification pass.

## Verification Commands

Run from `D:\DEV2026\ERP03-267-engine-audit`:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseReturnGoldenVoucher.test.ts
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseReturnUseCases.test.ts
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesReturnGoldenVoucher.test.ts
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesReturnUseCases.test.ts
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesPostingUseCases.test.ts
npm --prefix backend run build
npm --prefix frontend run typecheck
npm --prefix frontend run build
git diff --check
```

Adjust focused test names if the repo has more specific PR UI/API suites.

## Stop Conditions

- If direct PR needs accounting behavior that conflicts with current inventory costing, stop and propose a design.
- If source-based SR or PR golden output drifts, stop; do not update expectations without approval.
- If the layout change becomes too large, split into two implementation slices:
  - 271-A Sales Return layout parity + Sales Invoice selector.
  - 271-B Purchase Return layout parity + Purchase Invoice/GRN selectors + direct PR.
- Do not add raw id entry fields for vendor/item/warehouse/tax code.
- Do not add raw id entry fields for source SI/PI/GRN documents.

## Owner QA Script

1. Open Sales -> Returns -> New.
2. Confirm the page matches Sales Invoice document layout and uses selectors/search for source SI/customer.
3. Post a Sales Return from an SI and confirm voucher/GL Impact are unchanged.
4. Open Purchases -> Returns -> New.
5. Confirm mode control shows `Direct`, `From PI`, and `From GRN`.
6. In `From PI`, select a posted PI by number/name, fetch source lines, post return.
   - Expected: same voucher behavior as current PR test.
7. In `Direct`, choose vendor, warehouse, item, qty, cost, tax code, then post.
   - Expected: PR posts without source id.
8. Open posted SR and PR.
   - Expected: modern document layout, GL Impact available, voucher lines balanced.
