# Task 247c — POS Phase 2: Complete Sale (Direct SI + Settlement) & Cashier Screen

**Prereq:** 247a + 247b merged. Read [247-pos-module-epic.md](./247-pos-module-epic.md) **§4 in full** — it is the contract for this phase.
**Branch:** `feat/247c-pos-core-sale`
**Estimate:** 4–5 days
**Goal:** A cashier on an open shift searches products, builds a cart, takes cash/card/split payment, and completes a sale that posts a real `direct` Sales Invoice (revenue+tax+COGS+inventory OUT+AR settled). A `PosReceipt` is stored and printable/reprintable.

---

## Step 1 — Domain: receipt + payment

`backend/src/domain/pos/entities/PosReceipt.ts`:
```
id, companyId, shiftId, registerId, receiptNumber,
status: 'COMPLETED'|'VOIDED',
customerId, customerName,
lines: PosReceiptLineSnapshot[],
subtotal, discountTotal, taxTotal, grandTotal,
salesInvoiceId, salesInvoiceNumber,   // link to financial truth
createdBy, createdAt
```
`PosReceiptLineSnapshot` (embedded): `{ itemId, itemCode, itemName, qty, uom, unitPrice, lineDiscount, taxCodeId, lineTotal }`.

`backend/src/domain/pos/entities/PosPayment.ts`:
```
id, companyId, receiptId, method:'CASH'|'CARD'|'BANK_TRANSFER'|'CUSTOM',
amount, changeGiven (default 0), reference?, createdAt
```

## Step 2 — Repos
- `IPosReceiptRepository`: `create`, `getById(companyId,id)`, `getByNumber(companyId,number)`, `list(companyId, { shiftId?, registerId?, customerId?, dateFrom?, dateTo?, limit? })`.
- `IPosPaymentRepository`: `create`, `listByReceipt(companyId, receiptId)`.
Firestore collections `posReceipts`/`posPayments` (indexes: shiftId, salesInvoiceId, createdAt). Prisma models + getters. DI registration.

## Step 3 — Product search use case

`backend/src/application/pos/use-cases/SearchPosProductsUseCase.ts`. Inject `itemRepository`. Match query against `code` (SKU), `barcode`, `name` (case-insensitive, prefix/contains), `companyId`-scoped, only `status` active, return `{ itemId, code, barcode, name, type, trackInventory, baseUom, salesUomId, defaultSalesTaxCodeId, sellingPrice? }`. Reuse the item read path; for price, you MAY call the existing effective-price resolver used by Sales (Task 242/243) but V1 can return the item default price and let the SI calculation own final pricing. Keep it fast (limit ~25).

## Step 4 — Bootstrap use case

`GetPosBootstrapUseCase`: for `{ companyId, registerId, cashierUserId }` return in one call: register, posSettings (payment methods + walk-in customer), the cashier's open shift for the register (or null), and enabled tax codes. Powers the cashier screen with a single round-trip.

## Step 5 — `CompletePosSaleUseCase` ⭐ (the integration)

`backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`. **Do NOT build vouchers/stock movements here.** It orchestrates POS state + delegates posting to Sales.

Constructor injects: `posShiftRepo`, `posSettingsRepo`, `posReceiptRepo`, `posPaymentRepo`, `cashMovementRepo`, `salesSettingsRepo`, a built `CreateAndPostSalesInvoiceUseCase`, `transactionManager`, `recordChangeService?`.

> The controller builds `CreateAndPostSalesInvoiceUseCase` exactly as `SalesController.createAndPostSI` does (a `CreateSalesInvoiceUseCase` + `SalesController.buildPostSalesInvoiceUseCase(recordChangeService)`), then passes it in. **Reuse that wiring verbatim.**

```
execute({ companyId, registerId, shiftId, customerId?, lines[], payments[], actor }):
  1. shift = posShiftRepo.getById(companyId, shiftId)
     if posSettings.requireOpenShift and (!shift || !shift.isOpen() || shift.registerId !== registerId)
        → throw 'No open shift for this register'
     if shift.cashierUserId !== actor.userId and not manager → throw 'Cashier can only operate own shift'
  2. settings = posSettingsRepo.getSettings; register = ...
     customerId = customerId || settings.walkInCustomerId  (throw if neither)
  3. Build CreateSalesInvoiceInput:
        { companyId, customerId, invoiceDate: todayISO, source:'pos', formType:'pos_sale',
          persona:'direct', createdBy: actor.userId,
          lines: lines.map(l => ({ itemId:l.itemId, invoicedQty:l.qty, unitPriceDoc:l.unitPrice,
                    discountType:l.discountType, discountValue:l.discountValue,
                    taxCodeId:l.taxCodeId, warehouseId: register.warehouseId })) }
  4. Map payments → SettlementInput:
        map POS method → SI paymentMethod: CASH→'CASH', CARD→'CREDIT_CARD',
            BANK_TRANSFER→'BANK_TRANSFER', CUSTOM→'OTHER'
        settledForInvoice = payments minus cash change. For each payment, amountBase applied to the
          invoice = (method==CASH ? amount - changeGiven : amount). settlement amounts are in BASE currency
          (POS is base-currency only in V1; exchangeRate = 1).
        if exactly one tender and applied total == grand total:
            { settlementMode:'CASH_FULL', settlements:[{ paymentMethod, amountBase, reference }] }
        else:
            { settlementMode:'MULTI', settlements:[ ...one row per payment with applied amountBase... ] }
        (settlementAccountId omitted → Sales resolves from SalesSettings.paymentMethodConfigs)
  5. salesInvoice = createAndPostSalesInvoiceUseCase.execute(input, settlementInput, undefined,
                       { userId: actor.userId, userEmail: actor.userEmail })
     // This posts revenue/tax/COGS/inventory-OUT/AR and the receipt voucher(s). Let PersonaNotAllowedError
     //  / UnsettledCostError / CreditLimitExceededError propagate unchanged.
  6. receiptNumber = settings.receiptPrefix + zeroPad(settings.receiptNextSeq); bump+save settings.
  7. Build PosReceipt(status COMPLETED, line snapshots, totals from salesInvoice, salesInvoiceId, salesInvoiceNumber)
     + PosPayment[] (with changeGiven). Write receipt+payments and (for cash) a PosCashMovement(type SALE_CASH,
       amount = cash applied) and (if change) keep change at drawer (no separate movement needed; SALE_CASH is net cash in).
     Wrap POS-side writes in transactionManager.runTransaction.
  8. recordChangeService.recordCreate(entityType 'POS_RECEIPT').
  9. return { receipt, salesInvoiceId, salesInvoiceNumber, change: totalCashTendered - (grandTotal - nonCashApplied) }
```

**Validation before posting:**
- payments applied total must equal receipt grand total (the SI grand total). Reject mismatch with a clear error.
- CARD/BANK/CUSTOM cannot produce change (`changeGiven` must be 0). Only CASH may.
- if a payment method `requiresReference` (from settings) and `reference` missing → reject.

> Ordering note: because the SI post and the POS receipt write are two separate transactions, post the SI **first**; only on success write the receipt. If the receipt write fails after a successful SI post, surface a clear error and leave the SI posted (it is the financial truth) — log for reconciliation. Do not attempt to void the SI automatically in V1.

## Step 6 — Reprint

`ReprintPosReceiptUseCase`: read-only `getById`; returns the receipt snapshot for the print template. No posting.

## Step 7 — Controller + routes
Add `completeSale`, `searchProducts`, `getBootstrap`, `reprintReceipt`, `listReceipts`, `getReceipt`:
```
router.get('/bootstrap',            permissionGuard('pos.terminal.access'), PosController.getBootstrap);
router.get('/products/search',      permissionGuard('pos.terminal.access'), PosController.searchProducts);
router.post('/sales',               idempotencyMiddleware, permissionGuard('pos.terminal.access'), PosController.completeSale);
router.get('/receipts',             permissionGuard('pos.terminal.access'), PosController.listReceipts);
router.get('/receipts/:id',         permissionGuard('pos.terminal.access'), PosController.getReceipt);
router.get('/receipts/:id/reprint', permissionGuard('pos.receipt.reprint'), PosController.reprintReceipt);
```
Use `idempotencyMiddleware` on `/sales` (copy from sales `create-and-post`) so a double-tap can't post twice. Validators: `validateCompletePosSaleInput` (lines non-empty, payments non-empty, amounts ≥ 0).

## Step 8 — Frontend cashier screen

`frontend/src/modules/pos/pages/PosTerminalPage.tsx` — the one specialized screen. Still inside the ERP shell, permission-gated, i18n + RTL. Layout: left = product search (barcode/SKU/name input with debounce → `searchProducts`) + result list; center = cart (qty editable, line discount, remove); right = totals + customer (`PartySelector`, defaults to walk-in) + "Pay" button.
- On Pay → tender modal: choose method(s), enter amounts (support split: add rows), show change for cash. `ConfirmDialog` to complete. Call `completeSale`. On success: toast, show receipt, offer print/new sale.
- Guard: if no open shift, show "Open a shift first" with a link to `/pos/shift`.
- `posApi`: `getBootstrap/searchProducts/completeSale/listReceipts/getReceipt/reprintReceipt`.
- `PosReceiptsListPage.tsx` — `OperationalListLayout`, columns receiptNo/date/customer/total/SI-number, reprint action, drill to linked SI.
- Print: a print-friendly receipt component (reuse existing print/export util `frontend/src/utils/exportUtils.ts` patterns; receipt is small-format).
- Register routes `/pos` (terminal), `/pos/receipts`. i18n en/ar/tr.

## Acceptance criteria (verify via emulator round-trip)
- [ ] Cash exact sale (1 item) → posts SI (`source:'pos'`, persona `direct`), AR settled to 0, inventory OUT created, COGS + revenue + output tax vouchers present; receipt stored with `salesInvoiceId`.
- [ ] Cash with change → change computed; SALE_CASH movement = net cash; SI settled to grand total.
- [ ] Card sale → settlement maps to `CREDIT_CARD` account (card clearing); no change allowed.
- [ ] Split (cash + card) → `MULTI` settlement, two receipt vouchers, AR settled to 0.
- [ ] Service item (trackInventory=false) → no inventory OUT; revenue+tax only.
- [ ] No open shift → completion blocked.
- [ ] Company with `allowPosDirectSales` OFF → `PersonaNotAllowedError` surfaced (not converted).
- [ ] Payment total ≠ grand total → rejected.

## Tests
`backend/src/tests/application/pos/CompletePosSale.test.ts` (mock the injected `CreateAndPostSalesInvoiceUseCase` to assert it's called with `persona:'direct'`, `source:'pos'`, correct `settlementMode`/amounts): single-tender→CASH_FULL; split→MULTI; change excluded from settlement; no-shift guard; payment-mismatch guard; requiresReference guard.
