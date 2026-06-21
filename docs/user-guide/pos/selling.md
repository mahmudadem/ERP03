# POS — Selling (Cashier Screen)

The cashier screen is at **POS → Terminal**. It is the most-used surface in the module. It assumes you have already opened a shift; if not, it shows a "no open shift" card with a link to open one.

## Layout

A two-panel cashier screen (it stacks on narrow screens):

- **Context bar** (top) — the active register name/code, a green "Shift open" indicator, and the signed-in cashier. After a sale, a green chip here shows the last receipt number and the change given.
- **Products panel** (left) — a large search/scan box. Type a SKU, barcode, or part of the product name; matches appear as **tappable product tiles** (name, code, price). Click a tile to add it to the order. With a barcode scanner, scanning types the code and presses Enter, which adds the top match and clears the box for the next scan. Items that have no sale price set cannot be added — set a sale price on the item first.
- **Order panel** (right, "Current sale") — each line shows the product, a **− / +** quantity stepper (you can also type a quantity, including fractional for weight items), the line total, and a remove button. A badge shows the total item count, and **Clear** empties the sale. Below the lines: subtotal, discount, tax, a bold **Total**, the customer picker, and a large green **Pay** button showing the amount due.

## Customer

Defaults to the company-configured **walk-in customer** from POS Settings. To attach a named customer (e.g. a registered customer for history / credit-note purposes), use the customer picker to swap them. The sale still settles to cash/card.

## Tender

Click **Pay** to open the Tender dialog. It opens showing the **balance due** and the amount pre-filled. Add one or more payment rows:

- Pick a **method** using the method buttons (only the payment methods enabled in POS Settings are shown — Cash, Card, Bank, Other).
- Enter the **amount**, or click **Exact** to fill the remaining balance.
- Optionally enter a **reference** (the system requires it for Card / Bank Transfer when the matching payment-method config has `requiresReference: true`).
- Click **Add payment**.

The dialog shows live: tendered total, change, and whether the sale is **Fully paid** or still has a balance due. CASH change is automatically netted off the SI settlement; CARD/BANK/CUSTOM do not give change.

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
