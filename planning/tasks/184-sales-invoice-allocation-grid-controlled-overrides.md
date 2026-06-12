# Task 184 - Sales Invoice Allocation Grid: Controlled Invoice-Level Financial Overrides

**Status:** Ready for implementation planning  
**Created:** 2026-06-07  
**Owner:** Next implementation agent  
**Estimated effort:** 1.5-2.5 days if scoped to Sales Invoice only; 3-5 days if generalized for PI at the same time.  
**Recommended first slice:** Sales Invoice only, invoice-level allocations only.

---

## 1. Business Goal

The Sales Invoice detail page currently shows **Account Ledger & Financial Taxes Allocation Grid** as a mostly read-only preview. That is not enough for the intended ERP workflow.

The intended design is:

1. When the user edits invoice lines, tax codes, discounts, additions, and charges, the Allocation Grid is populated automatically.
2. The Allocation Grid shows the financial/accounting impact at the invoice level.
3. The user can override the account used for a populated allocation row directly inside the grid.
4. The user can add invoice-level rows for:
   - discount
   - addition / charge
   - additional tax / fee
5. For v1, allocations are **invoice-level only**, not per line. Do not build per-line allocation logic yet.
6. The totals shown in:
   - invoice lines
   - Allocation Grid
   - invoice footer totals
   - backend posting voucher

   must agree with each other.

This is not only a UI feature. It affects accounting correctness, posting, auditability, and tax reporting.

---

## 2. Current State

### Frontend

Main file:

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`

Current behavior:

- The page now shows an empty allocation-grid placeholder rather than mocked rows.
- It does not send allocation rows to the backend.
- The previous generic/hardcoded labels such as Sales Discounts, VAT / Tax Payable, and Various Revenues were removed from the production Sales Invoice page on 2026-06-07.

Existing charge UI:

- The previous Charge / Account Name table was removed from the production Sales Invoice page on 2026-06-07 because it looked like a real allocation contract while remaining disconnected from the intended controlled allocation model.
- Backend DTO/entity support for document charges may still exist and should be reviewed before implementing the new controlled allocation contract.
- Existing charge payload shape can carry:
  - `amountDoc`
  - `taxCodeId`
  - `revenueAccountId`
  - `description`

### Backend

Main file:

- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`

Current posting behavior:

- Line tax account comes from `TaxCode.salesTaxAccountId`.
- Charge tax account also comes from `TaxCode.salesTaxAccountId`.
- Line revenue account resolves from item, category, or Sales Settings default revenue account.
- Discount account resolves from `SalesSettings.defaultSalesExpenseAccountId`.
- Charge revenue account resolves from `charge.revenueAccountId || settings.defaultRevenueAccountId`.
- The visual Allocation Grid is not part of the backend posting contract.

Important recent fix:

- `planning/done/180-tax-account-error-normalization-and-pi-line-total.md`
- Missing Tax Code posting accounts now surface as `ACCOUNT_MAPPING_MISSING` instead of silent unbalanced vouchers.

---

## 3. Accounting Rules

These rules are mandatory.

1. Every financial amount must resolve to a GL account before posting.
2. The frontend must not show an editable allocation that the backend ignores.
3. The backend is the source of truth for final totals and posting validation.
4. Posted invoices must not allow financial allocation edits.
5. Account override must be explicit and audit-visible.
6. Tax Code defaults remain the normal path:
   - Sales tax normally posts to `TaxCode.salesTaxAccountId`.
7. If the user overrides a tax account, the override must be stored and posted.
8. Invoice-level discount and addition rows must affect invoice totals, not only the visual grid.
9. Do not allow unclassified random accounting rows. Every row must have a controlled type.
10. Do not build dynamic posting scripts. This must remain typed, validated application logic.

---

## 4. Recommended Data Model

Add first-class invoice-level allocation rows to Sales Invoice.

Suggested frontend/backend shape:

```ts
type SalesInvoiceAllocationType =
  | 'TAX_FROM_LINES'
  | 'ADDITIONAL_TAX'
  | 'DISCOUNT'
  | 'ADDITION';

type SalesInvoiceAllocationCalculationMode = 'AMOUNT' | 'PERCENT';

interface SalesInvoiceAllocationInput {
  allocationId?: string;
  type: SalesInvoiceAllocationType;
  label?: string;
  calculationMode: SalesInvoiceAllocationCalculationMode;
  value: number;
  amountDoc?: number;
  accountId?: string;
  sourceTaxCodeId?: string;
  source?: 'SYSTEM' | 'USER';
  isAccountOverride?: boolean;
  notes?: string;
}
```

Backend entity should store a normalized version with:

- stable `allocationId`
- computed `amountDoc`
- computed `amountBase`
- resolved `accountId`
- `taxRate` / tax code snapshot where relevant
- `createdBy` / `updatedBy` if existing audit model supports it, otherwise rely on record-change audit for updates

Do not use stringly-typed arbitrary account names for posting. Store account ID/code using the same account resolution approach already used in posting.

---

## 5. Row Type Semantics

### `TAX_FROM_LINES`

Purpose:

- Automatically reflects total tax generated by invoice lines.

Default:

- Populate from selected line Tax Codes.
- If multiple Tax Codes exist, either:
  - v1 simple option: aggregate by tax account, not by line.
  - safer option: one row per Tax Code/account.

Recommended v1:

- One row per Tax Code used by lines.
- Label: tax code label.
- Amount: sum of all line tax amounts for that tax code.
- Account: `TaxCode.salesTaxAccountId`.
- User can override the account.
- User cannot manually edit the amount here. Amount comes from lines.

Posting:

- Credit tax account.

### `ADDITIONAL_TAX`

Purpose:

- User adds an invoice-level additional tax/fee that is not on item lines.

Examples:

- municipality tax
- environmental fee
- stamp fee if treated as tax/payable

Fields:

- label
- percent or amount
- tax/account selector
- optional tax code if available
- notes

Default calculation:

- Percent applies to invoice subtotal before tax and before this additional tax.

Posting:

- Credit selected tax/liability account.

Open question for product owner only if needed:

- Should additional tax be included in the taxable base for other taxes? Default answer for v1: no, avoid tax-on-tax.

### `DISCOUNT`

Purpose:

- Invoice-level discount.

Fields:

- percent or amount
- account selector
- notes

Default account:

- `SalesSettings.defaultSalesExpenseAccountId`

Settings management:

- Sales Settings must expose/select a default discount account if not already clear.
- Label should be business-friendly, for example "Default Sales Discount Account".

Calculation:

- Percent applies to invoice subtotal before tax.
- Amount directly reduces invoice total.

Posting:

- Debit discount/contra-revenue/expense account.
- This should reduce receivable by reducing invoice grand total.

### `ADDITION`

Purpose:

- Invoice-level addition/charge.

Examples:

- delivery fee
- service charge
- handling fee
- gift/reward charge later if product wants that behavior

Fields:

- percent or amount
- revenue/account selector
- optional Tax Code
- notes

Default account:

- Use a new Sales Settings default if needed:
  - `defaultSalesAdditionAccountId`
  - or reuse `defaultRevenueAccountId` for v1 if product accepts it.

Recommended:

- Add an explicit Sales Settings field: **Default Additions Account**.
- Do not hide additions inside generic revenue if the user expects separate reporting.

Posting:

- Credit selected revenue/charge account.
- If tax code exists on the addition, tax posts separately to the Tax Code account or its override.

---

## 6. Settings / Management Pages

The user specifically asked for management/default account selections.

Inspect existing pages first:

- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`
- `frontend/src/modules/sales/wizards/SalesFinancialIntegrationWizard.tsx`
- backend Sales Settings entity / DTO / use cases

Required settings:

1. **Default Sales Discount Account**
   - Existing backend uses `SalesSettings.defaultSalesExpenseAccountId`.
   - Ensure this is exposed clearly in Sales Settings and initialization wizard.
   - If label is confusing, rename UI label only; do not break backend compatibility unless planned migration is added.

2. **Default Sales Additions Account**
   - Add if missing.
   - Used when an `ADDITION` row has no explicit account and as the prefilled account when adding an Addition row.

3. **Default Gift / Promotional Account**
   - Product owner mentioned gifts but said not to overcomplicate now.
   - Recommended: add to design as future-ready setting only if backend already has a clean place.
   - Otherwise defer actual gift behavior to a later task.

4. **Tax accounts**
   - Continue using Tax Management / Tax Codes page.
   - Do not duplicate tax account management inside Sales Settings.
   - Allocation Grid should read Tax Code account defaults and allow invoice-level override.

Shared selector rule:

- Use existing shared account selector components.
- No free-text account IDs.

---

## 7. Frontend Implementation Plan

### Files likely to edit

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/api/salesApi.ts`
- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`
- `frontend/src/modules/sales/wizards/SalesFinancialIntegrationWizard.tsx`
- `frontend/src/i18n/*` translation files for any new user-facing strings
- possibly shared helper/component file if the grid becomes too large:
  - `frontend/src/modules/sales/components/SalesInvoiceAllocationGrid.tsx`

### UX behavior

Replace the current read-only Allocation Grid with an editable controlled grid.

Grid buttons:

- `Add Discount`
- `Add Addition / Tax`

Recommended row controls:

- Type selector for manual rows: Discount, Addition, Additional Tax
- Label/description
- Calculation mode segmented control: Amount / Percent
- Value input
- Computed amount
- Account selector
- Tax Code selector when row type is Additional Tax or taxable Addition
- Notes
- Remove button for manual rows only

Auto rows:

- Tax rows generated from line Tax Codes.
- Amount not editable.
- Account is editable as override.
- Show a clear "Default from Tax Code" vs "Overridden" indicator.

Totals:

- Subtotal from lines.
- Invoice-level discounts reduce total.
- Additions and additional tax increase total.
- Footer totals must match Allocation Grid totals.

Validation:

- Cannot save/post if a financial allocation row has no account.
- Percent must be between 0 and a sane maximum.
- Amount cannot be negative. Use row type for direction instead.
- Posted documents render read-only.

Toast rule:

- Save/update/post actions must use visible toast feedback.

---

## 8. Backend Implementation Plan

### Files likely to edit

- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/api/controllers/sales/SalesController.ts`
- `backend/src/repository/interfaces/...` only if repository DTO mapping requires explicit typing
- Firestore Sales Invoice repository if it has explicit mapping
- Sales Settings domain/use cases/controllers/repository if adding default additions account
- tests under:
  - `backend/src/tests/application/sales/`
  - or existing Sales posting test files

### Backend responsibilities

1. Accept allocation rows in create/update payloads.
2. Normalize calculation:
   - recompute `amountDoc` from mode/value
   - compute base amounts from exchange rate
3. Validate:
   - account required for every posting row
   - account exists and belongs to company
   - row type controls debit/credit direction
   - posted invoice cannot alter financial allocation rows unless future posted-edit policy allows it
4. Posting:
   - Tax from lines: use Tax Code account unless allocation override account exists.
   - Additional tax: credit selected account.
   - Discount: debit selected/default discount account.
   - Addition: credit selected/default additions/revenue account.
5. Audit:
   - Account override should appear in record-change audit.
   - If existing audit does not capture row-level detail cleanly, at least log allocation field changes.

### Do not do

- Do not let frontend-calculated totals post blindly.
- Do not bypass `PostingGateway`.
- Do not write directly to ledger repositories.
- Do not add Firestore-specific logic in domain/application layers.
- Do not create dynamic posting scripts.

---

## 9. Suggested Backend Posting Resolution Order

For line revenue:

1. item revenue account
2. category default revenue account
3. Sales Settings default revenue account

For line tax:

1. invoice allocation override account for that Tax Code row
2. `TaxCode.salesTaxAccountId`
3. reject with `ACCOUNT_MAPPING_MISSING`

For additional tax:

1. row account
2. selected Tax Code sales tax account if tax code selected
3. reject

For discount:

1. row account
2. `SalesSettings.defaultSalesExpenseAccountId`
3. reject

For addition:

1. row account
2. new `SalesSettings.defaultSalesAdditionAccountId`
3. `SalesSettings.defaultRevenueAccountId` only if explicitly accepted as v1 fallback
4. reject

---

## 10. Tests Required

Backend unit/integration tests:

1. Tax Code line tax posts to Tax Code account by default.
2. Tax Code line tax posts to override account when Allocation Grid account is overridden.
3. Additional tax row increases invoice grand total and credits selected tax/liability account.
4. Discount row decreases invoice grand total and debits discount account.
5. Addition row increases invoice grand total and credits selected additions/revenue account.
6. Missing account on any financial row rejects with structured error.
7. Posted invoice cannot update allocation rows.
8. Multi-currency amount/base math stays balanced.
9. Invoice voucher remains balanced for:
   - exclusive tax
   - inclusive tax
   - discount + addition + additional tax together

Frontend checks:

1. Typecheck.
2. Build.
3. Manual UI smoke:
   - create invoice line with Tax Code
   - grid populates tax row
   - override tax account
   - add discount percent
   - add addition amount
   - totals update
   - save/reload preserves rows
   - post creates balanced voucher

Recommended commands:

```powershell
npm --prefix backend run build
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix backend test -- --runInBand backend/src/tests/application/sales/SalesPostingUseCases.test.ts
```

Adjust exact test command to existing test names after inspection.

---

## 11. Acceptance Criteria

- Allocation Grid is no longer a fake/static preview.
- Selecting line Tax Codes automatically creates/updates Tax rows in the grid.
- User can override the account for an auto tax row.
- User can add invoice-level Discount rows.
- User can add invoice-level Addition / Additional Tax rows.
- Totals in lines, grid, footer, and backend voucher agree.
- Backend posting consumes the saved allocation model.
- Every financial allocation row has a validated account before posting.
- Missing accounts return clear user-facing errors, not unbalanced `INFRA_999`.
- Posted invoices render allocation rows read-only.
- Sales Settings exposes required default accounts:
  - discount account
  - additions account if introduced
- Tax account defaults remain owned by Tax Codes.
- New user-facing strings are in i18n files.
- Completion docs are created/updated according to AGENTS.md:
  - `docs/architecture/sales.md` or dedicated architecture doc
  - `docs/user-guide/sales/...`
  - `planning/done/184-sales-invoice-allocation-grid-controlled-overrides.md`
  - `planning/JOURNAL.md`
  - `planning/ACTIVE.md`

---

## 12. Out of Scope

Do not build these in this task:

- Per-line allocation overrides.
- Withholding tax engine.
- Landed cost allocation.
- Gift accounting behavior unless it is only a default setting placeholder.
- Dynamic posting scripts.
- Purchase Invoice parity unless the user explicitly expands the scope.
- Posted-document financial amendment/reversal workflow; use Task 179 for posted edit policy.

---

## 13. Risk Notes

### Software / ERP Architecture

This task crosses frontend, backend DTOs, domain entity normalization, posting logic, settings, and tests. It is larger than a visual grid change. If it touches more than 8 files across more than 3 directories, split into slices:

1. Backend contract and posting tests.
2. Sales Settings defaults.
3. Frontend grid and save/update wiring.
4. Docs and QA.

### Accounting / Financial Systems

The main risk is allowing users to create rows that change totals but do not post, or post to the wrong account type. Every row type must map to a debit/credit role. The backend must validate and reject missing/invalid accounts.

Recommended v1 stance:

- Keep all manual allocation rows invoice-level.
- Keep amount direction controlled by row type, not negative numbers.
- Keep tax default ownership in Tax Codes.
- Allow account override, but make it visible and auditable.
