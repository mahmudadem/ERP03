# POS — Selling (Cashier Screen)

The cashier screen is at **POS → Terminal**. It is the most-used surface in the module. It assumes you have already opened a shift; if not, it shows a "no open shift" card with a link to open one.

## Layout

- **Left column** — product search. Type a SKU, barcode, or part of the product name; results appear after a short debounce. Click to add to the cart.
- **Middle column** — the cart. Each row shows the line, editable qty, unit price, line total, and a delete button. Below: customer picker, subtotal, discount, grand total, and the **Pay** button.
- **Right column** — the "Last receipt" card. After a sale, it shows the receipt number, the linked Sales Invoice number, and the change.

## Customer

Defaults to the company-configured **walk-in customer** from POS Settings. To attach a named customer (e.g. a registered customer for history / credit-note purposes), use the customer picker to swap them. The sale still settles to cash/card.

## Tender

Click **Pay** to open the Tender dialog. Add one or more payment rows:

- Pick a **method** (CASH, CARD, BANK_TRANSFER, CUSTOM).
- Enter the **amount** (tendered).
- Optionally enter a **reference** (the system requires it for CARD / BANK_TRANSFER when the matching payment-method config has `requiresReference: true`).
- Click **Add tender**.

The dialog shows live: tendered total, change, and the amount that will be applied to the Sales Invoice (= tendered total − change). CASH change is automatically netted off the SI settlement; CARD/BANK/CUSTOM do not give change.

When the applied amount equals the grand total, click **Complete sale**. The system:

1. Posts a real **direct** Sales Invoice (`persona:'direct'`, `source:'pos'`, `formType:'pos_sale'`) with the existing revenue / tax / COGS / inventory OUT / AR / receipt-voucher pipeline.
2. Persists the POS receipt (linked to the SI) and the payment rows.
3. Writes a `SALE_CASH` cash movement on the current shift (net of change).
4. Bumps the next receipt number.
5. Returns the receipt number + SI number + change to the cashier screen.

## Why "Allow POS direct sales" matters

The first time you use the terminal, if the Settings page has not enabled **Allow POS direct sales**, the backend will throw `PersonaNotAllowedError` from the Sales use case. The cashier screen surfaces this as a toast. Go to **POS → Settings**, enable the toggle (it adds a form-scoped governance rule), save, and try again.

## Reprint a receipt

From the **Receipt History** report in **POS → Reports**, click any row to open the receipt detail and the **Reprint** action.
