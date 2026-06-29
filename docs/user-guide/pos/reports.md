# POS — Reports

Ten POS report pages + one link live under **POS → Reports** in the sidebar. UI report pages use the shared ReportContainer (two-stage `initiator → report content`, Excel/PDF/print, columns toggle).

Reports that show dated rows open with the newest date/time first. This applies
to Daily Summary, Receipt History, Cancelled Receipts, Cash Over/Short, Override
Audit, and Reprint Audit. Grouped summaries such as Payment Methods, Cashier
Sales, and Top Selling Items keep their own grouping or ranking order.

## Z Report (by shift)

**Use:** finalized close summary for a single shift.
**Input:** shift id (find it in **POS → Shift** history).
**Output:** opening float, expected cash, payment-method reconciliation totals, gross sales, returns, net sales, receipt count, return count, over/short amount, and (if any) the linked journal voucher id. Variance is highlighted in red.

This is the report to run on every shift close, to spot cashier over/short trends.

## Daily Summary

**Use:** receipts and returns per day.
**Input:** date range (defaults to last 30 days).
**Output:** per-day row with receipt count, return count, gross, returns, net. Newest day appears first.

## Payment Methods

**Use:** amounts per POS payment method.
**Input:** date range.
**Output:** CASH / CARD / BANK_TRANSFER / CUSTOM rows with receipt count and amount. CASH is reported net of any change given, so a `10.00` cash tender with `2.00` change reports `8.00` cash applied. Split payments count once for each method used on the receipt.

## Cashier Sales

**Use:** totals per cashier (uid) for the period.
**Input:** date range.
**Output:** per-cashier row with shift count, receipt count, gross.

## Cash Over/Short

**Use:** variance history across all CLOSED shifts.
**Input:** date range.
**Output:** one row per closed or reconciled shift with expected cash, counted cash, over/short, and the voucher id (if any was posted). Newest close time appears first.

## Receipt History

**Use:** every POS receipt in the period with the linked Sales Invoice number.
**Input:** date range.
**Output:** receipt / SI / register / customer / total / date. Newest receipt time appears first.

## Cancelled Receipts

**Use:** posted POS receipts that were marked voided after reversal.
**Input:** date range.
**Output:** receipt, status, register, cashier, original total, and date. Newest cancellation/receipt time appears first.

This report does not create the cancellation. It only lists receipts already marked `VOIDED`. In ERP03 POS, posted receipt cancellation must first create the linked POS return/reversal, then mark the receipt voided.

## Top Selling Items

**Use:** gross item ranking from completed POS receipts.
**Input:** date range.
**Output:** item code/name, quantity sold, gross sales, and receipt count.

Voided receipt lines are excluded. This is a gross selling report and does not subtract later returns.

## Override Audit

**Use:** manager review of POS exceptions.
**Input:** date range, optional register.
**Output:** one row per voided line, manual discount, price override, or tax override. Rows show the receipt, register, shift, cashier, item, discount/override details, void reason, and manager override id when supplied. Newest event time appears first.

Open **POS → Reports → Override Audit** to review these rows.

## Reprint Audit

**Use:** manager review of duplicate receipt copies.
**Input:** date range.
**Output:** receipt number, reprint time, cashier user, cashier email, and manager override id when supplied. Newest reprint time appears first.

Open **POS → Reports → Reprint Audit** to review receipt reprint events. If cashier role policy requires approval for reprints, the backend blocks the reprint until a manager override id is supplied.

## Unsettled Costs (link)

Links to the existing **Inventory → Reports → Unsettled Costs** report. POS-origin Sales Invoices that hit an uncosted stock-out at the policy level will appear there. Use this to audit whether the cash drawer is making sales that the inventory engine can't value.
