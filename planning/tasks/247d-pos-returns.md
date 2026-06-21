# Task 247d — POS Phase 3: Receipt-Based Returns

**Prereq:** 247c merged. Read [247-pos-module-epic.md](./247-pos-module-epic.md) §1, §4.
**Branch:** `feat/247d-pos-returns`
**Estimate:** 2–3 days
**Goal:** From a completed receipt, the cashier returns all or some lines; this reverses revenue/tax, restocks (per inventory policy), reverses COGS, and refunds the customer. Returns post against the **original Sales Invoice** via the existing `AFTER_INVOICE` sales-return flow.

---

## Background (already exists — reuse, do not rebuild)
`backend/src/application/sales/use-cases/SalesReturnUseCases.ts`:
- `CreateSalesReturnUseCase.execute({ companyId, salesInvoiceId, lines:[{ ...qty }], createdBy, ... }, actor)` → when `salesInvoiceId` is set, return context = `AFTER_INVOICE`.
- `PostSalesReturnUseCase.execute(companyId, id, true, periodLockOverride?, actor)` → reverses revenue/tax, restocks inventory IN, reverses COGS (mode-aware via `DocumentPolicyResolver`).
The exact controller wiring is `SalesController.createReturn` + `SalesController.postReturn` (copy their `diContainer` construction verbatim).

## Step 1 — Domain
`backend/src/domain/pos/entities/PosReturn.ts`:
```
id, companyId, shiftId, registerId, returnNumber,
originalReceiptId, originalReceiptNumber, salesInvoiceId,
lines: PosReturnLine[],   // { itemId, qty, unitPrice, lineTotal, originalLineId? }
refundMethod:'CASH'|'CARD'|'BANK_TRANSFER'|'CUSTOM',
refundTotal, salesReturnId, salesReturnNumber,
createdBy, createdAt
```
`PosReturnLine` embedded.

## Step 2 — Repo
`IPosReturnRepository`: `create`, `getById`, `list(companyId,{ shiftId?, originalReceiptId?, limit? })`. Firestore + Prisma + DI (same pattern as receipts).

## Step 3 — `CompletePosReturnUseCase`
Constructor injects `posShiftRepo`, `posSettingsRepo`, `posReceiptRepo`, `posReturnRepo`, `cashMovementRepo`, a built `CreateSalesReturnUseCase` + `PostSalesReturnUseCase`, `transactionManager`, `recordChangeService?`.
```
execute({ companyId, originalReceiptId, lines[], refundMethod, actor }):
  1. receipt = posReceiptRepo.getById; assert status COMPLETED and receipt.salesInvoiceId present.
  2. Determine the CURRENT open shift for the register (returns belong to the current/new shift, NOT the
     original closed shift — epic rule). If requireOpenShift and none → throw.
  3. Validate returned qty per line ≤ receipt line qty (partial allowed). Reject empty.
  4. salesReturn = createSalesReturnUseCase.execute(
        { companyId, salesInvoiceId: receipt.salesInvoiceId, createdBy: actor.userId,
          lines: lines.map(l => ({ salesInvoiceLineId/ itemId, returnedQty: l.qty, ... })) }, actor)
     post: postSalesReturnUseCase.execute(companyId, salesReturn.id, true, undefined, actor)
       // reverses GL + restock per policy. Let errors propagate.
  5. refundTotal = salesReturn total. Persist PosReturn (link salesReturnId) + a PosCashMovement
     (type REFUND_CASH, amount = refund) when refundMethod==CASH, in transactionManager.runTransaction.
  6. recordChangeService.recordCreate(entityType 'POS_RETURN'). return { posReturn, salesReturnId, refundTotal }.
```
Notes:
- Map the receipt lines to the SI lines so the sales return references the right invoice lines (the receipt snapshot stores `itemId`/qty; if you also snapshot the SI lineId at sale time in P2, prefer that — **add `salesInvoiceLineId` to `PosReceiptLineSnapshot` in P2 if not already present**; if it's missing, match by `itemId`+price, and the sales-return use case will validate against the SI).
- Restock is governed by existing inventory/sales policy — POS does not decide it. Cash refund reduces drawer via `REFUND_CASH`, reflected in the shift X/Z expected cash.

## Step 4 — Controller + routes
Add `completeReturn`, `listReturns`, `getReturn`:
```
router.post('/returns',     idempotencyMiddleware, permissionGuard('pos.return.create'), PosController.completeReturn);
router.get('/returns',      permissionGuard('pos.terminal.access'), PosController.listReturns);
router.get('/returns/:id',  permissionGuard('pos.terminal.access'), PosController.getReturn);
```
Validator `validateCompletePosReturnInput`. DTOs `toReturnDTO`.

## Step 5 — Frontend
`frontend/src/modules/pos/pages/PosReturnPage.tsx`: look up a receipt (by number or from the receipts list "Return" action) → show its lines with editable return-qty (≤ sold) → choose refund method → `ConfirmDialog` → `completeReturn`. Toast result; show refund summary. Add a "Return" action on `PosReceiptsListPage`. Sidebar `{ label:'Returns', path:'/pos/returns', permission:'pos.return.create', icon:'Undo2' }`. Register route. i18n en/ar/tr.

## Acceptance criteria
- [ ] Full return of a cash receipt → sales return posted against the original SI; revenue/tax reversed; item restocked (in live modes); REFUND_CASH movement reduces drawer.
- [ ] Partial return (1 of 3 qty) → only that qty reversed/restocked.
- [ ] Return after the original shift closed → attaches to the current open shift.
- [ ] Return qty > sold qty → rejected.

## Tests
`backend/src/tests/application/pos/CompletePosReturn.test.ts` (mock injected sales-return use cases): asserts `AFTER_INVOICE` (salesInvoiceId passed), partial qty respected, current-shift attachment, REFUND_CASH movement on cash refund.
