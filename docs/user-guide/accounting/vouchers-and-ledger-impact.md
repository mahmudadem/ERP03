# Vouchers and Ledger Impact

## What This Feature Does

Accounting vouchers are the source documents for accounting entries. A voucher shows what was entered or generated: date, voucher number, description, status, accounts, debit lines, credit lines, and audit information.

Ledger Impact shows what that voucher actually posted to the general ledger. It is read-only and appears only after the voucher has posted successfully.

## When To Use It

Use **View Voucher** when you want to inspect the accounting document.

Use **Ledger impact** when you want to confirm which ledger accounts were affected by that voucher.

## How To View Ledger Impact

1. Open **Accounting > Vouchers**.
2. Click the voucher number to open the read-only voucher view.
3. Click **Ledger impact**.
4. Review the posted ledger rows, including account, debit, credit, base amount, exchange rate, and cost center where available.
5. Use **View voucher** to return to the source voucher document.

The Accounting Dashboard recent-journal list also opens voucher view when you click a voucher number. Posted Sales and Purchase document pages may also show **GL Impact**, which opens the same accounting effect directly from the source document.

## Moving Between Records

The voucher view and ledger-impact view show a small navigation panel at the top of the page:

**Previous < Current voucher or ledger number > Next**

Use it to move through the company's vouchers in the default voucher order, regardless of the filters or search text used on the list page. If there is no previous or next voucher, the button is disabled.

## Important Rules

- Ledger Impact is read-only.
- Draft and unposted vouchers do not have ledger impact yet.
- If a posted voucher shows no ledger rows, the record should be reviewed because it may indicate a data integrity issue.
- To correct a posted accounting effect, use the voucher correction/reversal workflow. Do not edit ledger rows directly.
- The long ID in the browser link is an internal voucher ID. Access is still checked against the active company, so users cannot open another company's voucher by changing the link.
