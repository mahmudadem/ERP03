# POS — Returns

From a completed receipt, the cashier can return all or some of the active sold lines. The return reverses revenue/tax, restocks inventory through the shared inventory engine, and (for CASH refunds) reduces the shift drawer.

## Process a return

1. **POS → Returns**.
2. Type the **receipt number or id** in the lookup box and click **Look up**. The receipt lines appear with editable return-qty inputs (capped at the original sold qty).
3. For each line you want to return, set the return qty (≤ the sold qty).
4. Pick the **refund method** (CASH, CARD, BANK_TRANSFER, CUSTOM). The dialog shows the live refund total.
5. Click **Post return**, confirm. The system:
   - Posts a POS return through the shared inventory and accounting engines.
   - Persists the POS return entity, linked to the new sales return id.
   - Uses the active register settlement account for the refund method.
   - For CASH refunds, writes a `REFUND_CASH` cash movement on the **current** open shift, reducing expected cash.
6. A toast confirms the refund amount; the return history list refreshes.

If the cashier's role requires manager approval for returns, the backend blocks the return unless an approved manager override is supplied.

## Voiding a Posted Receipt

A posted receipt is not cancelled by simply changing its status. The system creates a POS return for every remaining active line on the receipt, posts the financial reversal, and then marks the receipt **VOIDED**.

If part of the receipt was already returned, only the remaining returnable quantity is voided. If nothing remains, the void is blocked. This prevents duplicate refunds and duplicate stock reversals.

## Exchanges

An exchange is recorded as two linked POS documents:

1. A POS return for the item coming back.
2. A replacement POS sale for the item going out.

Both documents share one exchange id. If the replacement sale is more expensive than the return, the result shows the extra amount due from the customer. If the replacement sale is cheaper, the result shows the net refund to the customer.

The return and sale keep their normal accounting behavior. This means stock, revenue, tax, COGS, cash/card settlement, and shift cash movements remain auditable on the same paths as ordinary POS returns and POS sales.

To process an exchange:

1. Open **POS → Returns**.
2. Switch the mode from **Return** to **Exchange**.
3. Look up the original receipt.
4. Enter the quantity being returned on the original receipt line.
5. Search for the replacement item and add it to the replacement sale.
6. Confirm the replacement quantity, price, payment method, and optional payment reference.
7. Review **Return value**, **Replacement value**, and the calculated **Net due** or **Net refund**.
8. Click **Post exchange** and confirm.

## Which shift does the return attach to?

Returns always attach to the **current** open shift on the register, not the original shift where the sale happened. If the original shift has been closed and the cashier opened a new shift on the same register, the new shift is the one whose drawer math is updated.

## Partial returns

You can return a subset of the sold qty (e.g. 1 of 3). Restock only happens for the returned qty per the existing inventory policy.

## Errors you'll see

- **"Return qty X exceeds sold qty Y"** — you tried to return more than was sold. Lower the return qty.
- **"No open shift for register …"** — close the shift from POS → Shift and open a new one.
- **"Configure ... settlement account on POS register …"** — edit the register and set the missing cash-drawer or non-cash settlement account before retrying.
- **"Original receipt has no linked Sales Invoice"** — the receipt predates the Sales integration; cannot return.
