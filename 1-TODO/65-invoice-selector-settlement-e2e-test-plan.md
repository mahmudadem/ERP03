# Invoice Selector + Settlement E2E Test Plan

**Date:** 2026-05-04  
**Purpose:** Manual browser E2E testing for the new customer/vendor account selectors and invoice settlement flows.  
**Estimated time:** 45-60 minutes  

## Before You Start

1. Open the app at `http://localhost:5173`.
2. Use a company where Accounting, Sales, Purchases, and Inventory are initialized.
3. Open browser DevTools:
   - Console: watch for red errors.
   - Network: watch for failed API requests.
4. Confirm you have:
   - At least one customer with a default AR account.
   - At least one vendor with a default AP account.
   - At least one cash/bank account.
   - At least one item or service that can be invoiced.

## A. Forms Designer Smoke Check

1. Go to `Accounting Setup > Tools > Forms Designer`.
2. Confirm group order is:
   - Your Custom Forms
   - Default Forms
   - Available in Catalog
3. Check Accounting, Sales, and Purchase tabs.
4. Confirm old custom/cloned forms appear under `Your Custom Forms`.
5. Open Sales/Purchase invoice form designs and confirm customer/vendor fields use the composite selector type where expected.

Expected result:
- Custom forms are visible.
- Default forms are visible.
- No console errors.

## B. Sales Invoice - Save Draft

1. Go to Sales.
2. Open or create a Direct Sales Invoice form.
3. Select a customer.
4. Confirm the linked receivable account auto-fills.
5. Manually change the receivable account to another valid AR account.
6. Add one invoice line:
   - Item/service
   - Quantity
   - Unit price
   - Tax if applicable
7. Confirm totals calculate.
8. Click `Save Draft`.

Expected result:
- Invoice saves successfully.
- Invoice remains draft/unposted.
- Customer remains selected.
- Receivable account remains selected.
- No payment/settlement is created.
- No console/API errors.

## C. Sales Invoice - Save & Post Deferred

1. Create another Direct Sales Invoice.
2. Select a customer and confirm receivable account auto-fills.
3. Add one invoice line.
4. Click `Save & Post`.
5. Choose or keep settlement mode `Deferred`.
6. Confirm/post.

Expected result:
- Invoice saves and posts.
- Payment status is unpaid.
- Outstanding amount equals invoice total.
- No receipt/payment voucher is created.
- Accounting voucher/ledger posting exists.
- No console/API errors.

## D. Sales Invoice - Save & Post Cash Full

1. Create another Direct Sales Invoice.
2. Select a customer.
3. Confirm receivable account auto-fills.
4. Add one invoice line.
5. Click `Save & Post`.
6. Select settlement mode `Cash Full`.
7. Choose a cash/bank settlement account.
8. Confirm settlement amount equals invoice total.
9. Confirm/post.

Expected result:
- Invoice saves and posts.
- Payment status is paid.
- Outstanding amount is zero.
- Paid amount equals invoice total.
- Payment history is created.
- Receipt voucher is auto-created and posted.
- Receivable account used matches the invoice header account.
- No console/API errors.

## E. Sales Invoice - Multi Settlement

1. Create another Direct Sales Invoice.
2. Select customer and add one invoice line.
3. Click `Save & Post`.
4. Select settlement mode `Multi`.
5. Add two settlement rows.
6. Use total settlement less than or equal to invoice total.
7. Confirm/post.

Expected result:
- If total settlement is less than invoice total, invoice is partially paid.
- If total settlement equals invoice total, invoice is paid.
- Outstanding amount is correct.
- Multiple payment history rows/vouchers are created.
- Overpayment is rejected.
- No console/API errors.

## F. Purchase Invoice - Save Draft

1. Go to Purchases.
2. Open or create a Direct Purchase Invoice form.
3. Select a vendor.
4. Confirm the linked payable account auto-fills.
5. Manually change the payable account to another valid AP account.
6. Add one invoice line:
   - Item/service
   - Quantity
   - Unit price/cost
   - Tax if applicable
7. Confirm totals calculate.
8. Click `Save Draft`.

Expected result:
- Purchase invoice saves successfully.
- Invoice remains draft/unposted.
- Vendor remains selected.
- Payable account remains selected.
- No payment/settlement is created.
- No console/API errors.

## G. Purchase Invoice - Save & Post Deferred

1. Create another Direct Purchase Invoice.
2. Select a vendor and confirm payable account auto-fills.
3. Add one invoice line.
4. Click `Save & Post`.
5. Choose or keep settlement mode `Deferred`.
6. Confirm/post.

Expected result:
- Purchase invoice saves and posts.
- Payment status is unpaid.
- Outstanding amount equals invoice total.
- No payment voucher is created.
- Accounting voucher/ledger posting exists.
- No console/API errors.

## H. Purchase Invoice - Save & Post Cash Full

1. Create another Direct Purchase Invoice.
2. Select a vendor.
3. Confirm payable account auto-fills.
4. Add one invoice line.
5. Click `Save & Post`.
6. Select settlement mode `Cash Full`.
7. Choose a cash/bank settlement account.
8. Confirm/post.

Expected result:
- Purchase invoice saves and posts.
- Payment status is paid.
- Outstanding amount is zero.
- Paid amount equals invoice total.
- Payment history is created.
- Payment voucher is auto-created and posted.
- Payable account used matches the invoice header account.
- No console/API errors.

## I. Validation Checks

Test these intentionally:

1. Save invoice without customer/vendor.
   - Expected: blocked with a clear required-field message.
2. Save invoice with customer/vendor but no AR/AP account.
   - Expected: blocked or account auto-filled.
3. Cash Full without settlement account.
   - Expected: blocked.
4. Multi settlement where total exceeds invoice total.
   - Expected: blocked.
5. Invoice with no lines.
   - Expected: blocked.
6. Invoice line with zero or negative quantity/amount.
   - Expected: blocked.

## J. Native/Default/Custom Source Checks

1. Create a Sales Invoice from the native Sales sidebar page and use `Save & Post`.
   - Expected: no `formType is required` error.
   - Expected: backend saves `source = native` and resolved `persona = direct` unless a source order/line reference makes it linked.
2. Create a Sales Invoice from a default designer form.
   - Expected: saves normally with `source = default_form`.
3. Create a Sales Invoice from a cloned/custom designer form.
   - Expected: saves normally with `source = custom_form`.
4. Repeat the same native/default/custom checks for Purchase Invoice.
   - Expected: no `formType is required` error on native, and designer forms keep their explicit `formType`, `voucherType`, and `persona`.

## K. Regression Checks

1. Open an existing saved Sales Invoice.
   - Expected: loads correctly.
2. Open an existing saved Purchase Invoice.
   - Expected: loads correctly.
3. Open Accounting voucher list after posting.
   - Expected: invoice vouchers and payment/receipt vouchers appear.
4. Refresh the page while inside invoice create/edit.
   - Expected: no spinner loop or page disappearing.

## L. Sales Return & Zero-Cost Policy Checks

1. Verify Direct Sales Return Creation
   - Go to Sales > Sales Returns.
   - Create a Direct Sales Return (do not link it to an invoice).
   - Select a customer, warehouse, and add an item with a quantity and zero unit price.
   - Click `Save Draft`.
   - Expected: Saves successfully as DRAFT.

2. Verify Perpetual Inventory Cost Blocking
   - Ensure the company is set to Perpetual Inventory (Settings > Inventory).
   - Attempt to `Save & Post` the zero-cost Direct Sales Return created in the previous step.
   - Expected: Blocked with a specific error regarding missing inventory cost or zero-cost return not allowed in Perpetual mode.

3. Verify Invoice-Driven Inventory Cost Allowance
   - Change the company inventory setting to Invoice-Driven/Periodic (Settings > Inventory).
   - Attempt to `Save & Post` the same zero-cost Direct Sales Return.
   - Expected: Posts successfully. The item is returned to inventory. The accounting voucher is generated, but cost settlement is deferred.

4. Verify Cost Fallback from Inventory Snapshot
   - While still in Invoice-Driven mode, or back in Perpetual mode, create a Sales Return where the invoice line has zero cost, but the item itself has a positive average/last cost in the warehouse.
   - Post the return.
   - Expected: Posts successfully. The return recovers the missing cost from the pre-fetched stock level snapshot.

## What To Report If Something Fails

For each failure, capture:

1. Module: Sales or Purchases.
2. Flow: Draft, Deferred, Cash Full, or Multi.
3. Exact step that failed.
4. Screenshot if possible.
5. Console error text.
6. Failed Network request URL/status.
7. Whether the form was a default form or custom cloned form.
