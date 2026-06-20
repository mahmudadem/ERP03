# POS — Reports

Six POS reports + one link live under **POS → Reports** in the sidebar. All use the shared ReportContainer (two-stage `initiator → report content`, Excel/PDF/print, columns toggle).

## Z Report (by shift)

**Use:** finalized close summary for a single shift.
**Input:** shift id (find it in **POS → Shift** history).
**Output:** opening float, expected cash, gross sales, returns, net sales, receipt count, return count, over/short amount, and (if any) the linked journal voucher id. Variance is highlighted in red.

This is the report to run on every shift close, to spot cashier over/short trends.

## Daily Summary

**Use:** receipts and returns per day.
**Input:** date range (defaults to last 30 days).
**Output:** per-day row with receipt count, return count, gross, returns, net.

## Payment Methods

**Use:** amounts per POS payment method.
**Input:** date range.
**Output:** CASH / CARD / BANK_TRANSFER / CUSTOM rows. (V1 returns the row skeleton; populating the amounts per method across all receipts of a period is a follow-up; the **Last receipt** card already shows per-receipt payment rows.)

## Cashier Sales

**Use:** totals per cashier (uid) for the period.
**Input:** date range.
**Output:** per-cashier row with shift count, receipt count, gross.

## Cash Over/Short

**Use:** variance history across all CLOSED shifts.
**Input:** date range.
**Output:** one row per closed shift with expected cash, counted cash, over/short, and the voucher id (if any was posted).

## Receipt History

**Use:** every POS receipt in the period with the linked Sales Invoice number.
**Input:** date range.
**Output:** receipt / SI / register / customer / total / date.

## Unsettled Costs (link)

Links to the existing **Inventory → Reports → Unsettled Costs** report. POS-origin Sales Invoices that hit an uncosted stock-out at the policy level will appear there. Use this to audit whether the cash drawer is making sales that the inventory engine can't value.
