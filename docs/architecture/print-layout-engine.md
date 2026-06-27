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

- `documentType`, such as `POS_RECEIPT`, `SALES_INVOICE`, or `PURCHASE_INVOICE`
- paper profile: A4, A5, 80mm receipt, 58mm receipt, or custom-compatible schema
- canvas components: text, dynamic field, table, image/logo placeholder, box, line, barcode/QR placeholder
- component bounds in paper units
- style data: font size, bold, italic, colors, borders, and text alignment
- bill-table column definitions and table behavior

The bill table is a first-class component. It binds to an approved table schema, then stores editable column labels, widths, styles, header colors, row height, overflow behavior, and whether headers repeat after page breaks.

Table overflow behavior is explicit:

- `continue` means rows continue to the next printed page, or the receipt length grows on roll paper.
- `clip` means rows outside the frame are intentionally hidden.
- `shrink` records that the renderer may compress rows to fit the fixed frame.

The designer previews overflow pressure, but the runtime renderer is still responsible for applying these rules when POS/Sales printing is wired.

## Data Binding

Modules must not pass arbitrary fields directly to layouts. Each document type exposes a schema from `PrintLayoutCore.getDataSchema(documentType)`.

V1 schemas:

- `POS_RECEIPT`
- `SALES_INVOICE`
- `PURCHASE_INVOICE`

The designer only allows fields and table columns from the schema. Unknown bindings are rejected by backend validation before save.

## Runtime Consumers

Purchase Invoice now consumes the engine at runtime through `GET /tenant/purchase/invoices/:id/print`.

The Purchases controller fetches the saved Purchase Invoice, resolves the company default `PURCHASE_INVOICE` template from the print-layout template repository, and falls back to `PrintLayoutCore.createDefaultLayout('PURCHASE_INVOICE')` when no saved default exists. The frontend renders only the returned approved field and table bindings in a temporary browser print window. It does not execute scripts or formulas from the template.

The Purchase Invoice print payload is read-only and includes company identity, invoice header fields, vendor identity, line rows, totals, and notes. It does not create, post, approve, unpost, settle, or otherwise mutate the invoice.

## Current Scope

Implemented in V1:

- Save/load company layouts
- Create default layouts
- Import/export JSON layouts
- Real paper canvas with safe-area margin
- Drag and resize components
- Styling controls for text, colors, borders, bold, italic, and alignment
- Editable table columns
- Table header background/text color
- Table row height, preview row count, overflow mode, and repeat-header metadata

Not implemented yet:

- Runtime print rendering from POS/Sales document buttons
- PDF generation
- Real barcode/QR value rendering
- Printer-driver integration
- Formula/script execution, intentionally blocked

