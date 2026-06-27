# Purchase Invoice Native Form

The Purchase Invoice page is the main place to enter a vendor bill.

## Direct Purchase Invoice

Use **Direct** when the bill is not linked to a Purchase Order.

1. Open `Purchases -> Invoices -> New Bill`.
2. Keep the source mode on **Direct**.
3. Select the vendor.
4. Select the **Main Warehouse** in the header when the bill contains stock items.
5. Add item lines, quantities, UOM, unit cost, discounts, and tax codes.
6. Save as draft or **Save & Post**.

For direct bills, the header warehouse is used for stock lines unless a line already has a source warehouse. This matches the Sales Invoice pattern and keeps the line table focused on item, quantity, cost, discount, tax, and totals.

## From Purchase Order

Use **From PO** when the bill is linked to an existing Purchase Order.

1. Switch the source mode to **From PO**.
2. Select the Purchase Order in the header.
3. The vendor and source lines are loaded from the PO.
4. Review quantities, cost, tax, settlement, and totals.
5. Save or post.

PO-linked lines keep the warehouse from the source document. This protects traceability between the bill and the receiving/procurement documents.

## Side Rail Focus

The right-side rail changes based on what you are working on:

- Vendor focus shows AP/vendor bill context.
- Item focus shows item quantity/UOM and the warehouse that will receive stock.
- Warehouse focus shows the direct bill receiving location.

Use the rail to review context while editing without opening extra screens.

## Printing

Saved Purchase Invoices have a **Print** action. It uses the shared Print Layout Engine:

1. Open a saved Purchase Invoice.
2. Click **Print**.
3. The system opens a print preview window using the company default Purchase Invoice print layout.
4. If no company layout exists yet, the system uses the built-in default Purchase Invoice layout.

Printing is read-only. It does not post, approve, unpost, settle, or change the bill.
