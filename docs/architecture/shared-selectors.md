# Shared Selectors

## Purpose

Shared selectors are the required way to choose ERP master data from transaction, settings, report, and designer screens. They prevent users from saving arbitrary IDs that later break posting, pricing, stock movement, tax, or reporting.

## Contract

- Typing a value must auto-select it when the selector can resolve exactly one result.
- If the typed value is ambiguous, the selector opens its picker modal instead of saving raw text.
- Selector modals trap focus while open. Arrow Up/Down move the highlighted result, Enter selects, Escape closes, and Tab stays inside the modal until it is closed.
- Selectors rendered inside line tables or grid cells must be passed `noBorder` so the control blends into the table cell.
- Add buttons in master-data selectors must open the native master card for that entity, not a selector-local mini form.
- Financial selectors must show user-readable labels while preserving IDs/codes in saved data.

## Current Selector Set

- `PartySelector` for customers/vendors/parties.
- `ItemSelector` for inventory items.
- `WarehouseSelector` for warehouses.
- `UomSelector` for item-scoped UOM choices.
- `TaxCodeSelector` for tax codes; selected display uses the tax name, and the picker shows name, code, and rate.
- `DiscountTypeSelector` for line discount mode; selected display shows `Amount - <currency>` or `% Percent`.
- `CurrencySelector` for company-enabled currencies; new code should import it from `components/shared/selectors`.
- `AccountSelector` for chart-of-account choices.
- `PartyAccountSelector`, `CustomerAccountSelector`, and `VendorAccountSelector` for party-plus-subledger account fields.
- `DatePicker` for company-aware dates.

## Accounting Boundary

These changes are UI/data-entry controls only. They do not change posting math, tax calculation, ledger writing, inventory valuation, AR/AP balances, or backend DTO contracts. Their purpose is to ensure users choose valid tenant/company-scoped references before data reaches those backend workflows.

## File Map

- `frontend/src/components/shared/selectors/`
- `frontend/src/modules/accounting/components/shared/AccountSelector.tsx`
- `frontend/src/modules/accounting/components/shared/CurrencySelector.tsx`
- `frontend/src/components/shared/ClassicLineItemsTable.tsx`
