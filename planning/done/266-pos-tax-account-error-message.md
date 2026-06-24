# Task 266 — POS tax-account configuration error clarity

**Status:** Complete
**Date completed:** 2026-06-24
**Branch:** `main`
**Time spent:** ~0.5h
**Linked plan:** Owner QA blocker after Task 265
**Linked architecture doc:** [`docs/architecture/pos.md`](../../docs/architecture/pos.md) §3
**Linked user guide:** [`docs/user-guide/pos/selling.md`](../../docs/user-guide/pos/selling.md)

---

## Definition of Done — Checklist

- [x] Code built locally on `main` (not committed)
- [x] `docs/architecture/pos.md` updated
- [x] `docs/user-guide/pos/selling.md` updated
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### What Was Fixed

Owner QA hit:

`No tax account configured for item e9a00617-1aaf-4719-bd3f-bf9ba877cbd3 (line 8). Resolution tried: taxCode.salesTaxAccountId. Tax code undefined needs salesTaxAccountId configured.`

The accounting rule was correct: POS output tax must post to `TaxCode.salesTaxAccountId`. The weak part was the POS error contract. A positive manual tax amount with no resolved active Sales/Both tax code produced the confusing `Tax code undefined` hint.

`PostPosSaleUseCase` now distinguishes the two cases:

- Resolved tax code exists but lacks `salesTaxAccountId` → message names that tax code.
- Positive tax amount exists but no active Sales/Both tax code is resolved → message tells the user to assign the item default Sales Tax Code or select an active Sales/Both tax code before posting.

No fallback tax account was added. That would weaken VAT/output-tax controls and could post tax to the wrong GL account.

### Files Changed

- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts`
- `backend/src/tests/application/pos/PostPosSale.test.ts`
- `docs/architecture/pos.md`
- `docs/user-guide/pos/selling.md`
- `planning/done/266-pos-tax-account-error-message.md`
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`

### Accounting / ERP Impact

Accounting behavior is unchanged and remains market-standard: tax accounts are owned by Tax Codes, not by POS registers or payment methods. POS still blocks before stock, receipt, settlement, or ledger writes when tax cannot be mapped.

### Verification

- `cd backend && npm test -- --runInBand src/tests/application/pos/PostPosSale.test.ts` — 20/20 passed
- `cd backend && npm run build` — passed

---

## 2. End-User View

If POS shows a tax-account configuration error, fix the setup:

1. Open **Settings → Tax Codes**.
2. Edit the tax code used for the item.
3. Set **Sales Tax Account**.
4. Open the item card and confirm the item has the correct **Default Sales Tax Code**.
5. Retry the POS sale.

The system blocks the sale until this is configured so sales tax is posted to the correct ledger account.
