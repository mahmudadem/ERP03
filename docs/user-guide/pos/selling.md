# POS — Selling (Cashier Screen)

The cashier screen is at **POS → Terminal**. It is the most-used surface in the module. It assumes you have already opened a shift; if not, it shows a "no open shift" card with a link to open one.

## Layout

- **Left column** — product search. Type a SKU, barcode, or part of the product name; results appear after a short debounce. Click to add to the cart.
- **Middle column** — the cart. Each row shows the line, editable qty, unit price, line total, and a void button. Below: customer picker, subtotal, discount, grand total, and the **Pay** button.
- **Right column** — the "Last receipt" card. After a sale, it shows the receipt number, the linked Sales Invoice number, and the change.

## Customer

Defaults to the company-configured **walk-in customer** from POS Settings. To attach a named customer (e.g. a registered customer for history / credit-note purposes), use the customer picker to swap them. The sale still settles to cash/card.

## Voiding a cart line

Cashiers do not hard-delete entered lines. Click the trash icon on a cart row, enter a reason, and confirm **Void line**. The row remains visible as voided, is excluded from the totals, and is saved on the receipt audit trail when the sale completes.

Voided lines do not post stock movement, revenue, tax, COGS, cash, or payment amounts. They also cannot be returned later from the receipt.

If the cashier's role requires manager approval for voids, discounts, price overrides, or tax overrides, the backend blocks completion unless an approved manager override is supplied. Cashier roles can also set maximum line discount percent/amount and can block manual price or tax edits unless a manager approves.

## Item selling guards

POS blocks inactive inventory items before stock, receipt, payment, or accounting is posted. Product search only returns active items, and sale completion re-checks the item in the backend in case a stale screen or API payload tries to sell it.

Until POS-specific item fields are added to the item master screen, advanced flags can be stored in item metadata:

- `metadata.pos.enabled = false` blocks the item from POS.
- `metadata.pos.blocked = true` blocks the item from POS.
- `metadata.pos.discountable = false` blocks manual or promotion discounts for that item.

These flags are enforced by the sale posting path, including exchanges.

## Hold and recall a sale

Use **Hold** when the customer needs to pause before payment. The current active cart lines are saved to the server for the open shift, then the terminal clears so the cashier can serve the next customer.

Use **Recall** to list held sales for the current register and shift. Recalling a held sale restores its lines and customer to the cart and marks the held record as recalled. Cancelling a held sale marks it cancelled and removes it from the held list.

Holding a sale is operational only. It does not reduce stock, create a receipt, take payment, or post to accounting. Those actions happen only when the recalled cart is completed through **Pay**.

## Tender

Click **Pay** to open the Tender dialog. Add one or more payment rows:

- Pick a **method** (CASH, CARD, BANK_TRANSFER, CUSTOM).
- Enter the **amount** (tendered).
- Optionally enter a **reference** (the system requires it for CARD / BANK_TRANSFER when the matching payment-method config has `requiresReference: true`).
- Click **Add tender**.

The dialog shows live: tendered total, change, and the amount that will be applied to the Sales Invoice (= tendered total − change). CASH change is automatically netted off the SI settlement; CARD/BANK/CUSTOM do not give change.

Settlement accounts come from the active register. CASH posts to the register's cash-drawer account; CARD, BANK_TRANSFER, and CUSTOM post to that register's configured settlement account. If a non-cash method is enabled but missing on the register, the sale is blocked before any receipt or posting is created.

If cash rounding is enabled in POS Settings, the tender dialog uses the rounded cash total. For example, a total of `10.02` rounds to `10.00` when **nearest 0.05** is selected. The rounding difference is posted to the configured cash over/short account so the drawer, receipt, and accounting stay balanced.

When the applied amount equals the payable total, click **Complete sale**. The system:

1. Posts a POS direct sale with `POS_DIRECT_SALE` identity through the shared inventory and accounting engines.
2. Persists the POS receipt and the payment rows.
3. Writes a `SALE_CASH` cash movement on the current shift (net of change).
4. Bumps the next receipt number.
5. Returns the receipt number + posted document number + change to the cashier screen.

Manual discounts, price override flags, tax override flags, voided lines, and manager approval ids are stored on the receipt audit trail. Managers can review those exceptions from the POS override audit report endpoint.

## Why "Allow POS direct sales" matters

The first time you use the terminal, if the Settings page has not enabled **Allow POS direct sales**, the backend blocks the sale through POS policy. The cashier screen surfaces this as a toast. Go to **POS → Settings**, enable the toggle, save, and try again.

## Reprint a receipt

From the **Receipt History** report in **POS → Reports**, click any row to open the receipt detail and the **Reprint** action.
