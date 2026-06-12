# 209 — Sales Invoice whole-invoice Charges & Discounts (Allocation Grid)

**Date:** 2026-06-12
**Branch:** `feat/overpayment-credit-balance`
**Type:** Feature (full-stack) — UI + accounting/posting
**Owner decision:** flat, tax-free adjustments (confirmed via question — "Flat, no tax").

## Problem

The Sales Invoice "charges" capability was **backend-complete but UI-stubbed**: the domain
entity, DTO, validator, and posting all handled `charges[]`, but the page only rendered an
empty *"Account Ledger & Financial Taxes Allocation Grid"* placeholder (left by Task 188) —
so no charge could ever be entered. There was also **no whole-invoice discount** concept at
all (only per-line discounts existed).

The owner asked for a single mechanism, surfaced in the existing allocation grid, to apply a
charge **or** a discount to the **entire invoice** (not a line) — e.g. freight billed to the
customer, or an invoice-wide discount.

## What was built

The allocation grid stays. Its header now has **Add Charge** and **Add Discount** buttons that
open **one modal** (GL Account — defaulted from settings, Amount, Description). Saving adds a
row to the grid; rows show a Charge/Discount tag, account, and amount, with edit/delete, and
feed the invoice totals. Posted invoices render the grid read-only.

### Model
`SalesInvoiceCharge` gained `kind: 'CHARGE' | 'DISCOUNT'` (defaults to `CHARGE`, so existing
charges are unaffected). Amounts stay **non-negative magnitudes**; the sign is applied by kind.

### Accounting (flat, no tax — owner decision)
| Kind | Effect on total | Journal entry |
|------|-----------------|---------------|
| CHARGE | **+** amount | Dr Accounts Receivable / **Cr** chosen account (default `defaultRevenueAccountId`) |
| DISCOUNT | **−** amount | **Dr** chosen account (default `defaultSalesExpenseAccountId`) / Cr Accounts Receivable |

- Charges credit their account via the existing `chargeCredits` bucket.
- Discounts debit their account via the existing `discountDebits` bucket (the same one line
  discounts use). `resolveSalesDiscountAccount(settings)` throws a clear error if the discount
  account is unconfigured and no per-row account is set — identical to line-discount behavior.
- The AR debit = `grandTotalBase`, which the entity computes net of charges/discounts, so the
  voucher balances automatically: a header charge cancels (AR↑ vs Cr↑), a header discount
  cancels (AR↓ vs Dr↑). Proven by test `10d` (debit 20 = credit 20).
- **No tax**: discounts are forced tax-free at the entity, use-case, and frontend; charges from
  this modal carry no tax code. Line VAT is never re-prorated.

## Files changed

**Backend**
- `domain/sales/entities/SalesInvoice.ts` — `SalesChargeKind`, `kind` on `SalesInvoiceCharge`,
  signed subtotal math, discounts forced tax-free in `normalizeCharge`.
- `application/sales/services/SalesInvoiceCalculationService.ts` — `calculateSalesInvoiceTotals`
  signs charge contributions by kind.
- `application/sales/use-cases/SalesInvoiceUseCases.ts` — `SalesInvoiceChargeInput.kind`;
  kind-aware default account + skip-tax on create; kind-aware account resolution at posting;
  CHARGE→`chargeCredits` / DISCOUNT→`discountDebits` routing; signed inline totals; `kind`
  preserved on update + in change detection.
- `api/dtos/SalesDTOs.ts` — `kind` on `SalesInvoiceChargeDTO`.
- `api/validators/sales.validators.ts` — validate optional `kind` enum.

**Frontend**
- `modules/sales/pages/SalesInvoiceDetailPage.tsx` — `EditableCharge.kind` + display
  `accountLabel`; signed `computedCharges`/`totals` (header discount also shows in the rail
  Discount line); allocation grid restored with Add Charge / Add Discount buttons + rows +
  edit/delete; charge modal (Account/Amount/Description); `kind` in load + save mappers.

**Test**
- `tests/application/sales/SalesPostingUseCases.test.ts` — new `10d` (header DISCOUNT debits the
  discount account, reduces the total, voucher balances); `makeSI` helper made kind-aware.

## Verification

- Backend `tsc --noEmit`: ✅
- Frontend `tsc --noEmit`: ✅ and `npm run build`: ✅
- `jest SalesPostingUseCases`: **23/23** (existing charge test `10b` still green; new `10d` green)
- `jest sales`: **243 tests pass**. Pre-existing unrelated failure: `RecurringInvoiceUseCases.test.ts`
  fails to load on a `uuid` ESM transform issue (not touched here) — tracked separately.

## Accounting boundary

New posting entries reuse the existing `chargeCredits` / `discountDebits` buckets and the
`SubledgerDocumentPoster`; no new ledger primitives. Engine math remains the source of truth.

## Manual QA

`Sales → Invoices → New`:
1. Add a line item. Click **Add Charge** → account (defaults to revenue), amount `50`,
   description "Freight" → Save. Grand Total increases by 50; row shows in the grid.
2. Click **Add Discount** → account (defaults to Sales Discount), amount `50`,
   description "Year-end" → Save. Grand Total decreases by 50; rail Discount line reflects it.
3. Save the invoice, reopen → both rows persist. Edit a row via the pencil; delete via trash.
4. Post → open the GL Impact / posted voucher: freight is credited to its account, the discount
   debited to the discount account, and the voucher balances. Posted view shows the grid read-only.
5. Edge: with no *Default Sales Discount Account* set and no account picked, posting returns a
   clear error (same as line discounts).

## Follow-ups

- **PI parity**: mirror whole-invoice charges/discounts on Purchase Invoice (charge → debit
  expense/landed-cost, discount → credit; backend currently has no PI charges at all).
- i18n: new UI strings use English `t(key, fallback)`; fill `ar`/`tr` later.
- Account display in the grid shows the id for charges loaded from the server (no code/name
  available without an accounts lookup); freshly added rows show "CODE — Name".
