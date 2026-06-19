# Company Starter Template

When creating a new company, the wizard includes a **Company Setup** step immediately before Review. There you confirm the base currency, timezone, date format, language, choose the **Inventory Control Mode**, and can keep **Auto initialize Trading Company - Simple** enabled.

This option prepares a small trading company so you can start working without opening each module setup wizard manually.

## Choose the mode once

The mode decides how ERP03 starts the company:

- **Simple** = periodic stock accounting for small trading books
- **Standard** = live inventory value on invoices, still with a simple one-invoice workflow
- **Advanced** = operational receiving/delivery workflow with perpetual inventory control

You can still change this mode later from **Inventory Settings**, but only before the first posted stock or accounting transaction.

## What It Sets Up

The starter template uses your selected mode to set up:

- The matching chart of accounts.
- Initializes Accounting, Inventory, Sales, and Purchases.
- Uses the base currency selected in Basic Needs.
- Uses the company's date defaults and a calendar fiscal year.
- Creates a Main Warehouse.
- Links default posting accounts.
- Uses simple direct workflows for **Simple** and **Standard**.
- Uses operational Sales/Purchases workflows for **Advanced**.
- Uses the matching inventory accounting mode.
- Uses one global moving-average cost per item for **Simple** and **Standard**.
- Uses warehouse-level moving-average cost for **Advanced**.
- Defaults line-price autofill to the last price for the same customer/vendor and item. A new customer/vendor with no price memory starts with a blank line.
- Blocks negative stock by default.
- Keeps tax ready for setup, but does not apply a hidden legal tax rate.

## Policy Summary

After the company is created, ERP03 shows a **Company Policy Summary**. Review it before entering real transactions.

The summary shows:

- Base currency.
- Enabled modules.
- Inventory policy.
- Sales and Purchases workflow.
- Linked accounts such as Cash, Bank, Inventory Asset, Customers Receivable, Accounts Payable, Purchase Expense, Sales Revenue, and COGS.

You can later adjust detailed settings from each module's Settings page.

If you change the mode before live posting begins, ERP03 re-applies the matching starter defaults for that mode. After live posting starts, ERP03 locks the mode to protect the books.

## Good Fit

Use **Simple** or **Standard** for a company that buys and sells stock in one base currency and wants to start quickly.

Use **Advanced** when the company needs separate receiving and delivery documents from day one.

Do not treat this template as a tax/legal configuration. Country-specific tax rates should be reviewed separately before issuing real tax invoices.
