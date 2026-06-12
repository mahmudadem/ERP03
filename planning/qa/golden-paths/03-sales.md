# Golden Path 03 — Sales

> **Goal:** the full order-to-cash cycle posts correctly, including discounts, charges, settlement, and returns.
> **Precondition:** Golden Paths 01–02 passed on this tenant. Sales workflow mode: OPERATIONAL (set in Sales Settings; switch back later if needed).

## A. Master data

| # | Step | Expected |
|---|------|----------|
| 1 | Create customer CUST-1 with credit limit 10,000 | Saved; AR sub-account auto-created (check Customer card / COA) |
| 2 | Open Customer Statement for CUST-1 | Empty statement, no errors |

## B. Quote → Order → Delivery → Invoice

| # | Step | Expected |
|---|------|----------|
| 3 | Quotation: 10 × ITEM-A @ 15 for CUST-1; save | Quote saved with number |
| 4 | Convert/create Sales Order from it; confirm SO | SO confirmed; credit check passes |
| 5 | Create Delivery Note from SO for 10 units; post | Stock WH-1 drops by 10 (65 left); COGS posted at DN per policy |
| 6 | Create Sales Invoice from the DN | Lines inherited; qty/price correct |
| 7 | On the SI: add a **line discount** 10% on ITEM-A line | Taxable base reduces; totals update |
| 8 | Add an **invoice-level Charge** 50 (Freight) and a **Discount** 20 in the allocation grid | Grand total = lines − line discount + 50 − 20; grid rows show GL `CODE — Name` |
| 9 | In the settlement block choose CASH FULL, pick cash account; **post** | Invoice POSTED + PAID; two vouchers: invoice voucher + linked receipt |
| 10 | Open GL Impact / posted voucher | Balanced: AR/cash, revenue, charge credited, discount debited, COGS/inventory consistent with DN policy |
| 11 | Open the Payments button on the posted SI | Payment history shows the receipt |

## C. Over-payment & pay-later

| # | Step | Expected |
|---|------|----------|
| 12 | New direct SI for CUST-1: 1 × ITEM-A @ 1,000; settle with 1,500 with over-payment flag ON | Invoice PAID + 500 customer credit balance; with flag OFF it is rejected with a clear message |
| 13 | New direct SI on credit for 1 × ITEM-A (no settlement); post; then use **Record Payment** for half | Invoice PARTIALLY_PAID; receipt linked; AR reduced by the paid half; stock movement is visible if direct invoices are configured to issue stock |

## D. Return

| # | Step | Expected |
|---|------|----------|
| 14 | Sales Return (After Invoice) for 2 × ITEM-A against the step-6 invoice; post | Stock +2; AR/credit-note reversal correct; COGS reversed per cost policy |

## E. Reports

| # | Step | Expected |
|---|------|----------|
| 15 | Customer Statement CUST-1 | Shows invoices, receipt, return; running balance matches AR sub-account |
| 16 | AR Aging | CUST-1 outstanding equals statement balance, in the right bucket |
| 17 | Trial Balance | Still balanced |

**Pass condition:** all 17 steps green. File failures as `GP03-step#` in `planning/qa/findings.md`.
