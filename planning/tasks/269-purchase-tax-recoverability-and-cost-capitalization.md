# Task 269 - Purchase Tax Recoverability and Cost Capitalization

**Status:** Planned  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Created:** 2026-06-26  
**Estimated time:** 3-5 hours  
**Priority:** P0 accounting correctness follow-up after Task 268

## Context

Manual QA raised the question: should purchase tax always be excluded from inventory average cost?

Answer: no. Purchase tax treatment depends on recoverability:

- **Recoverable purchase tax** is posted separately to an input/recoverable tax account and excluded from inventory or expense cost.
- **Non-recoverable purchase tax** is part of the acquisition cost and must be capitalized into inventory for stock items, or included in expense for service/expense lines.
- **Partly recoverable purchase tax** is a later extension: split recoverable and non-recoverable portions.

This is separate from tax price basis:

- **Price Basis** controls whether entered price includes tax (`Inclusive`) or tax is added on top (`Exclusive`).
- **Purchase Tax Treatment** controls whether purchase tax affects cost (`Recoverable` vs `Non-recoverable`).

Sales tax does not need a cost-treatment flag because sales tax is normally output tax collected from customers and owed to the tax authority. It affects AR and VAT payable, not inventory cost or COGS.

## Goal

Add a purchase-side tax treatment model so users can define tax codes that either:

1. Post purchase tax separately as recoverable tax; or
2. Include purchase tax in inventory/expense cost as non-recoverable tax.

The system must handle both inclusive and exclusive price basis correctly.

## Required Accounting Behavior

| Case | Entered Price | Price Basis | Purchase Treatment | AP Total | Inventory/Expense Cost | Tax Line |
|---|---:|---|---|---:|---:|---:|
| Recoverable exclusive | 1200 | Exclusive | Recoverable | 1320 | 1200 | 120 |
| Non-recoverable exclusive | 1200 | Exclusive | Non-recoverable | 1320 | 1320 | 0 |
| Recoverable inclusive | 1200 | Inclusive | Recoverable | 1200 | 1090.91 | 109.09 |
| Non-recoverable inclusive | 1200 | Inclusive | Non-recoverable | 1200 | 1200 | 0 |

For stock purchase lines, non-recoverable tax must affect:

- inventory debit
- stock movement cost
- blended average cost
- inventory valuation reports

For expense/service purchase lines, non-recoverable tax must affect:

- expense debit
- no separate purchase tax debit

## Scope

In scope:

- Tax Code master data model/API/DTO: add purchase tax treatment.
- Tax Codes UI: show and edit purchase tax treatment.
- Purchase Invoice line calculation and posting.
- Goods Receipt / Purchase Return behavior if they use purchase tax in the same path.
- Inventory movement valuation for PI stock lines.
- Golden tests proving voucher and valuation behavior.

Out of scope:

- Sales tax behavior changes.
- Partly recoverable tax percentages.
- Tax authority reporting.
- Migration of existing tax codes beyond a safe default.

## Data Model

Recommended v1 field:

```ts
purchaseTaxTreatment: 'RECOVERABLE' | 'NON_RECOVERABLE'
```

Default for existing tax codes:

```ts
RECOVERABLE
```

Reason: current system behavior posts purchase tax separately, so this preserves existing output unless the user explicitly chooses non-recoverable treatment.

Future-compatible alternative:

```ts
recoverableRate: number // 1 = recoverable, 0 = non-recoverable, future 0.5 = partly recoverable
```

For v1, prefer enum unless the implementation already has a recoverability field.

## Backend Requirements

1. Extend tax code domain/entity/DTO/repositories to persist purchase tax treatment.
2. Preserve backward compatibility by defaulting missing values to `RECOVERABLE`.
3. Update Purchase Invoice tax/cost calculation:
   - Recoverable tax remains a separate tax debit.
   - Non-recoverable tax is added to line cost.
4. Update PI posting:
   - Recoverable: Debit Inventory/Expense net, Debit Purchase Tax, Credit AP gross.
   - Non-recoverable: Debit Inventory/Expense gross, Credit AP gross, no tax line.
5. Update inventory cost movement for stock PI lines:
   - non-recoverable tax must be included in stock valuation cost.
6. Update returns/reversals where needed:
   - purchase returns must reverse the same cost/tax treatment used by the source document.
7. Add tests:
   - PI recoverable exclusive voucher + stock cost unchanged.
   - PI non-recoverable exclusive voucher + stock cost includes tax.
   - PI recoverable inclusive voucher + stock cost excludes tax.
   - PI non-recoverable inclusive voucher + stock cost equals entered gross.
   - no Sales Invoice voucher output changes.

## Frontend Requirements

Tax Codes page must show both separate concepts:

- **Price Basis**
  - Exclusive - tax is added on top
  - Inclusive - entered price already includes tax

- **Purchase Tax Treatment**
  - Recoverable - post purchase tax separately
  - Non-recoverable - include purchase tax in item/expense cost

For sales-only tax codes, the UI may hide or disable Purchase Tax Treatment, but for `PURCHASE` and `BOTH` it must be explicit.

Document pages should display the effective treatment clearly enough for QA:

- PI line/totals should make it clear whether tax is separate or included in cost.
- GL Impact should show no separate tax line for non-recoverable purchase tax.

## Acceptance Criteria

- A user can create a tax code that is inclusive + non-recoverable.
- A user can create a tax code that is exclusive + non-recoverable.
- PI posting and stock average cost match the four-case table above.
- Existing recoverable tax behavior remains unchanged by default.
- Sales tax behavior and Sales Invoice voucher output do not change.
- Tax-code lock rules from Task 268 still apply: once used in posted documents, purchase tax treatment is accounting-critical and cannot be changed.

## Verification Commands

Run from `D:\DEV2026\ERP03-267-engine-audit`:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseInvoiceGoldenVoucher.test.ts
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts
npm --prefix backend test -- --runInBand src/tests/application/system-core/TaxEngine.test.ts
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesInvoiceGoldenVoucher.test.ts
npm --prefix backend run build
npm --prefix frontend run typecheck
npm --prefix frontend run build
git diff --check
```

Adjust exact focused test filenames if the repo already has a better PI tax/cost suite.

## Stop Conditions

- If PI stock valuation currently cannot receive tax-treatment-adjusted cost without touching broad inventory core behavior, stop and propose a narrow design first.
- If Purchase Return cannot reliably reverse non-recoverable tax without source-document snapshots, stop and propose the snapshot requirement.
- Do not change Sales tax behavior.
- Do not update golden expected output for existing recoverable paths unless the current behavior is proven wrong and explicitly approved.

## Owner QA Script

1. Create item `TAX-REC-EX`, stock tracked.
2. Create tax code `VAT10-REC-EX`:
   - Rate `%`: 10
   - Price Basis: Exclusive
   - Purchase Tax Treatment: Recoverable
3. Post PI: qty 1, cost 1200.
   - Expected AP 1320, Inventory 1200, Tax 120, avg cost 1200.
4. Create item `TAX-NREC-EX`.
5. Create tax code `VAT10-NREC-EX`:
   - Rate `%`: 10
   - Price Basis: Exclusive
   - Purchase Tax Treatment: Non-recoverable
6. Post PI: qty 1, cost 1200.
   - Expected AP 1320, Inventory 1320, no separate tax line, avg cost 1320.
7. Repeat for inclusive:
   - Recoverable inclusive, entered 1200 -> Inventory 1090.91, Tax 109.09, AP 1200.
   - Non-recoverable inclusive, entered 1200 -> Inventory 1200, no separate tax line, AP 1200.
