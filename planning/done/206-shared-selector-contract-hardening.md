# 206 — Shared Selector Contract Hardening

**Date:** 2026-06-12  
**Time spent:** ~2.0h  
**Scope:** Frontend shared selector/data-entry hardening.

## Technical Developer View

### What Changed

- Added shared selector modal focus handling in `useSelectorModalFocus`.
- Hardened Item, Party, Warehouse, UOM, Account, Tax Code, Discount Type, and Currency selector modal behavior.
- Replaced selector-local Item/Party/Warehouse mini-create forms with native master-card add modals.
- Promoted `CurrencySelector` through the shared selector barrel.
- Converted `AccountSelectorSimple` into a compatibility wrapper around the richer `AccountSelector`.
- Replaced `ReceiptVoucherForm` account dropdown usage with `AccountSelector`, including Cash/Bank asset filtering on Deposit To.
- Replaced native recurring-template date inputs in Sales Invoice with shared `DatePicker`.
- Passed tax-code names into document line `TaxCodeSelector` options so selected tax displays by name.

### Files Touched

- `frontend/src/components/shared/selectors/useSelectorModalFocus.ts`
- `frontend/src/components/shared/selectors/CurrencySelector.tsx`
- `frontend/src/components/shared/selectors/ItemSelector.tsx`
- `frontend/src/components/shared/selectors/PartySelector.tsx`
- `frontend/src/components/shared/selectors/WarehouseSelector.tsx`
- `frontend/src/components/shared/selectors/UomSelector.tsx`
- `frontend/src/components/shared/selectors/TaxCodeSelector.tsx`
- `frontend/src/components/shared/selectors/DiscountTypeSelector.tsx`
- `frontend/src/components/shared/selectors/index.ts`
- `frontend/src/modules/accounting/components/shared/AccountSelector.tsx`
- `frontend/src/modules/accounting/components/shared/CurrencySelector.tsx`
- `frontend/src/modules/accounting/components/AccountSelectorSimple.tsx`
- `frontend/src/modules/accounting/components/ReceiptVoucherForm.tsx`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `docs/architecture/shared-selectors.md`
- `docs/user-guide/lists/shared-selectors.md`

### Verification

- `npm --prefix frontend run typecheck` passed.
- `git grep -n 'type="date"' -- frontend/src/modules frontend/src/components` returned no production module/component matches.
- `AccountSelectorSimple` no longer renders a native account `<select>`.

### Accounting Impact

UI/data-entry controls only. No posting math, tax calculation, inventory valuation, settlement, AP/AR balance, ledger write, approval, period-lock, or backend DTO contract changed. The accounting benefit is stronger prevention of invalid account, tax, currency, party, item, warehouse, and UOM references before documents are saved.

## End-User View

Selectors now behave more consistently. Users can type a customer, vendor, item, warehouse, account, currency, UOM, tax code, or discount type; when there is only one match, ERP03 selects it automatically. If there are multiple matches, the picker stays open until the user chooses or closes it. Keyboard users can move with Up/Down, select with Enter, close with Escape, and keep Tab focus inside the picker.

Creating items, parties, and warehouses from selector `+` buttons now opens the normal master-data card, so users see the same fields and rules as they would from the master-data pages.

## Follow-Ups

- Manual QA the Item/Party/Warehouse `+` add flow in classic and Windows modes.
- Manual QA selector keyboard behavior inside SI/SO/Quote/PI/PO line tables.
- Decide whether to add first-class `CategorySelector`, `CustomerGroupSelector`, `VendorGroupSelector`, and `SalespersonSelector` for master-data-heavy pages.
