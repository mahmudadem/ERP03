# Task 114 — Phase D.5 Sales-return enhancements

**Date:** 2026-05-22  
**Status:** Completed  
**Plan reference:** `planning/tasks/sales-and-purchases-completion-roadmap.md` (Phase D.5)

## Scope Delivered

Phase D.5 goals:

1. Refund vs credit-note choice on sales returns
2. Restocking fee support
3. Structured return reasons

## Technical Developer View

### What changed

1. Extended `SalesReturn` domain model:
   - Added `settlementMode` (`CREDIT_NOTE | REFUND`)
   - Added `reasonCode` (`DEFECTIVE | WRONG_ITEM | CHANGED_MIND | OTHER`)
   - Added restocking fee fields and computed net settlement fields
   - Centralized recalculation in `recalculateMonetaryTotals()`
2. Updated return posting logic (`PostSalesReturnUseCase`):
   - Revenue reversal uses net settlement (after restocking fee)
   - Adds restocking-fee credit line when fee exists
   - Adds refund voucher (`SR-REF-*`) path for `REFUND` mode
   - Keeps `BEFORE_INVOICE` behavior unchanged (inventory/COGS-side only)
3. Updated create/update contracts:
   - Added new D.5 fields in create/update inputs and validators
   - Fixed direct return validation path (`DIRECT` + `customerId`)
4. Updated API DTO mapping and frontend API types for new return fields
5. Updated sales return UI:
   - Create screen now captures settlement mode, reason code, restocking fee
   - Detail screen shows reason code, settlement mode, fee amount, net settlement
6. Added D.5 tests in `SalesReturnUseCases.test.ts` for:
   - Credit note + restocking fee netting
   - Refund voucher path and SI outstanding behavior

### Files touched

- `backend/src/domain/sales/entities/SalesReturn.ts`
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
- `backend/src/api/validators/sales.validators.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/tests/application/sales/SalesReturnUseCases.test.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/sales-returns.md`
- `docs/user-guide/sales/README.md`

## End-User View

Sales returns now support:

1. **Settlement choice**
   - Credit Note: apply return value to customer balance
   - Refund: post refund settlement path
2. **Reason tracking**
   - Choose a reason code and provide free-text reason
3. **Restocking fees**
   - Apply amount or percent fee
   - System calculates net settlement automatically
4. **Better visibility**
   - Return detail now shows settlement mode, reason code, restocking fee, and net settlement

## Verification

1. `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/SalesReturnUseCases.test.ts` ✅
2. `npm --prefix backend run build` ✅
3. `npm --prefix frontend run typecheck` ✅

## Acceptance Criteria Check

1. Refund vs credit note choice: ✅ implemented
2. Restocking fees: ✅ implemented with validation and posting effect
3. Return reasons taxonomy: ✅ implemented (`reasonCode` + `reason`)

## Known Follow-ups

1. D.6 document attachments (next in roadmap)
2. D.7 multiple invoice templates
3. D.8 email integration

---

## Manual QA Script — Operator View (run sequentially)

**Pre-req:** Backend + frontend dev servers running. Logged in as admin with at least one posted Sales Invoice you can return against.

### Test 1 — Create a credit-note return with reason code
1. Open **Sales → Sales Returns**.
2. Click **New Return**.
3. Pick **Against Invoice**, choose a posted invoice.
4. Select **Settlement Mode = Credit Note**.
5. Select **Reason = Defective** and add a short text reason.
6. Add at least one line to be returned.
7. Save, then click **Post**.
- **Expected:** return is posted; detail page shows Reason "Defective", Settlement Mode "Credit Note", Net Settlement equal to return total (no fee).

### Test 2 — Apply a restocking fee
1. Repeat Test 1 but before posting, in the Restocking Fee field enter **10%** (or a flat amount).
2. Post the return.
- **Expected:** detail page shows the restocking fee amount and a **Net Settlement** that is the return total minus the fee.

### Test 3 — Refund settlement path
1. Create a new return against a posted invoice.
2. Set **Settlement Mode = Refund**.
3. Select **Reason = Wrong Item**.
4. Add a line, save, post.
- **Expected:** posting succeeds; detail page shows Settlement Mode "Refund"; the original invoice's outstanding balance behaves correctly (refund path, not credit applied to invoice).

### Test 4 — Direct return (no source invoice)
1. Create a new return, choose **Direct** (no invoice link).
2. Pick a customer, choose **Reason = Changed Mind**, add a line, save, post.
- **Expected:** return saves and posts without requiring an invoice link.

### Results

| # | Test | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Credit-note return with reason | | |
| 2 | Restocking fee netting | | |
| 3 | Refund settlement | | |
| 4 | Direct return | | |

