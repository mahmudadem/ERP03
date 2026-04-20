# Forms Designer — Default Designs & Seeding

Status: Planning complete, ready for implementation
Date: 2026-04-19


## The Goal

Create official default form designs for every document type in the ERP.
When a company initializes a module, these forms are auto-seeded.
Users can clone them to customize, but the originals stay locked.

This already works architecturally:
- InitializeSalesUseCase seeds both voucher_types and voucherForms
- InitializePurchasesUseCase does the same
- Clone, lock, delete-protection, import/export all work in the voucher-wizard


## How To Do It

1. Open the Forms Designer in a fresh company
2. Design each form visually (layout, field selection, section arrangement)
3. Export the JSON from the designer
4. Paste the exported JSON into the seed templates:
   - Sales forms  -> SalesSettingsUseCases.ts
   - Purchase forms -> PurchaseSettingsUseCases.ts
5. Add field metadata (category, mandatory, autoManaged) to each field definition
6. Test by re-initializing a module and confirming the form loads


## Document Types to Design

SALES MODULE:
- Sales Order (SO)
- Delivery Note (DN)
- Sales Invoice (SI)
- Sales Return (SR)

PURCHASE MODULE:
- Purchase Order (PO)
- Goods Receipt Note (GRN)
- Purchase Invoice (PI)
- Purchase Return (PR)


## Field Classification Rules

Each field falls into one of three categories:

REQUIRED (core, mandatory: true)
  - Backend throws if missing. Always on the form. User cannot remove.
  - Examples: customerId, invoiceDate, lineItems

OPTIONAL (shared)
  - Backend accepts but has a default. User can add or remove from the form.
  - Examples: notes, dueDate, salesOrderRef, internalNotes

SYSTEM (systemMetadata, autoManaged: true)
  - Computed by backend. Never user-entered. Read-only or hidden.
  - Examples: id, status, docNumber, createdAt, totals


## Fields Per Document Type

### Sales Order
  Required: customerId, orderDate, currency, exchangeRate, lines
  Optional: expectedDeliveryDate, notes, internalNotes
  System:   id, orderNumber, customerName, status, totals, createdBy/At

### Delivery Note
  Required: deliveryDate, warehouseId
  Conditional: salesOrderId (if settings require SO), customerId (standalone only)
  Optional: notes
  System:   id, dnNumber, customerName, status, createdBy/At

### Sales Invoice
  Required: customerId, invoiceDate
  Optional: salesOrderId, customerInvoiceNumber, dueDate, currency, exchangeRate, notes
  System:   id, invoiceNumber, customerName, status, totals, paymentStatus, createdBy/At

### Sales Return
  Required: returnDate, reason
  Conditional: salesInvoiceId or deliveryNoteId (one required)
  Optional: warehouseId, notes
  System:   id, returnNumber, customerId, returnContext, status, totals, createdBy/At

### Purchase Order
  Required: vendorId, orderDate, currency, exchangeRate, lines
  Optional: expectedDeliveryDate, notes, internalNotes
  System:   id, orderNumber, vendorName, status, totals, createdBy/At

### Goods Receipt Note
  Required: receiptDate, warehouseId
  Conditional: purchaseOrderId (if settings require PO), vendorId (standalone only)
  Optional: notes
  System:   id, grnNumber, vendorName, status, createdBy/At

### Purchase Invoice
  Required: vendorId, invoiceDate
  Optional: purchaseOrderId, vendorInvoiceNumber, dueDate, currency, exchangeRate, notes
  System:   id, invoiceNumber, vendorName, status, totals, paymentStatus, createdBy/At

### Purchase Return
  Required: returnDate, reason
  Conditional: purchaseInvoiceId or goodsReceiptId or vendorId (one required)
  Optional: warehouseId, currency, exchangeRate, notes
  System:   id, returnNumber, vendorName, returnContext, status, totals, createdBy/At


## Known Bugs to Fix First

1. cloneVoucherForm() reads from wrong Firestore collection
   - Reads "systemVoucherTemplates" instead of "system_metadata/voucher_types/items"
   - 15 minute fix

2. Field metadata not populated in seed data
   - category, mandatory, autoManaged fields exist in the TypeScript types
   - But the actual seed templates don't set them
   - Need to add when converting exported JSON to seed templates

3. isLocked only enforced in frontend
   - Backend API doesn't check isLocked before allowing edits
   - Low risk but should be fixed eventually


## Today's Bug Fix (Completed)

Problem: System fields selected in Step 4 of the designer didn't show in preview.

Fixed in DocumentDesigner.tsx:
- buildSynchronizedConfig now merges system field metadata into headerFields
- Selected system fields added to allRequiredFieldIds for auto-placement
- runAutoPlacement() triggers when clicking Next from Step 4

Still needs manual verification:
- Verify system field rendering in Test Run modal
- Verify auto-placement in Visual Editor step
