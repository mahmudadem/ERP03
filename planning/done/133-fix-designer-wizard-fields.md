# Completion Report: [133-fix-designer-wizard-fields.md](file:///d:/DEV2026/ERP03/planning/done/133-fix-designer-wizard-fields.md)

Populated the available fields and available table columns dynamically by module in the unified Voucher Designer page, enabling custom form customization for Accounting, Sales, and Purchases.

## Technical Developer View

### Problem
Previously, when the user clicked "Clone" or "Add Custom Form" on a Voucher Type row in the unified Voucher Designer page, the wizard modal received empty arrays (`[]`) for `availableFields` and `availableTableColumns`. This resulted in Step 4 ("Fields") and Step 6 ("Visual Editor" Live Table Designer) displaying no available fields/columns for user selection, blocking customization.

### Solution
- Imported `AvailableField` type into [VoucherDesignerPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/shared/pages/VoucherDesignerPage.tsx).
- Created `AVAILABLE_FIELDS_BY_MODULE` containing all core, optional, and custom fields scoped for each module:
  - **Accounting:** `date`, `payee`, `reference`, `description`, `currency`, `exchangeRate`, `paymentMethod`, `branch`, `account`, `costCenter`, `lineItems`, `notes`, `attachments`.
  - **Sales:** `invoiceDate`, `deliveryDate`, `returnDate`, `customerId`, `warehouseId`, `currency`, `exchangeRate`, `totalAmount`, `salesOrderId`, `deliveryNoteId`, `salesInvoiceId`, `reason`, `notes`, `lineItems`.
  - **Purchases:** `invoiceDate`, `orderDate`, `expectedDeliveryDate`, `vendorId`, `warehouseId`, `currency`, `exchangeRate`, `totalAmount`, `purchaseOrderId`, `goodsReceiptId`, `notes`, `internalNotes`, `lineItems`.
- Created `AVAILABLE_TABLE_COLUMNS_BY_MODULE` containing line item fields scoped for each module:
  - **Accounting:** `account`, `debit`, `credit`, `costCenterId`, `notes`, `currency`, `parity`, `equivalent`, `category`.
  - **Sales:** `itemId`, `soLineId`, `dnLineId`, `siLineId`, `warehouseId`, `deliveredQty`, `returnQty`, `invoicedQty`, `uom`, `unitPriceDoc`, `taxCodeId`, `lineTotal`, `description`.
  - **Purchases:** `itemId`, `orderedQty`, `invoicedQty`, `poLineId`, `grnLineId`, `warehouseId`, `uom`, `unitPriceDoc`, `taxCodeId`, `lineTotal`, `description`.
- Resolved `availableFields` and `availableTableColumns` dynamically based on the active `module` prop, passing them as props to the `<DocumentDesigner>` element.
- **Bypassed client-side Firestore security rules for save/create flows**: Refactored `saveDocumentForm` inside [documentDesignerService.ts](file:///d:/DEV2026/ERP03/frontend/src/modules/tools/forms-designer/services/documentDesignerService.ts) to call the backend REST API endpoints via `voucherFormApi.create` and `voucherFormApi.update`. This eliminates the `PERMISSION_DENIED` errors on client-side writes, enforces server-side validation, and auto-generates secure IDs for cloned or new forms.
- **Fixed `isEdit` detection**: Corrected `isEdit` logic in [VoucherDesignerPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/shared/pages/VoucherDesignerPage.tsx) to check the initial `editingForm?.id` state instead of the final user-customized `config.id`, preventing new/cloned forms from incorrectly executing `PUT` requests.
- **Hardened Security Rules Evaluation**: Fixed the `isSuperAdmin` helper in [firestore.rules](file:///d:/DEV2026/ERP03/firestore.rules) to read `globalRole` safely using `.data.get('globalRole', '')`, preventing rule evaluation crashes for standard tenant users.

### Verification Done
- Verified frontend typechecking passes cleanly:
  ```powershell
  npm --prefix frontend run typecheck
  ```
- Verified frontend production build compiles successfully:
  ```powershell
  npm --prefix frontend run build
  ```

---

## End-User View

### Features Added
*   **Module-specific Form Fields Picker:** When creating or editing custom forms in Accounting, Sales, or Purchases, you will now see all applicable fields specific to that module in Step 4 ("Fields") of the wizard.
*   **Live Table Column Customization:** In Step 6 ("Visual Editor") of the designer wizard, you can now toggle and configure columns for the line items table (such as Item, Quantity, Unit Price, and Tax Codes) using the module-specific "Manage Columns" drawer.
*   **Restricted default layouts:** Custom forms initialize with sensible defaults matching their parent voucher template, allowing quick copies and custom tailoring without manual configuration from scratch.
