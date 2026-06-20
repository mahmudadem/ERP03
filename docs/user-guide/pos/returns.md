# POS — Returns

From a completed receipt, the cashier can return all or some of the lines. The return reverses revenue/tax, restocks inventory per the existing Sales policy, and (for CASH refunds) reduces the shift drawer.

## Process a return

1. **POS → Returns**.
2. Type the **receipt number or id** in the lookup box and click **Look up**. The receipt lines appear with editable return-qty inputs (capped at the original sold qty).
3. For each line you want to return, set the return qty (≤ the sold qty).
4. Pick the **refund method** (CASH, CARD, BANK_TRANSFER, CUSTOM). The dialog shows the live refund total.
5. Click **Post return**, confirm. The system:
   - Calls the existing `CreateSalesReturnUseCase` + `PostSalesReturnUseCase` against the receipt's linked Sales Invoice (`AFTER_INVOICE`).
   - Persists the POS return entity, linked to the new sales return id.
   - For CASH refunds, writes a `REFUND_CASH` cash movement on the **current** open shift, reducing expected cash.
6. A toast confirms the refund amount; the return history list refreshes.

## Which shift does the return attach to?

Returns always attach to the **current** open shift on the register, not the original shift where the sale happened. If the original shift has been closed and the cashier opened a new shift on the same register, the new shift is the one whose drawer math is updated.

## Partial returns

You can return a subset of the sold qty (e.g. 1 of 3). Restock only happens for the returned qty per the existing inventory policy.

## Errors you'll see

- **"Return qty X exceeds sold qty Y"** — you tried to return more than was sold. Lower the return qty.
- **"No open shift for register …"** — close the shift from POS → Shift and open a new one.
- **"Original receipt has no linked Sales Invoice"** — the receipt predates the Sales integration; cannot return.
