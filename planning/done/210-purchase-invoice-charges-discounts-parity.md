# 210 — Purchase Invoice whole-invoice Charges & Discounts (PI↔SI parity)

**Date:** 2026-06-12
**Branch:** `feat/overpayment-credit-balance`
**Type:** Feature (full-stack) — UI + accounting/posting
**Follows:** [209 — Sales Invoice charges/discounts](./209-sales-invoice-charges-discounts-allocation-grid.md)

## Problem

The owner's standing goal this session: **"PI needs to match SI."** Sales Invoice had a working
allocation grid with Add Charge / Add Discount (report 209), but **Purchase Invoice had no charges
concept at all** — not in the domain, DTO, validator, use-cases, or UI (its allocation grid was the
same empty placeholder).

## What was built

Full mirror of the SI feature on Purchase Invoice, with the **GL sides flipped** for the purchases
direction. The allocation grid now has **Add Charge** / **Add Discount** buttons opening one modal
(GL account defaulted from settings, amount, description); rows show in the grid and feed the bill totals.

### Accounting (flat, tax-free — mirrors the SI owner decision, signs flipped)
| Kind | Effect on total | Journal entry |
|------|-----------------|---------------|
| CHARGE | **+** amount | **Dr** its account (default `defaultPurchaseExpenseAccountId`) / Cr AP — e.g. freight/landed cost we owe |
| DISCOUNT | **−** amount | Dr AP / **Cr** its account (default `defaultPurchaseExpenseAccountId`) — purchase discount received |

- The AP credit = `grandTotalBase`, which nets charges/discounts, so the voucher balances
  automatically (a charge: AP↑ vs Dr↑; a discount: AP↓ vs Cr↑). Proven by test `6b`
  (debits 60+10 = credits 5+65 = 70).
- Entity totals sign identically to sales (CHARGE adds, DISCOUNT subtracts); only the **posting side**
  differs from sales (purchase charge debits, discount credits).
- Flat & tax-free: discounts carry no tax; charges from this modal carry none. Line tax untouched.
- Both kinds default to the Purchase Expense account; the discount credits it (net method) and can be
  overridden per row to a dedicated "purchase discounts received" account.

## Files changed

**Backend**
- `domain/purchases/entities/PurchaseInvoice.ts` — new `PurchaseChargeKind`, `PurchaseInvoiceCharge`,
  `charges[]` field, `normalizeCharge`, signed subtotal math, charges in toJSON/fromJSON.
- `application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — `PurchaseInvoiceChargeInput`;
  `charges?` on Create/Update inputs; charge construction (default account by kind); charge-account
  resolution + CHARGE→Debit / DISCOUNT→Credit posting entries; signed `recalcInvoiceTotals`; charges
  rebuilt on update.
- `api/dtos/PurchaseDTOs.ts` — `PurchaseInvoiceChargeDTO`, `charges?` on the invoice DTO, mapper emits charges.
- `api/validators/purchases.validators.ts` — `validatePICharge` wired into create + update validators.
- Controller already spreads the body, so `charges` flows through with no controller change.

**Frontend**
- `api/purchasesApi.ts` — `PurchaseInvoiceChargeDTO` / `PurchaseInvoiceChargeInputDTO`, `charges?` on
  the invoice DTO and both payloads.
- `modules/purchases/pages/PurchaseInvoiceDetailPage.tsx` — `EditableCharge` + `form.charges`; signed
  totals; modal state + handlers; `renderAllocationGrid(readOnly)` (editable + posted views) and
  `renderChargeModal()`; both stubbed allocation panels replaced; `charges` in save payloads + edit-load.

**Test**
- `tests/application/purchases/PurchasePostingUseCases.test.ts` — new `6b` (charge debit + discount
  credit, balanced); `makePI` helper made charge-aware.

## Verification

- Backend `tsc --noEmit`: ✅  · Frontend `tsc --noEmit`: ✅ · Frontend `npm run build`: ✅
- `jest PurchasePostingUseCases`: **15/15** (new `6b` green; all existing PI posting tests green).
- **Live browser** (preview on :5199, logged in): `/purchases/invoices/new` renders the allocation grid
  with ADD CHARGE / ADD DISCOUNT; the modal opens with GL Account / Amount / Description / Save and the
  "Charge debits this account" hint.

## Accounting boundary

Reuses `SubledgerDocumentPoster` and the existing per-line entry/AP-credit structure; the only new
entries are the charge/discount lines. Engine math remains the source of truth; balance is enforced by
the poster and asserted by `6b`.

## Manual QA

`Purchases → Invoices → New Bill`: add a line; **Add Charge** (Freight 50) → total +50; **Add Discount**
(50) → total −50 (red −50 row); Save → reopen (persists); Post → the journal debits freight, credits the
discount account, and balances; posted view shows the grid read-only.

## Follow-ups / notes

- Default discount account = Purchase Expense account (net method). Add a dedicated "Purchase Discounts
  Received" settings field later if the owner wants discounts as separate income.
- i18n: new strings use English fallbacks; fill `ar`/`tr` later.
- Account label shows the id for charges loaded from the server; freshly added rows show "CODE — Name".
