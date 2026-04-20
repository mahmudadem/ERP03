# Workflow and Accounting Modes UAT

## Scope

This checklist validates the supported combinations of:

- `accountingMode`: `INVOICE_DRIVEN`, `PERPETUAL`
- `workflowMode`: `SIMPLE`, `OPERATIONAL`

Supported combinations:

- `SIMPLE + INVOICE_DRIVEN`
- `OPERATIONAL + INVOICE_DRIVEN`
- `OPERATIONAL + PERPETUAL`

Blocked combination:

- `SIMPLE + PERPETUAL`

## Test Data

Use the same baseline data for all scenarios where possible:

- Stock item: `ITEM-STK-001`
- Customer: `CUST-001`
- Vendor: `VEND-001`
- Warehouse: default warehouse
- Quantity per line: `5`
- Unit cost: `10`
- Unit sales price: `15`
- Tax code: start with zero tax, then repeat one invoice with tax

## Always Verify

For every posting scenario, verify all of the following:

1. Document status becomes `POSTED`.
2. The expected inventory movement exists.
3. Voucher linkage fields are correct:
   - `voucherId`
   - `cogsVoucherId`
   - `revenueVoucherId`
4. Voucher metadata references the correct source document.
5. No duplicate inventory movement is created when a posted `DN` or `GRN` already exists.

## UAT Matrix

| ID | Mode | Scenario | Steps | Expected Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|
| UAT-01 | `SIMPLE + INVOICE_DRIVEN` | Sales menu visibility | Open Sales module after setup | Only invoices and returns are visible. Orders and delivery notes are hidden. |  |  |
| UAT-02 | `SIMPLE + INVOICE_DRIVEN` | Purchases menu visibility | Open Purchases module after setup | Only invoices and returns are visible. Purchase orders and goods receipts are hidden. |  |  |
| UAT-03 | `SIMPLE + INVOICE_DRIVEN` | Sales dynamic route blocking | Open an operational sales form URL directly | User is redirected back to `/sales`. |  |  |
| UAT-04 | `SIMPLE + INVOICE_DRIVEN` | Purchase dynamic route blocking | Open an operational purchase form URL directly | User is redirected back to `/purchases`. |  |  |
| UAT-05 | `SIMPLE + INVOICE_DRIVEN` | Tools designer filtering | Open the tools forms designer for Sales and Purchase | Operational templates/forms are not available. |  |  |
| UAT-06 | `SIMPLE + INVOICE_DRIVEN` | Post stock sales invoice | Create and post a stock Sales Invoice without DN | Stock `OUT` movement exists, `voucherId` exists, `cogsVoucherId` exists. |  |  |
| UAT-07 | `SIMPLE + INVOICE_DRIVEN` | Post stock purchase invoice | Create and post a stock Purchase Invoice without GRN | Stock `IN` movement exists, `voucherId` exists. |  |  |
| UAT-08 | `SIMPLE + INVOICE_DRIVEN` | Sales return after invoice | Create and post `AFTER_INVOICE` Sales Return | Stock `IN` movement exists, `revenueVoucherId` exists, `cogsVoucherId` exists. |  |  |
| UAT-09 | `SIMPLE + INVOICE_DRIVEN` | Purchase return after invoice | Create and post `AFTER_INVOICE` Purchase Return | Stock `OUT` movement exists, `voucherId` exists. |  |  |
| UAT-10 | `OPERATIONAL + INVOICE_DRIVEN` | Sales menu visibility | Open Sales module after setup | Orders, delivery notes, invoices, and returns are visible. |  |  |
| UAT-11 | `OPERATIONAL + INVOICE_DRIVEN` | Purchase menu visibility | Open Purchases module after setup | Purchase orders, goods receipts, invoices, and returns are visible. |  |  |
| UAT-12 | `OPERATIONAL + INVOICE_DRIVEN` | Post delivery note | Create SO, then post DN | Stock `OUT` movement exists, SO delivered qty updates, `cogsVoucherId` is empty. |  |  |
| UAT-13 | `OPERATIONAL + INVOICE_DRIVEN` | Post goods receipt | Create PO, then post GRN | Stock `IN` movement exists, PO received qty updates, `voucherId` is empty. |  |  |
| UAT-14 | `OPERATIONAL + INVOICE_DRIVEN` | Invoice after delivery | Create SO, post DN, then post SI from that flow | Revenue voucher exists, no duplicate stock `OUT`, invoice `cogsVoucherId` exists. |  |  |
| UAT-15 | `OPERATIONAL + INVOICE_DRIVEN` | Invoice after goods receipt | Create PO, post GRN, then post PI from that flow | Purchase voucher exists, no duplicate stock `IN`. |  |  |
| UAT-16 | `OPERATIONAL + INVOICE_DRIVEN` | Sales return before invoice | Create return from DN and post | Stock `IN` movement exists, `revenueVoucherId` is empty, `cogsVoucherId` is empty. |  |  |
| UAT-17 | `OPERATIONAL + INVOICE_DRIVEN` | Purchase return before invoice | Create return from GRN and post | Stock `OUT` movement exists, `voucherId` is empty. |  |  |
| UAT-18 | `OPERATIONAL + PERPETUAL` | Simple workflow blocked | Open Sales and Purchase settings | `Simple` workflow cannot be selected. |  |  |
| UAT-19 | `OPERATIONAL + PERPETUAL` | Post delivery note | Create SO, then post DN | Stock `OUT` movement exists, `cogsVoucherId` exists. |  |  |
| UAT-20 | `OPERATIONAL + PERPETUAL` | Post goods receipt | Create PO, then post GRN | Stock `IN` movement exists, `voucherId` exists. |  |  |
| UAT-21 | `OPERATIONAL + PERPETUAL` | Invoice after delivery | Create SO, post DN, then post SI | Revenue voucher exists, no duplicate stock `OUT`, invoice `cogsVoucherId` is empty. |  |  |
| UAT-22 | `OPERATIONAL + PERPETUAL` | Invoice after goods receipt | Create PO, post GRN, then post PI | Purchase voucher exists, no duplicate stock `IN`. |  |  |
| UAT-23 | `OPERATIONAL + PERPETUAL` | Sales return before invoice | Create return from DN and post | Stock `IN` movement exists, `cogsVoucherId` exists, `revenueVoucherId` is empty. |  |  |
| UAT-24 | `OPERATIONAL + PERPETUAL` | Purchase return before invoice | Create return from GRN and post | Stock `OUT` movement exists, `voucherId` exists. |  |  |

## Notes

- In operational modes, if `allowDirectInvoicing` is enabled, a direct invoice without `DN` or `GRN` still acts as the stock-event fallback.
- This document validates current implemented behavior, not a hypothetical future accounting model.
