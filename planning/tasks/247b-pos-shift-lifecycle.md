# Task 247b — POS Phase 1: Shift Lifecycle, Cash Drawer & X Report

**Prereq:** 247a merged. Read [247-pos-module-epic.md](./247-pos-module-epic.md) §1, §4, §7.
**Branch:** `feat/247b-pos-shift-lifecycle`
**Estimate:** 2–3 days
**Goal:** Cashier can open a shift with an opening float, record cash movements, see a live X report, and close the shift with counted-cash reconciliation that posts a balanced cash over/short voucher.

---

## Step 1 — Domain: cash movements + shift fields

Add `backend/src/domain/pos/entities/PosCashMovement.ts`:
```
id, companyId, shiftId, registerId,
type: 'OPENING_FLOAT'|'PAYIN'|'PAYOUT'|'DROP'|'SALE_CASH'|'REFUND_CASH',
amount (>0), reason?, createdBy, createdAt
```
(`SALE_CASH`/`REFUND_CASH` rows are written by P2/P3; this phase writes `OPENING_FLOAT`/`PAYIN`/`PAYOUT`/`DROP`.)

`PosShift` already has `expectedCash/countedCash/overShortAmount/overShortVoucherId` from 247a.

## Step 2 — Repos
- Add `IPosCashMovementRepository` (`create`, `listByShift(companyId, shiftId)`, `sumByShift(companyId, shiftId)` → totals by type). Firestore collection `companies/{companyId}/posCashMovements/{id}` (index `shiftId`). Prisma model + getter. Register in DI.
- Extend `IPosShiftRepository` if needed (already has `getOpenShiftForRegister`).

## Step 3 — Use cases (`backend/src/application/pos/use-cases/PosShiftUseCases.ts`)

### `OpenPosShiftUseCase`
Inject `posShiftRepo`, `posRegisterRepo`, `posSettingsRepo`, `cashMovementRepo`, `transactionManager`, `recordChangeService?`.
```
execute({ companyId, registerId, cashierUserId, openingFloat, actor }):
  - register = getById; assert ACTIVE
  - assert no open shift for register (getOpenShiftForRegister == null) else throw 'Register already has an open shift'
  - assert no open shift for cashier on another register (optional per settings)
  - create PosShift(status OPEN, openingFloat, openedAt now)
  - create PosCashMovement(type OPENING_FLOAT, amount openingFloat)
  - wrap both writes in transactionManager.runTransaction
  - recordChangeService.recordCreate (entityType 'POS_SHIFT')
```

### `CreatePosCashMovementUseCase`
Validates an OPEN shift; rejects negative/zero amount; PAYOUT/DROP cannot exceed expected cash on hand (optional guard); writes movement; toast-able result.

### `GetPosXReportUseCase` (live, read-only)
For the open shift: returns opening float, cash sales total, cash refunds total, pay-ins, pay-outs/drops, **expected cash** = openingFloat + SALE_CASH − REFUND_CASH + PAYIN − PAYOUT − DROP, plus per-payment-method sales totals (from linked SIs — but in P1, sales totals are 0; wire the shape now, fill in P2). Pull cash figures from `cashMovementRepo.sumByShift`.

### `ClosePosShiftUseCase` (and `ForceClosePosShiftUseCase`)
Inject also `posSettingsRepo`, `accountRepository`, and the accounting poster (build like `SalesController.buildAccountingPostingService(false)` — i.e. `SubledgerVoucherPostingService`), `voucherRepository`, `voucherSequenceRepository`, `ledgerRepository`, `companyCurrencyRepository`, `transactionManager`.
```
execute({ companyId, shiftId, countedCash, actor }):
  - shift = getById; assert status OPEN (ForceClose: any OPEN, requires pos.shift.forceClose; sets FORCE_CLOSED)
  - expectedCash = (recompute from cash movements, same as X report)
  - overShort = round(countedCash - expectedCash)   // + = over, − = short
  - if overShort != 0:
       settings = posSettingsRepo.getSettings
       account = overShort > 0 ? settings.cashOverAccountId : settings.cashShortAccountId
       if !account → throw 'Configure cash over/short account before closing' (readable)
       build a balanced JOURNAL_ENTRY voucher:
         over  (counted > expected): Dr cashDrawerAccount(amt) / Cr cashOverAccount(amt)
         short (counted < expected): Dr cashShortAccount(amt) / Cr cashDrawerAccount(amt)
       post via SubledgerVoucherPostingService inside transactionManager.runTransaction
       shift.overShortVoucherId = voucher.id
  - shift.status = CLOSED|FORCE_CLOSED; closedAt now; expectedCash; countedCash; overShortAmount
  - persist shift in the SAME transaction as the voucher post
  - recordChangeService.recordUpdate
```
**COPY the voucher-building + posting code from** the `PostInventoryRevaluationUseCase` class inside `backend/src/application/inventory/use-cases/InventoryRevaluationUseCases.ts` (Task 223) — it builds a balanced `VoucherEntity`/`VoucherLineEntity` and posts through `SubledgerVoucherPostingService` honoring period-lock/approval via `PostingGateway`. Use `cashDrawerAccountId` from the register.

> Closed/force-closed shifts are immutable: `Open`/`CashMovement` use cases must reject if the shift is not OPEN.

## Step 4 — Controller + routes

Add to `PosController`: `openShift`, `closeShift`, `forceCloseShift`, `createCashMovement`, `getXReport`, `listShifts`, `getShift`. Routes (append to `pos.routes.ts`):
```
router.post('/shifts/open',                permissionGuard('pos.shift.open'),       PosController.openShift);
router.post('/shifts/:id/close',           permissionGuard('pos.shift.close'),      PosController.closeShift);
router.post('/shifts/:id/force-close',     permissionGuard('pos.shift.forceClose'), PosController.forceCloseShift);
router.post('/shifts/:id/cash-movements',  permissionGuard('pos.cash.movement'),    PosController.createCashMovement);
router.get('/shifts/:id/x-report',         permissionGuard('pos.terminal.access'),  PosController.getXReport);
router.get('/shifts',                      permissionGuard('pos.terminal.access'),  PosController.listShifts);
router.get('/shifts/:id',                  permissionGuard('pos.terminal.access'),  PosController.getShift);
```
DTOs: `toShiftDTO`, `toCashMovementDTO`, `toXReportDTO`.

## Step 5 — Frontend
- `posApi.ts`: add the 7 endpoints.
- `frontend/src/modules/pos/pages/PosShiftPage.tsx`: open-shift form (register picker, opening float), open-shift dashboard (X report card: expected/counted/over-short, cash movement list + add pay-in/pay-out via ConfirmDialog), close-shift flow (enter counted cash → ConfirmDialog showing computed over/short → close). Toast every result.
- Sidebar: add `{ label:'Shift', path:'/pos/shift', permission:'pos.shift.open', icon:'Clock' }` to the `pos` group; register route.
- i18n en/ar/tr.

## Acceptance criteria
- [ ] Cannot open a 2nd shift on a register with one open (readable error).
- [ ] Opening float creates an OPENING_FLOAT cash movement; X report expected cash reflects pay-in/pay-out.
- [ ] Close with counted == expected → no voucher; shift CLOSED.
- [ ] Close with over → balanced Dr cash / Cr over voucher posted; `overShortVoucherId` set; verify GL via emulator round-trip.
- [ ] Close with short and no short-account configured → blocked with readable error.
- [ ] Force-close requires `pos.shift.forceClose`; closed shift rejects further cash movements.

## Tests
`backend/src/tests/application/pos/PosShiftUseCases.test.ts`: double-open guard; expected-cash math; over voucher direction; short voucher direction; missing over/short account blocks; closed shift immutability.
