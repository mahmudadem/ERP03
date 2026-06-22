# Print Layout Engine

## Purpose

The Print Layout Engine is an always-on company-level engine. It is not owned by POS, Sales, Purchases, Inventory, or Accounting. Those modules are consumers: they provide a document type, an approved print data schema, and a payload to render.

## Engine Boundary

- Engine contract: `backend/src/application/system-core/contracts/IPrintLayoutCore.ts`
- Engine implementation: `backend/src/application/system-core/print-layout/PrintLayoutCore.ts`
- Company template persistence: `companies/{companyId}/core/Settings/print_layouts`
- API route: `/tenant/print-layouts/*`
- Designer UI: `/tools/print-layout-designer`

The engine validates structured layout JSON. It does not execute user scripts. This is deliberate: financial printouts must not contain arbitrary code or unapproved calculations.

## Layout Model

Each template stores:

- `documentType`, such as `POS_RECEIPT` or `SALES_INVOICE`
- paper profile: A4, A5, 80mm receipt, 58mm receipt, or custom-compatible schema
- canvas components: text, dynamic field, table, image/logo placeholder, box, line, barcode/QR placeholder
- component bounds in paper units
- style data: font size, bold, italic, colors, borders, and text alignment
- bill-table column definitions

The bill table is a first-class component. It binds to an approved table schema, then stores editable column labels, widths, and styles.

## Data Binding

Modules must not pass arbitrary fields directly to layouts. Each document type exposes a schema from `PrintLayoutCore.getDataSchema(documentType)`.

V1 schemas:

- `POS_RECEIPT`
- `SALES_INVOICE`

The designer only allows fields and table columns from the schema. Unknown bindings are rejected by backend validation before save.

## Current Scope

Implemented in V1:

- Save/load company layouts
- Create default layouts
- Import/export JSON layouts
- Real paper canvas with safe-area margin
- Drag and resize components
- Styling controls for text, colors, borders, bold, italic, and alignment
- Editable table columns

Not implemented yet:

- Runtime print rendering from POS/Sales document buttons
- PDF generation
- Real barcode/QR value rendering
- Printer-driver integration
- Formula/script execution, intentionally blocked

