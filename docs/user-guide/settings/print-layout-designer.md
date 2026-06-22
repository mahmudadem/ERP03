# Print Layout Designer

The Print Layout Designer lets a company admin design reusable print layouts for documents such as POS receipts and Sales Invoices.

Open **Tools -> Print Layout Designer**.

## What You Can Do

- Choose the document type.
- Choose the paper type: A4, A5, 80mm receipt, or 58mm receipt.
- Add text, data fields, tables, boxes, logo placeholders, and QR placeholders.
- Drag and resize components on the paper canvas.
- Edit font size, color, background, borders, bold, italic, and alignment.
- Edit bill-table column labels and widths.
- Set bill-table header background and text color.
- Choose what happens when a bill has many rows: continue to another page or longer receipt, clip extra rows, or shrink rows to fit.
- Repeat table headers after page breaks.
- Save a layout as the default for that document type.
- Export a layout as JSON and import it into another company or environment.

## Important Rules

The designer uses approved document fields only. For example, a POS receipt layout can use receipt number, cashier, register, totals, payments, and receipt lines. Users cannot add scripts or hidden calculations to a print layout.

This protects financial documents from accidental or unsafe custom logic.

## Current Limitations

The V1 designer saves layouts and validates bindings. POS and Sales print buttons still need a follow-up slice to consume these saved layouts at runtime.

