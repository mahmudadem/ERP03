# Task 240g — Phase 7 Golden-Path Periodic QA

## Status

Phase 7 is now **green** and Epic 240 can be closed.

The first fresh periodic tenant (`cmp_mqk28li8_dcor0q`) exposed the final live blocker: Trading Account returned `hasData=false` because the seeded accounts were missing `plSubgroup` tags. After commit `aa28f203` fixed the seeding path, the closeout was re-run on a **brand-new** periodic tenant and the gate passed end-to-end.

Final status:
- periodic PI/SI post to Purchases/AP and AR/Sales with **no** inventory/COGS per-transaction lines
- DN/GRN/adjustments/transfers move **quantity only**
- Balance Sheet inventory uses **report-time valuation**
- periodic Trading Account now computes live and matches P&L + valuation math
- periodic GP05 step 4 remains **non-applicable by construction**
- the perpetual comparison tenant still shows **Inventory GL drift = 0**

`golden-paths-green` is now **ON**.

## Environment / Method

- Branch: `codex/240e-report-time-valuation`
- Original blocked periodic tenant: `240g Periodic Trading Co Final` (`cmp_mqk28li8_dcor0q`) — retained only as the pre-fix evidence because its already-created accounts stayed untagged
- Final closeout periodic tenant: `240g Periodic Trading Co Final 1781835450954` (`cmp_mqkatlbu_l8bmja`)
- Perpetual comparison tenant: `240g Perpetual Trading Co` (`cmp_mqk20i75_09f0tq`)
- Region/profile used: `SYP`, `Asia/Damascus`, `DD-MM-YYYY`
- Verification method:
  - authenticated REST against the Firebase Functions emulator
  - Firestore emulator inspection for stock / voucher evidence
  - report endpoints for TB / BS / P&L / Trading / statements / aging / valuation
- Browser note:
  - the current dirty worktree contains an unrelated Vite JSX parse error in the AI-assistant pages
  - the owner explicitly said not to touch those files
  - because of that, browser-driven wizard QA was blocked by the overlay, so the same onboarding contract was driven through the emulator APIs instead

## Fresh-Tenant Re-Verification Addendum (post-`aa28f203`)

### Closeout tenant

- Company: `240g Periodic Trading Co Final 1781835450954`
- Company id: `cmp_mqkatlbu_l8bmja`
- Replay window:
  - opening stock date: **2026-06-18**
  - trading / GP05 window: **2026-06-19 → 2026-06-19**

### Re-closeout log

| Step | Result | Evidence |
|---|---|---|
| Rebuild + emulator restart | Pass | Rebuilt compiled backend with `npm --prefix backend run build`, restarted the Functions emulator, and re-seeded system metadata once so `periodic_trading` was available again |
| Fresh periodic tenant | Pass | Onboarding API created `cmp_mqkatlbu_l8bmja` with `PERIODIC`, `SYP`, `Asia/Damascus`, `DD-MM-YYYY` |
| Account subgroup tags | Pass | Sales `400/401/402` resolved with `plSubgroup=SALES`; Trading/Purchases `501/50101/50102/50103/50104` resolved with `plSubgroup=COST_OF_SALES` |
| QA-only tenant access patch | Pass | Re-applied the known disposable-tenant patch so `sales` and `purchase` are available under the `trading-basic` bundle: updated company `modules[]`, added matching entitlement items, and enabled linked-persona governance in Sales/Purchases settings |
| Minimal periodic replay | Pass | Opening stock **100 @ 10** posted on **2026-06-18** (voucher `33ad7a35-c0e7-466c-b0b8-79c0b7556283` = Dr `10301` 1000 / Cr `303` 1000). On **2026-06-19**: `SO-00001` → `DN-00001` (`cogsVoucherId=null`) → `SI-00001` (`voucherId=050643a6-62ae-4fa7-b462-2ad2f48f2be5`, `cogsVoucherId=null`) and `PO-00001` → `GRN-00001` (`voucherId=null`) → `PI-00001` (`voucherId=09c3aa3d-5f22-4b1b-a21f-cc4f2e2e9f64`) |
| Periodic posting proof | Pass | SI ledger = Dr `10401-CUST-849010` 150 / Cr `400` 150 only. PI ledger = Dr `50101` 500 / Cr `20100-VEND-849010` 500 only. No inventory/COGS lines on SI/PI, and no vouchers on DN/GRN |
| Quantities + valuation | Pass | Final stock = **140 units @ avg 10**. As-of valuation on **2026-06-19** = **1400**. Balance Sheet inventory line `10301` = **1400** |
| Trading Account | Pass | Live endpoint returned `hasData=true`, `netSales=150`, `costOfSales=100`, `grossProfit=50`, `openingInventory=1000`, `netPurchases=500`, `closingInventory=1400` |
| P&L tie-out | Pass | Periodic P&L matched the same formula: `grossProfit=50`, `openingInventory=1000`, `netPurchases=500`, `closingInventory=1400` |
| GP05 remainder | Pass | TB balanced **1650 = 1650**; BS balanced **1550 = 1550**; AR statement/aging **150**; AP statement/aging **500**; GRNI **0**; replay produced exactly three vouchers (opening stock, SI, PI) and no duplicate-voucher regression was observed |

## Periodic Tenant Log

### GP01 — Onboarding + Accounting

| Step | Result | Evidence |
|---|---|---|
| Create fresh periodic tenant | Pass (API-driven adaptation) | Onboarding API created `cmp_mqk28li8_dcor0q`; resulting tenant policy matched `PERIODIC`, `inventoryAccountingMethod=PERIODIC`, `costingBasis=GLOBAL`, Sales/Purchases SIMPLE direct defaults |
| Accounting baseline | Pass | Cash/Capital JV posted; TB balanced `1375 = 1375`; Balance Sheet balanced `1375 = 1375`; Cash ledger running balance 1375 |
| Period lock | Pass | backdated JV rejected with `PERIOD_LOCKED`; today-dated JV posted |
| Approval flow | Pass | maker `/approve` moved draft→pending; checker `/verify` moved pending→approved+posted |

### GP02 — Inventory

| Step | Result | Evidence |
|---|---|---|
| 1 | Pass | `General` category existed/created |
| 2 | Pass | `ITEM-A` created as stock item, `PCS`, purchase 10, sale 15 |
| 3 | Pass | `SRV-1` created as service/non-stock |
| 4 | Pass | `WH-2` created |
| 5 | Pass | Opening Stock 100 @ 10 posted to MAIN; stock MAIN=100; voucher `8c44144e-c030-4fa5-ae93-ce4885085633` = Dr `10301` 1000 / Cr `303` 1000 |
| 6 | Pass | Stock Levels showed MAIN 100, WH-2 0 |
| 7 | Pass | FLAT transfer 20 MAIN→WH-2 completed; MAIN 80 / WH-2 20; no voucher |
| 8 | Pass (periodic adaptation) | Stock Adjustment -5 MAIN posted; MAIN 75; stock movement created; **voucherId null** because periodic adjustments are quantity-only |
| 9 | Pass | oversized OUT rejected with `NEGATIVE_STOCK_BLOCKED` and readable item/warehouse labels |
| 10 | Pass | movement order matched the math: opening +100, transfer -20/+20, adjustment -5 |
| 11 | Pass | Inventory Valuation total `950` = MAIN `75 x 10` + WH-2 `20 x 10` |
| 12 | Pass (periodic adaptation) | generic TB inventory-GL-vs-valuation check is not the periodic gate; live inventory GL is not maintained through transfer/adjustment/sales/purchases in periodic mode |

### GP03 — Sales / Order-to-Cash

| Step | Result | Evidence |
|---|---|---|
| 1 | Pass | `CUST-1` created; AR sub-account auto-created (`10401-CUST-1`) |
| 2 | Pass | Customer Statement empty |
| 3 | Pass | Quote `QT-00001` saved for `10 x ITEM-A @ 15` |
| 4 | Pass | Quote sent→accepted→converted to `SO-00001`; SO confirmed |
| 5 | Pass (periodic adaptation) | `DN-00001` posted; stock MAIN `75 → 65`; `cogsVoucherId=null` |
| 6 | Pass | linked `SI-00001` created from the SO/DN chain |
| 7 | Pass | line discount 10% reduced the stock line to 135 |
| 8 | Pass | invoice-level Freight 50 + Discount 20 produced grand total 165 |
| 9 | Pass | `SI-00001` POSTED + PAID; linked receipt created |
| 10 | Pass (periodic proof) | invoice voucher `7ce4327f-f035-485f-ab9a-ef94b0c24bb3` = Dr AR 165 / Dr Sales Discounts 35 / Cr Sales 150 / Cr Sales 50; `cogsVoucherId=null` |
| 11 | Pass | payment history showed the linked cash receipt |
| 12 | Pass (product-path note) | over-payment success path works through **Record Payment**, not through a `CASH_FULL` settlement bigger than the invoice. With allow-overpayment ON, `SI-00002` accepted a 1500 payment on a 1000 invoice and left customer credit; with allow-overpayment OFF, the same 1500 record-payment was rejected with `OVERPAYMENT_NOT_ALLOWED` |
| 13 | Pass | direct `SI-00003` posted deferred; record-payment 500 changed it to `PARTIALLY_PAID`; `cogsVoucherId=null` |
| 14 | Pass | `SR-00001` posted against `SI-00001`; stock +2; AR/customer credit-note math held |
| 15 | Pass | Customer Statement closing balance `-27` |
| 16 | Pass | AR Aging total `-27` = statement closing balance `-27` |
| 17 | Pass | Trial Balance still balanced |

### GP04 — Purchases / Procure-to-Pay

| Step | Result | Evidence |
|---|---|---|
| 1 | Pass | `VEND-1` created; AP sub-account auto-created (`20100-VEND-1`) |
| 2 | Pass | Vendor Statement empty |
| 3 | Pass | `PO-00001` confirmed for `50 x ITEM-A @ 10` |
| 4 | Pass (periodic adaptation) | `GRN-00001` posted; stock +50; **voucherId null** |
| 5 | Pass | linked `PI-00001` created from PO/GRN |
| 6 | Pass | line discount 5% applied to the invoice line |
| 7 | Pass | Freight 30 (CHARGE) + Discount 10 (DISCOUNT) produced grand total 495 |
| 8 | Pass (periodic proof) | `PI-00001` posted deferred; voucher `cc188d33-86e0-468b-95b2-5c0312c1c70e` = Dr Purchases 475 / Dr Purchases 30 / Cr Purchases 10 / Cr AP 495; no inventory/GRNI lines |
| 9 | Pass | full payment recorded; invoice became `PAID` |
| 10 | Pass | `PR-00001` posted for 5 units; stock -5; AP/debit-note reversal held |
| 11 | Pass | Vendor Statement closing balance `-47.5` |
| 12 | Pass | AP Aging total `-47.5` = statement closing balance `-47.5` |
| 13 | Pass | quantity math reconciled exactly: GP02 ending `95`, GP03 DN `-10`, GP03 direct invoices `-2`, GP03 sales return `+2`, GP04 GRN `+50`, GP04 purchase return `-5` = final `130` |
| 14 | Pass | Trial Balance still balanced |

### GP05 — Cross-Module Books Check

| Check | Result | Evidence |
|---|---|---|
| 1 Trial Balance | Pass | `totalClosingDebit=4649.5`, `totalClosingCredit=4649.5`, `difference=0` |
| 2 Balance Sheet | Pass | `isBalanced=true`; inventory line on `10301` showed `1300`; AR `-27` and AP `-47.5` tied to statements/sub-accounts |
| 3 P&L / Trading | **Partial** | periodic P&L was populated and used a `periodic-cost-of-sales` line `-1300`, but the Trading Account endpoint returned `hasData=false` and all zeroes |
| 4 Inventory reconciliation | Pass (N/A by construction) | periodic mode has no per-transaction inventory-GL posting path on PI/SI/DN/GRN/adjustments/transfers; the real periodic proof is Balance Sheet inventory `1300` = valuation `1300` |
| 5 AR reconciliation | Pass | AR Aging `-27` = Customer Statement `-27` = AR control/sub-account |
| 6 AP reconciliation | Pass | AP Aging `-47.5` = Vendor Statement `-47.5` = AP control/sub-account |
| 7 GRNI | Pass | GRNI = 0 |
| 8 Posting log | Pass | no regression observed versus the same fresh-tenant control path |
| 9 Audit trail | Pass | no regression observed versus the same fresh-tenant control path |
| 10 Idempotency | Pass | no duplicate-voucher regression observed |

## Perpetual Comparison

Target: confirm the old backlog-223 GP05 step-4 drift does **not** reappear on a fresh perpetual tenant.

### Tenant

- `240g Perpetual Trading Co`
- company id: `cmp_mqk20i75_09f0tq`

### Minimal comparison flow

| Step | Result | Evidence |
|---|---|---|
| Opening stock | Pass | 100 @ 10 posted |
| PO→GRN | Pass | `PO-00001` / `GRN-00001`; GRN posted a voucher as expected in perpetual mode |
| Discounted PI | Pass | linked `PI-00001` with 5% line discount posted |
| GP05 step 4 comparison | Pass | Inventory GL Reconciliation returned `totalStockValueBase=1500`, `totalGLBalanceBase=1500`, `totalDifferenceBase=0` |

## Findings / Decisions

### Resolved blocker

- **Live periodic Trading Account report is fixed and re-verified.**
  - Root cause:
    - the original fresh tenant seeded accounts without `plSubgroup` tags because `InitializeAccountingUseCase` dropped `plSubgroup` / `equitySubgroup` during account creation
  - Fresh-tenant proof after the fix:
    - new seeded accounts carry the expected tags
    - Trading endpoint now returns `hasData=true`
    - gross profit matches `Sales - (Opening + Net Purchases - Closing)` on the live stack
  - Impact:
    - Epic 240 can now be declared fully green
    - the owner-required Trading Account proof is now present in the live emulator stack

### Important product-path note

- Over-payment is validated on the **payment-recording path**, not by allowing a `CASH_FULL` settlement larger than the invoice total at post time.
- QA was adjusted to follow the actual product control path rather than logging a false failure.

### Environment note

- Browser-only wizard QA was blocked by an unrelated dirty Vite JSX overlay in the AI-assistant files the owner explicitly said not to touch.
- The onboarding / document / report contracts were still fully exercised through the emulator APIs and verified against Firestore.

## Technical Developer View

- No product code was changed in 240g.
- This task was a live QA gate against the compiled emulator backend.
- The periodic accounting model itself held:
  - opening stock still uses one-time GL
  - DN/GRN/transfer/adjustment stayed quantity-only
  - SI/PI posted only AR/Sales and Purchases/AP
  - Balance Sheet inventory used report-time valuation
  - periodic GP05 step 4 was non-applicable by design
- Final closeout note:
  - the original blocked tenant stayed untagged and was intentionally abandoned
  - the final proof came from a brand-new tenant created after the subgroup-tag fix landed
  - the `sales` / `purchase` module exposure tweak was a **QA-only tenant patch**, not product code

## End-User View

- The new **Simple / Periodic** stock-accounting mode now behaves the way a small trading company expects in live operations:
  - goods quantities stay correct
  - invoices post Sales / Purchases instead of real-time inventory/COGS
  - the Balance Sheet still shows a current stock value from the quantity on hand
- The last owner-facing proof is now present too: the dedicated **Trading Account** report shows the correct gross profit on the live periodic tenant.

## Files Touched

- `planning/qa/findings.md`
- `planning/done/240g-phase7-golden-path-periodic-qa.md`
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`

## Time Spent

- Approx. `5.5h` total across the blocked first run + the fresh-tenant closeout re-verification
