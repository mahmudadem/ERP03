# POS — Shifts (Open / Close / Cash Movements)

POS shifts control the cash drawer. A cashier opens a shift with an opening float, records any pay-ins / pay-outs / drops during the day, and closes the shift with a counted-cash amount. The backend computes the expected cash from the movement history; if there's a non-zero variance and the matching over/short account is configured, a balanced journal voucher is posted.

## Open a shift

1. **POS → Shift**.
2. Click **Open shift**.
3. Pick the register you want to work on. (You can only have one OPEN shift per register, and one per cashier.)
4. Enter the **opening float** — the cash you counted into the drawer at start-of-day.
5. Click **Open shift**. The X-report card appears with the live opening float and the **Add cash movement** / **Close shift** buttons.

## Record a cash movement (during the shift)

Click **Add cash movement** in the live card, then:

- **Pay-in** — you added cash to the drawer (e.g. from the back office).
- **Pay-out** — you paid out cash for petty cash.
- **Drop** — you removed cash to the safe.

Enter the amount and an optional reason. Save. The X report's expected-cash math updates immediately.

> The `SALE_CASH` and `REFUND_CASH` rows are written automatically by the cashier and return flows. You don't add them manually.

## Close the shift

1. **POS → Shift**.
2. In the live card, click **Close shift**.
3. Count the cash in the drawer. Enter the **counted cash**.
4. Review the dialog:
   - **Expected cash** is computed from the opening float + sales − refunds + pay-ins − pay-outs − drops.
   - **Over/short** = counted − expected.
5. Confirm. If the variance is **zero**, the shift closes silently. If the variance is **non-zero** and the matching over/short account is configured, a balanced journal voucher is posted and linked to the shift (visible in the **Cash Over/Short** report). If the matching account is **missing**, the close is blocked with a readable error — go to **POS → Settings** and configure the missing account.

## Force-close (manager)

If a shift is stuck (e.g. the cashier left without closing), a user with `pos.shift.forceClose` can open the same Close-shift dialog and confirm. The shift flips to `FORCE_CLOSED`; the close math still posts the over/short voucher.

## What happens after close

- The shift becomes immutable: any further cash-movement or sale attempt on the closed shift is rejected by the backend.
- A new shift can be opened on the same register.
- The **Z Report** becomes available for that shift in **POS → Reports → Z Report (by shift)**.
