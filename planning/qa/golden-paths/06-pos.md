# Golden Path 06 — POS

> **Goal:** prove the POS module can run a retail day end-to-end without breaking cash control, inventory, sales posting, returns, or financial reports.
> **Precondition:** Golden Paths 01–02 passed on this tenant. Sales, Inventory, and Accounting must be initialized. POS module must be entitled for the company. Backend must be rebuilt before the run.

## Accounting / ERP Review

This is not only a cashier-screen test. POS touches the same financial controls as Sales:

- Each sale must create a real posted Sales Invoice through the existing Sales posting path.
- Stock must move through the existing inventory/costing rules; POS must not invent its own COGS logic.
- Cash drawer expected cash must reconcile to cash movements and counted cash.
- Returns must create posted Sales Returns against the original POS invoice, not loose negative sales.
- Over/short must post balanced journal vouchers to the configured cash over/short accounts.
- Reports must agree with receipts, shifts, and the linked Sales documents.

Payment Methods is no longer an accepted placeholder report: it must aggregate the stored receipt payment rows. CASH must be shown net of change so the report agrees with posted settlement and shift cash math.

## Time Budget

Estimated manual run time: **60–90 minutes** on a fresh tenant if master data from Golden Paths 01–02 already exists. Add another 30 minutes if POS permissions, registers, and payment accounts need to be created from scratch.

## A. Setup and Governance

| # | Step | Expected |
|---|------|----------|
| 1 | Confirm POS module is enabled for the company and the user has POS permissions | POS menu appears; restricted users cannot access manager-only pages |
| 2 | Open POS Settings and enable **Allow POS Direct Sales** | Settings save with a success toast; POS policy allows `POS_DIRECT_SALE` without requiring a Sales Settings governance rule |
| 3 | Configure walk-in customer | Customer must be an existing CUSTOMER party; no free-text customer id |
| 4 | Configure payment-method behavior: CASH enabled/allows change/no reference; CARD enabled/requires reference/no change | Settings save; payment accounts are not entered here because money routing belongs to each register |
| 5 | Configure Cash Over and Cash Short accounts | Settings save; these accounts are later used for variance vouchers |
| 6 | Create register `POS-01` with warehouse `WH-1`, cash drawer account, and CARD/BANK/CUSTOM settlement accounts if those methods are used at this till | Register appears in the list; warehouse and account references are valid master data |
| 6b | Create register `POS-02` with its own cash drawer and non-cash settlement accounts | Register appears separately; later sales from `POS-02` must use `POS-02` accounts, not `POS-01` or company-level accounts |

## B. Shift Lifecycle

| # | Step | Expected |
|---|------|----------|
| 7 | Open a shift on `POS-01` with opening float 100 | Shift status is OPEN; opening float is recorded |
| 8 | Try to open a second shift on the same register | Blocked with clear message: only one OPEN shift per register |
| 9 | Record cash pay-in 20 with a reason | Expected cash increases; movement appears in shift activity |
| 10 | Record cash pay-out 5 with a reason | Expected cash decreases; movement appears in shift activity |
| 11 | Open X Report for the shift | Expected cash = opening float + pay-in - pay-out before sales |

## C. POS Sale — Cash Exact

| # | Step | Expected |
|---|------|----------|
| 12 | Search for an in-stock item from Golden Path 02 | Item appears with correct code/name/UOM/price context; no non-existent item can be sold |
| 13 | Sell 1 × ITEM-A @ 10, pay CASH 10 | Receipt created; linked Sales Invoice is POSTED and PAID |
| 14 | Open the linked Sales Invoice | `source = pos`, `formType = pos_sale`; settlement row is CASH 10; warehouse is the register warehouse |
| 15 | Check stock level for ITEM-A in WH-1 | Quantity decreased by 1; costing follows the company inventory mode |
| 16 | Reopen X Report | Expected cash increased by 10 |

## D. POS Sale — Split Payment and Change

| # | Step | Expected |
|---|------|----------|
| 17 | Sell 2 × ITEM-A @ 5; payment CASH 8 with change 2 plus CARD 4 with reference `AUTH-1` | Receipt total is 10; change is 2; Sales Invoice settlement totals exactly 10 |
| 18 | Try CARD payment without required reference | Blocked with clear message |
| 19 | Try payment total below sale total | Blocked with clear message |
| 20 | Try CARD change | Blocked; only CASH can give change |
| 20b | Temporarily remove CARD settlement account from the active register, then try a CARD sale | Blocked before draft invoice creation with a message to configure the CARD settlement account on that register |

## E. Returns

| # | Step | Expected |
|---|------|----------|
| 21 | Return 1 unit from the step-17 receipt with CASH refund | POS return created; linked Sales Return is POSTED with `AFTER_INVOICE`; cash movement `REFUND_CASH` is recorded |
| 22 | Try to return more than sold quantity | Blocked with clear message |
| 22b | Try to return the same unit again after step 21 | Blocked because prior POS returns reduce remaining returnable quantity |
| 23 | Check stock level | Returned quantity is added back according to existing Sales Return inventory logic |
| 24 | Check X Report | Expected cash decreased by the cash refund |
| 24b | Void a different completed receipt with no prior returns | POS creates a return for every active receipt line, posts the reversal, and marks the original receipt `VOIDED` |
| 24c | Partially return another receipt, then void it | Void returns only the remaining active quantities; already-returned quantities are not refunded again |
| 24d | Exchange a returned item for a more expensive replacement item | POS creates one return and one replacement sale with the same exchange id; response shows net amount due from customer |
| 24e | Exchange a returned item for a cheaper replacement item | POS creates one return and one replacement sale with the same exchange id; response shows net refund to customer |

## F. Shift Close and Cash Variance

| # | Step | Expected |
|---|------|----------|
| 25 | Close shift with counted cash equal to expected cash | Shift closes; no over/short voucher is created |
| 26 | Open a new shift, make a small cash sale, then close with counted cash higher than expected | Shift closes; balanced journal voucher posts Dr Cash Drawer / Cr Cash Over |
| 27 | Open another shift, make a small cash sale, temporarily remove Cash Short account, then close with counted cash lower than expected | Close is blocked until Cash Short account is configured |
| 28 | Configure Cash Short account and retry close | Shift closes; balanced journal voucher posts Dr Cash Short / Cr Cash Drawer |
| 29 | Manager force-closes another user's open shift | Requires `pos.shift.forceClose`; shift becomes FORCE_CLOSED and remains auditable |

## G. Governance and Permissions

| # | Step | Expected |
|---|------|----------|
| 30 | Disable **Allow POS Direct Sales** in POS Settings, then try to complete a sale | Sale is rejected by the existing Sales persona guard; cashier sees an error toast; no receipt or invoice is created |
| 31 | Re-enable **Allow POS Direct Sales** | POS sales work again |
| 32 | Login as a cashier without settings/register permissions | Terminal access works if granted; settings/register management pages are hidden or blocked |
| 33 | Login as a cashier without reports permission | POS reports are hidden or blocked |

## G2. Cashier Policy Limits and Override Audit

| # | Step | Expected |
|---|------|----------|
| 33a | Configure or seed a cashier role policy with a low max discount percent/amount and price/tax override disabled | Policy saves for that cashier role |
| 33b | Try a POS sale with an over-limit manual line discount and no captured manager approval | Blocked before receipt, stock, ledger, payment, or cash movement persistence |
| 33c | Repeat the same sale, click **Capture approval** in the Tender dialog, select a manager, enter the reason, and complete the sale | Sale completes; receipt line carries the generated manager override id and discount metadata |
| 33d | Create or inspect a receipt containing a voided line, price override flag, tax override flag, and/or manual discount | Receipt snapshot keeps the exception metadata for audit review |

## H. Reports

| # | Step | Expected |
|---|------|----------|
| 34 | Z Report for each closed shift | Opening float, sales cash, refunds, movements, counted cash, and variance match hand calculation |
| 35 | Daily Summary for the test date | Receipt count, return count, net sales, and cash/refund direction match the run |
| 36 | Cashier Sales | Cashier user appears with correct receipt count and total |
| 37 | Cash Over/Short | Only variance shifts appear; voucher links are present where variance was posted |
| 38 | Receipt History | Receipts show linked Sales Invoice numbers and can be traced back to POS activity |
| 39 | Payment Methods report | CASH / CARD / BANK_TRANSFER / CUSTOM totals match stored receipt payment rows; CASH is net of change |
| 39b | Override Audit report endpoint `/tenant/pos/reports/override-audit` | Returns rows for voided lines, manual discounts, price overrides, and tax overrides with receipt/register/shift/cashier context |

## I. Cross-Module Accounting Checks

| # | Check | Expected |
|---|-------|----------|
| 40 | Trial Balance | Balanced to the cent after all POS sales, returns, refunds, and variance vouchers |
| 41 | General Ledger for Cash Drawer account | Opening float is not a GL entry; POS settlements and over/short adjustments match closed-shift cash math |
| 42 | Sales Invoice list | POS invoices are posted, paid where applicable, and identifiable as POS-origin documents |
| 43 | Sales Return list | POS returns are posted and linked to original invoice context |
| 44 | Inventory valuation / stock level | Quantity and value reflect POS sales minus POS returns; no unexplained negative stock |
| 45 | Gross Profit reports, if facts exist for the tested documents | POS-origin Sales Invoices appear consistently with normal Sales Invoices, subject to any documented backfill boundary |

## Failure Logging

File every failure in `planning/qa/findings.md` as:

```text
GP06-step## — POS — observed: ... expected: ... company: ... user: ... screenshot/log: ...
```

Stop the run only for blockers that prevent later steps, such as no POS entitlement, inability to open a shift, or sales posting failures. Accounting mismatches in steps 40–45 are **P0 accounting bugs** and must go above normal feature work.

## Pass Condition

Golden Path 06 passes only when:

- Setup, register, shift, sale, return, close, and report flows complete on one tenant.
- Trial Balance remains balanced.
- POS receipts reconcile to linked Sales Invoices / Sales Returns.
- Cash drawer expected cash reconciles to counted cash and over/short vouchers.
- Inventory quantity and valuation move through the existing Sales/Inventory posting paths.
