# POS Owner Test Guide

**Date:** 2026-06-22
**Use with:** [Golden Path 06 — POS](./golden-paths/06-pos.md)

## What to Test First

Run this on a fresh company where Accounting, Inventory, Sales, and POS are initialized.

## Architecture Confirmations Already Checked in Code

- Promotions are hard-disabled by default.
- POS uses `POS_DIRECT_SALE` as the document persona in posting metadata.
- POS application code does not import Sales application/domain internals.
- POS settings writes POS policy, not Sales Settings governance.
- POS uses `POSPolicy`, `POSTerminalPolicy`, and `CashierRolePolicy`.
- POS financial events route through `IAccountingBridge`.
- POS stock movement routes through `IInventoryCore`.
- POS below-cost approval path uses the shared approval engine through Commercial Core.
- POS manager override hooks route through POS policy for void, price override, discount override, returns, tax override, and reprint.
- POS cashier role limits can require manager approval for over-limit discounts and blocked price/tax overrides.
- POS direct-sale permission uses `IPolicyEngine`.
- POS architecture tests cover Sales-import independence and POS stock-reference identity.
- POS cart line voids persist as receipt audit rows and are excluded from posting/returns.
- POS registers persist default price list id, allowed cashiers, and hardware profile id; allowed cashiers are enforced on shift open.
- POS shift close stores expected/counted/variance by payment method and marks fully balanced shifts `RECONCILED`.
- POS override audit report returns void, discount, price override, and tax override exception rows from receipt snapshots.
- POS posted receipt void creates a POS return for remaining active quantities before marking the receipt `VOIDED`.
- POS exchange creates a linked POS return and replacement POS sale with one `exchangeId`.

1. Open **POS → Settings**.
2. Enable **Allow POS direct sales** and save.
3. Configure:
   - walk-in customer
   - CASH enabled, allows change, no reference
   - CARD enabled, requires reference, no change
   - Cash Over account
   - Cash Short account
4. Open **POS → Registers**.
5. Create `POS-01` with:
   - warehouse
   - cash-drawer account
   - CARD settlement account
   - default price list id placeholder
   - hardware profile id placeholder
   - one allowed cashier
6. Create `POS-02` with a different cash drawer and CARD settlement account.
7. Try opening a shift on `POS-01` as a cashier not in the allowed list.
8. Expected: shift open is blocked.
9. Open a shift on `POS-01` with the allowed cashier and opening float `100`.
10. Sell one in-stock item with exact CASH.
11. Start a second sale, add two items, void one line with a reason, then complete the sale with split CASH + CARD and CARD reference.
12. Confirm:
    - receipt created
    - POS invoice posted
    - the voided line remains on the receipt audit trail with reason/user/time
    - the voided line did not reduce inventory or affect revenue/tax/COGS
    - CASH settlement uses the register cash drawer
    - CARD settlement uses the register CARD settlement account
    - inventory quantity decreased
13. Try returning the voided line from the receipt.
14. Expected: return is blocked because voided lines are not sold quantity.
15. Try a CARD sale on a register with no CARD settlement account.
16. Expected: sale is blocked before any receipt or posting is created.
17. Process a CASH return from a completed receipt active line.
18. Confirm:
    - return posts through POS return flow
    - current shift expected cash decreases
    - stock quantity increases
19. Close a shift with exact counted CASH/CARD/BANK/CUSTOM totals and confirm status becomes `RECONCILED`.
20. Close another shift with over/short cash and confirm the voucher posts to the configured over/short account.
21. Close or inspect a shift with non-cash variance and confirm the variance is stored but no automatic GL voucher is posted for non-cash difference.
21a. Start a sale with at least one active line and click **Hold**.
21b. Confirm the cart clears and **Recall** shows the held sale for the same shift/register.
21c. Recall it, complete payment, and confirm the sale posts only after payment, not when it was held.
21d. Hold another sale and cancel it from **Recall**. Confirm it disappears from the held list and no receipt/payment/stock movement is created.
22. Open **POS → Reports → Payment Methods**.
23. Confirm payment totals are real, not zero placeholders. CASH must be net of change.
24. Configure or seed a cashier role policy with:
    - max line discount percent below the test discount
    - `allowPriceOverride = false`
    - `allowTaxOverride = false`
25. Try completing a sale with an over-limit manual discount and no manager override id.
26. Expected: sale is blocked before receipt/posting.
27. Repeat with a manager override id supplied by API/test harness.
28. Expected: sale completes and the receipt line carries the manager override id.
29. Open **POS → Reports → Override Audit** or query `/tenant/pos/reports/override-audit` for the same date/register.
30. Confirm rows appear for manual discount, price override, tax override, and any voided lines.
31. Void a posted receipt that has no prior returns.
32. Expected: a POS return is created for all active lines, stock and settlement reverse, and the original receipt status becomes `VOIDED`.
33. Try returning the same receipt again.
34. Expected: return is blocked because there is no remaining returnable quantity.
35. On another receipt, process a partial return, then void the receipt.
36. Expected: the void returns only the remaining quantity, not the already-returned quantity.
37. Process an exchange where the replacement item is more expensive than the returned item.
38. Expected: one POS return and one replacement POS receipt are created with the same exchange id; the response shows net due from customer.
39. Process an exchange where the replacement item is cheaper than the returned item.
40. Expected: one POS return and one replacement POS receipt are created with the same exchange id; the response shows net refund to customer.

## Stop Conditions

Stop and log the failure in `planning/qa/findings.md` if any of these happen:

- POS sale posts without an open shift.
- A cashier outside a register's allowed-cashier list can open a shift on that register.
- CARD sale posts without a register CARD settlement account.
- Payment Methods report shows zero totals after completed receipts.
- A voided cart line disappears completely instead of staying on the receipt audit trail.
- A voided line changes stock, ledger, tax, cash, or returnable quantity.
- Trial Balance is not balanced after sales, returns, and over/short vouchers.
- Non-cash settlement variance auto-posts to GL without a separate clearing/reconciliation workflow.
- Over-limit discount or blocked price/tax override posts without manager approval.
- Override audit report is empty after receipts with voids/manual discounts/price or tax override flags.
- A posted receipt can be marked `VOIDED` without a linked POS return / financial reversal.
- A receipt can be refunded twice for the same sold quantity.
- Exchange creates only one side of the transaction, or the return and replacement sale are not linked by exchange id.
- Inventory quantity or valuation does not move after POS sales/returns.

## Expected Accounting Behavior

- Opening float is not a GL posting.
- CASH sale settlement debits the register cash drawer.
- CARD/BANK/CUSTOM settlement debits the active register's settlement account for that method.
- Sales revenue, tax, and COGS follow the shared POS/System Core posting path.
- Cash over posts Dr Cash Drawer / Cr Cash Over.
- Cash short posts Dr Cash Short / Cr Cash Drawer.
