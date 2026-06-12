# Shared Selectors

ERP03 uses smart selectors when you choose customers, vendors, items, warehouses, accounts, currencies, tax codes, UOMs, and dates.

## How They Work

1. Type a code or name directly in the field.
2. If there is only one match, ERP03 selects it automatically.
3. If there is more than one match, a picker opens so you can choose the correct record.
4. Use Up/Down to move through picker results, Enter to select, Escape to close, and Tab to move inside the picker.
5. Use the `+` button to open the normal master-data card when you need to create a new item, party, or warehouse.

## Notes

- Table cells use borderless selectors so line entry stays compact.
- Tax fields show the tax name after selection and show the code/rate in the picker.
- Discount type fields show either `Amount - currency` or `% Percent`.
- This does not change accounting results; it helps prevent invalid selections before documents are saved or posted.
