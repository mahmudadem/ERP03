# Purchase Module — Algorithms & Posting Logic

> **Status:** DRAFT — Pending Review  
> **Prerequisites:** Read [MASTER_PLAN.md](./MASTER_PLAN.md), [SCHEMAS.md](./SCHEMAS.md)  
> **Convention:** Pseudocode uses TypeScript-like syntax. `txn` = Firestore transaction context.

---

## 1. PO Status Machine

```
DRAFT ──► CONFIRMED ──► PARTIALLY_RECEIVED ──► FULLY_RECEIVED ──► CLOSED
  │           │                                                      ▲
  │           │                                                      │
  ▼           ▼                                                      │
CANCELLED  CANCELLED                                           (manual close)
```

### Algorithm: UpdatePOStatus

Called after every GRN/PI/PR posting that is linked to a PO.

```
function updatePOStatus(po: PurchaseOrder): POStatus {
  if po.status === 'CANCELLED' or po.status === 'CLOSED':
    return po.status   // terminal — never change

  allLinesFullyReceived = po.lines.every(line =>
    !line.trackInventory || line.receivedQty >= line.orderedQty
  )
  anyLinePartiallyReceived = po.lines.some(line =>
    line.receivedQty > 0 && line.receivedQty < line.orderedQty
  )

  if allLinesFullyReceived:
    return 'FULLY_RECEIVED'
  if anyLinePartiallyReceived:
    return 'PARTIALLY_RECEIVED'
  return po.status   // no change (still CONFIRMED)
}
```

### Algorithm: ConfirmPO

```
function confirmPO(po: PurchaseOrder):
  ASSERT po.status === 'DRAFT'
  ASSERT po.lines.length > 0
  ASSERT po.vendorId is valid Party with 'VENDOR' role

  po.status = 'CONFIRMED'
  po.confirmedAt = now()
  SAVE po
```

### Algorithm: CancelPO

```
function cancelPO(po: PurchaseOrder):
  ASSERT po.status in ['DRAFT', 'CONFIRMED']
  // Cannot cancel if any GRN/PI has been posted against it
  ASSERT po.lines.every(line => line.receivedQty === 0 && line.invoicedQty === 0)

  po.status = 'CANCELLED'
  SAVE po
```

### Algorithm: ClosePO

```
function closePO(po: PurchaseOrder):
  // Manual close — cancels remaining open quantities
  ASSERT po.status in ['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']

  po.status = 'CLOSED'
  po.closedAt = now()
  SAVE po
  // openReceiveQty and openInvoiceQty become 0 implicitly (PO closed)
```

---

## 2. GRN Posting

### Algorithm: PostGoodsReceipt

```
function postGoodsReceipt(grn: GoodsReceipt, settings: PurchaseSettings):
  ASSERT grn.status === 'DRAFT'

  // ── Validate PO link (CONTROLLED) ──
  if settings.procurementControlMode === 'CONTROLLED':
    ASSERT grn.purchaseOrderId is not null
    po = LOAD PurchaseOrder(grn.purchaseOrderId)
    ASSERT po.status in ['CONFIRMED', 'PARTIALLY_RECEIVED']

  BEGIN TRANSACTION (txn):

    for each line in grn.lines:
      item = LOAD Item(line.itemId)
      ASSERT item.trackInventory === true   // GRN is only for stock items

      // ── Validate PO quantity (if PO-linked) ──
      if grn.purchaseOrderId:
        poLine = findPOLine(po, line.poLineId)
        openQty = poLine.orderedQty - poLine.receivedQty
        if !settings.allowOverDelivery:
          ASSERT line.receivedQty <= openQty
        else:
          maxQty = openQty * (1 + settings.overDeliveryTolerancePct / 100)
          ASSERT line.receivedQty <= maxQty

      // ── Create Inventory Movement ──
      movement = inventoryService.processIN({
        companyId:              grn.companyId,
        itemId:                 line.itemId,
        warehouseId:            grn.warehouseId,
        qty:                    convertToBaseUom(line.receivedQty, line.uom, item),
        date:                   grn.receiptDate,
        movementType:           'PURCHASE_RECEIPT',
        refs: {
          type:                 'GOODS_RECEIPT',
          docId:                grn.id,
          lineId:               line.lineId,
        },
        currentUser:            grn.createdBy,
        unitCostInMoveCurrency: line.unitCostDoc,
        moveCurrency:           line.moveCurrency,
        fxRateMovToBase:        line.fxRateMovToBase,
        fxRateCCYToBase:        line.fxRateCCYToBase,
      })

      line.stockMovementId = movement.id

      // ── Update PO line receivedQty ──
      if poLine:
        poLine.receivedQty += line.receivedQty

    // ── Update GRN status ──
    grn.status = 'POSTED'
    grn.postedAt = now()
    SAVE grn (txn)

    // ── Update PO status ──
    if po:
      po.status = updatePOStatus(po)
      SAVE po (txn)

  COMMIT TRANSACTION

  // ── NO GL ENTRIES (V1 — GRN is operational only) ──
```

---

## 3. Purchase Invoice Posting

### Algorithm: PostPurchaseInvoice

```
function postPurchaseInvoice(pi: PurchaseInvoice, settings: PurchaseSettings):
  ASSERT pi.status === 'DRAFT'

  // ── Determine if PO-linked ──
  isPOLinked = pi.purchaseOrderId !== null
  po = null
  if isPOLinked:
    po = LOAD PurchaseOrder(pi.purchaseOrderId)

  BEGIN TRANSACTION (txn):

    voucherLines = []

    for each line in pi.lines:
      item = LOAD Item(line.itemId)

      // ════════════════════════════════════════
      // STEP 1: Quantity Validation
      // ════════════════════════════════════════

      if isPOLinked:
        poLine = findPOLine(po, line.poLineId)
        mode = settings.procurementControlMode

        if mode === 'CONTROLLED' && line.trackInventory:
          // Stock items in CONTROLLED: invoice ≤ received
          openInvoiceQty = poLine.receivedQty - poLine.invoicedQty
          ASSERT line.invoicedQty <= openInvoiceQty
            ERROR: "Invoiced qty ({line.invoicedQty}) exceeds received qty for item {line.itemName}"

        else if mode === 'CONTROLLED' && !line.trackInventory:
          // Services in CONTROLLED: invoice ≤ ordered
          openInvoiceQty = poLine.orderedQty - poLine.invoicedQty
          ASSERT line.invoicedQty <= openInvoiceQty
            ERROR: "Invoiced qty exceeds ordered qty for service {line.itemName}"

        else:
          // SIMPLE PO-linked: invoice ≤ ordered (with tolerance)
          maxQty = poLine.orderedQty * (1 + settings.overInvoiceTolerancePct / 100)
          remaining = maxQty - poLine.invoicedQty
          ASSERT line.invoicedQty <= remaining
            ERROR: "Invoiced qty exceeds ordered qty for item {line.itemName}"

      // (Standalone PI in SIMPLE: no PO qty check)

      // ════════════════════════════════════════
      // STEP 2: Tax Snapshot
      // ════════════════════════════════════════

      if line.taxCodeId:
        taxCode = LOAD TaxCode(line.taxCodeId)
        line.taxCode     = taxCode.code       // snapshot
        line.taxRate     = taxCode.rate        // snapshot
      line.taxAmountDoc  = roundMoney(line.lineTotalDoc * line.taxRate)
      line.taxAmountBase = roundMoney(line.lineTotalBase * line.taxRate)

      // ════════════════════════════════════════
      // STEP 3: GL Account Resolution
      // ════════════════════════════════════════

      line.accountId = resolveDebitAccount(item, settings)
      apAccountId    = resolveAPAccount(pi.vendorId, settings)

      // ════════════════════════════════════════
      // STEP 4: Inventory Movement (SIMPLE + stock items only)
      // ════════════════════════════════════════

      if item.trackInventory && !hasGRNForThisLine(line):
        // SIMPLE mode: PI creates the inventory movement
        ASSERT line.warehouseId is not null
          ERROR: "Warehouse required for stock item {line.itemName}"

        movement = inventoryService.processIN({
          companyId:              pi.companyId,
          itemId:                 line.itemId,
          warehouseId:            line.warehouseId,
          qty:                    convertToBaseUom(line.invoicedQty, line.uom, item),
          date:                   pi.invoiceDate,
          movementType:           'PURCHASE_RECEIPT',
          refs: {
            type:                 'PURCHASE_INVOICE',
            docId:                pi.id,
            lineId:               line.lineId,
          },
          currentUser:            pi.createdBy,
          unitCostInMoveCurrency: line.unitPriceDoc,
          moveCurrency:           pi.currency,
          fxRateMovToBase:        pi.exchangeRate,
          fxRateCCYToBase:        resolveCCYToBaseRate(item),
        })

        line.stockMovementId = movement.id

      // ════════════════════════════════════════
      // STEP 5: Accumulate GL Voucher Lines
      // ════════════════════════════════════════

      // Debit: Inventory or Expense
      voucherLines.push({
        accountId:  line.accountId,
        debitBase:  line.lineTotalBase,
        creditBase: 0,
        currency:   pi.currency,
        debitFx:    line.lineTotalDoc,
        creditFx:   0,
        rate:       pi.exchangeRate,
        memo:       "{line.itemName} x {line.invoicedQty}",
      })

      // Debit: Tax (if any)
      if line.taxAmountBase > 0:
        taxAccountId = resolvePurchaseTaxAccount(line.taxCodeId)
        voucherLines.push({
          accountId:  taxAccountId,
          debitBase:  line.taxAmountBase,
          creditBase: 0,
          currency:   pi.currency,
          debitFx:    line.taxAmountDoc,
          creditFx:   0,
          rate:       pi.exchangeRate,
          memo:       "Tax: {line.taxCode} on {line.itemName}",
        })

      // ── Update PO line invoicedQty ──
      if poLine:
        poLine.invoicedQty += line.invoicedQty

    // ════════════════════════════════════════
    // STEP 6: AP Credit Line (total)
    // ════════════════════════════════════════

    voucherLines.push({
      accountId:  apAccountId,
      debitBase:  0,
      creditBase: pi.grandTotalBase,
      currency:   pi.currency,
      debitFx:    0,
      creditFx:   pi.grandTotalDoc,
      rate:       pi.exchangeRate,
      memo:       "AP — {pi.vendorName} — {pi.invoiceNumber}",
    })

    // ════════════════════════════════════════
    // STEP 7: Create Accounting Voucher
    // ════════════════════════════════════════

    voucher = createAccountingVoucher({
      companyId:    pi.companyId,
      date:         pi.invoiceDate,
      description:  "Purchase Invoice {pi.invoiceNumber} — {pi.vendorName}",
      lines:        voucherLines,
      sourceModule: 'purchases',
      sourceType:   'PURCHASE_INVOICE',
      sourceId:     pi.id,
      voucherTypeId: settings.purchaseVoucherTypeId,
      createdBy:    pi.createdBy,
    })

    pi.voucherId = voucher.id

    // ════════════════════════════════════════
    // STEP 8: Freeze Totals & Update Status
    // ════════════════════════════════════════

    pi.subtotalBase = sum(lines.lineTotalBase)
    pi.taxTotalBase = sum(lines.taxAmountBase)
    pi.grandTotalBase = pi.subtotalBase + pi.taxTotalBase
    pi.subtotalDoc = sum(lines.lineTotalDoc)
    pi.taxTotalDoc = sum(lines.taxAmountDoc)
    pi.grandTotalDoc = pi.subtotalDoc + pi.taxTotalDoc

    pi.outstandingAmountBase = pi.grandTotalBase
    pi.paymentStatus = 'UNPAID'
    pi.status = 'POSTED'
    pi.postedAt = now()
    SAVE pi (txn)

    // ── Update PO status ──
    if po:
      po.status = updatePOStatus(po)
      SAVE po (txn)

  COMMIT TRANSACTION
```

---

## 4. Purchase Return Posting

### Algorithm: PostPurchaseReturn

```
function postPurchaseReturn(pr: PurchaseReturn, settings: PurchaseSettings):
  ASSERT pr.status === 'DRAFT'

  // ── Determine return context ──
  isAfterInvoice = pr.returnContext === 'AFTER_INVOICE'
  pi = null
  grn = null
  po = null

  if isAfterInvoice:
    ASSERT pr.purchaseInvoiceId is not null
    pi = LOAD PurchaseInvoice(pr.purchaseInvoiceId)
    ASSERT pi.status === 'POSTED'
  else:
    // BEFORE_INVOICE — CONTROLLED mode only
    ASSERT settings.procurementControlMode === 'CONTROLLED'
    ASSERT pr.goodsReceiptId is not null
    grn = LOAD GoodsReceipt(pr.goodsReceiptId)
    ASSERT grn.status === 'POSTED'

  if pr.purchaseOrderId:
    po = LOAD PurchaseOrder(pr.purchaseOrderId)

  BEGIN TRANSACTION (txn):

    voucherLines = []

    for each line in pr.lines:
      item = LOAD Item(line.itemId)

      // ════════════════════════════════════════
      // STEP 1: Quantity Validation
      // ════════════════════════════════════════

      if isAfterInvoice:
        piLine = findPILine(pi, line.piLineId)
        prevReturned = getPreviouslyReturnedQtyForPILine(piLine)
        ASSERT line.returnQty <= (piLine.invoicedQty - prevReturned)
          ERROR: "Return qty exceeds invoiced qty for {line.itemName}"
      else:
        grnLine = findGRNLine(grn, line.grnLineId)
        prevReturned = getPreviouslyReturnedQtyForGRNLine(grnLine)
        ASSERT line.returnQty <= (grnLine.receivedQty - prevReturned)
          ERROR: "Return qty exceeds received qty for {line.itemName}"

      // ════════════════════════════════════════
      // STEP 2: Inventory Reversal (always)
      // ════════════════════════════════════════

      if item.trackInventory:
        movement = inventoryService.processOUT({
          companyId:    pr.companyId,
          itemId:       line.itemId,
          warehouseId:  pr.warehouseId,
          qty:          convertToBaseUom(line.returnQty, line.uom, item),
          date:         pr.returnDate,
          movementType: 'RETURN_OUT',
          refs: {
            type:                 'PURCHASE_RETURN',
            docId:                pr.id,
            lineId:               line.lineId,
            reversesMovementId:   findOriginalMovementId(line),
          },
          currentUser:  pr.createdBy,
        })

        line.stockMovementId = movement.id

      // ════════════════════════════════════════
      // STEP 3: GL Lines (AFTER_INVOICE only)
      // ════════════════════════════════════════

      if isAfterInvoice:
        // Credit: Inventory / Expense (reverse original debit)
        voucherLines.push({
          accountId:  line.accountId,
          debitBase:  0,
          creditBase: line.unitCostBase * line.returnQty,
          currency:   pr.currency,
          debitFx:    0,
          creditFx:   line.unitCostDoc * line.returnQty,
          rate:       pr.exchangeRate,
          memo:       "Return: {line.itemName} x {line.returnQty}",
        })

        // Credit: Tax reversal (if any)
        if line.taxAmountBase > 0:
          taxAccountId = resolvePurchaseTaxAccount(line.taxCodeId)
          voucherLines.push({
            accountId:  taxAccountId,
            debitBase:  0,
            creditBase: line.taxAmountBase,
            currency:   pr.currency,
            debitFx:    0,
            creditFx:   line.taxAmountDoc,
            rate:       pr.exchangeRate,
            memo:       "Tax reversal: {line.taxCode}",
          })

      // ── Update PO line returnedQty ──
      if po:
        poLine = findPOLine(po, line.poLineId)
        if poLine:
          poLine.returnedQty += line.returnQty

      // ── BEFORE_INVOICE: also reduce PO receivedQty ──
      if !isAfterInvoice && po:
        poLine = findPOLine(po, line.poLineId)
        if poLine:
          poLine.receivedQty -= line.returnQty

    // ════════════════════════════════════════
    // STEP 4: AP Debit (AFTER_INVOICE only)
    // ════════════════════════════════════════

    if isAfterInvoice:
      apAccountId = resolveAPAccount(pr.vendorId, settings)
      voucherLines.push({
        accountId:  apAccountId,
        debitBase:  pr.grandTotalBase,
        creditBase: 0,
        currency:   pr.currency,
        debitFx:    pr.grandTotalDoc,
        creditFx:   0,
        rate:       pr.exchangeRate,
        memo:       "AP reversal — {pr.vendorName} — Return {pr.returnNumber}",
      })

      // Create GL voucher
      voucher = createAccountingVoucher({
        companyId:    pr.companyId,
        date:         pr.returnDate,
        description:  "Purchase Return {pr.returnNumber} — {pr.vendorName}",
        lines:        voucherLines,
        sourceModule: 'purchases',
        sourceType:   'PURCHASE_RETURN',
        sourceId:     pr.id,
        createdBy:    pr.createdBy,
      })
      pr.voucherId = voucher.id

      // Update PI outstanding amount
      pi.paidAmountBase = pi.paidAmountBase   // unchanged
      pi.outstandingAmountBase -= pr.grandTotalBase
      recalcPaymentStatus(pi)
      SAVE pi (txn)

    // ════════════════════════════════════════
    // STEP 5: Finalize
    // ════════════════════════════════════════

    pr.status = 'POSTED'
    pr.postedAt = now()
    SAVE pr (txn)

    if po:
      po.status = updatePOStatus(po)
      SAVE po (txn)

  COMMIT TRANSACTION
```

---

## 5. Helper Functions

### resolveDebitAccount

```
function resolveDebitAccount(item: Item, settings: PurchaseSettings): string {
  // For stock items → inventory asset account
  if item.trackInventory:
    if item.inventoryAssetAccountId:
      return item.inventoryAssetAccountId
    category = LOAD ItemCategory(item.categoryId)
    if category?.defaultInventoryAssetAccountId:
      return category.defaultInventoryAssetAccountId
    ASSERT settings.defaultPurchaseExpenseAccountId exists
    return settings.defaultPurchaseExpenseAccountId

  // For services → expense account
  if item.cogsAccountId:
    return item.cogsAccountId
  category = LOAD ItemCategory(item.categoryId)
  if category?.defaultCogsAccountId:
    return category.defaultCogsAccountId
  ASSERT settings.defaultPurchaseExpenseAccountId exists
  return settings.defaultPurchaseExpenseAccountId
}
```

### resolveAPAccount

```
function resolveAPAccount(vendorId: string, settings: PurchaseSettings): string {
  vendor = LOAD Party(vendorId)
  if vendor.defaultAPAccountId:
    return vendor.defaultAPAccountId
  ASSERT settings.defaultAPAccountId exists
  return settings.defaultAPAccountId
}
```

### resolvePurchaseTaxAccount

```
function resolvePurchaseTaxAccount(taxCodeId: string): string {
  taxCode = LOAD TaxCode(taxCodeId)
  ASSERT taxCode.purchaseTaxAccountId exists
    ERROR: "TaxCode {taxCode.code} has no purchase tax account"
  return taxCode.purchaseTaxAccountId
}
```

### hasGRNForThisLine

```
function hasGRNForThisLine(piLine: PurchaseInvoiceLine): boolean {
  // Check if a GRN line was already posted for this line's PO line
  return piLine.grnLineId !== null && piLine.grnLineId !== undefined
}
```

### convertToBaseUom

```
function convertToBaseUom(qty: number, uom: string, item: Item): number {
  if uom === item.baseUom:
    return qty
  conversion = LOAD UomConversion(item.id, uom, item.baseUom)
  ASSERT conversion exists
    ERROR: "No UOM conversion from {uom} to {item.baseUom} for item {item.code}"
  return qty * conversion.factor
}
```

### recalcPaymentStatus

```
function recalcPaymentStatus(pi: PurchaseInvoice):
  if pi.outstandingAmountBase <= 0:
    pi.paymentStatus = 'PAID'
  else if pi.paidAmountBase > 0:
    pi.paymentStatus = 'PARTIALLY_PAID'
  else:
    pi.paymentStatus = 'UNPAID'
```

---

## 6. Document Number Generation

```
function generateDocumentNumber(settings: PurchaseSettings, docType: string): string {
  switch docType:
    case 'PO':
      prefix = settings.poNumberPrefix
      seq = settings.poNumberNextSeq
      settings.poNumberNextSeq += 1
    case 'GRN':
      prefix = settings.grnNumberPrefix
      seq = settings.grnNumberNextSeq
      settings.grnNumberNextSeq += 1
    case 'PI':
      prefix = settings.piNumberPrefix
      seq = settings.piNumberNextSeq
      settings.piNumberNextSeq += 1
    case 'PR':
      prefix = settings.prNumberPrefix
      seq = settings.prNumberNextSeq
      settings.prNumberNextSeq += 1

  paddedSeq = seq.toString().padStart(5, '0')
  return "{prefix}-{paddedSeq}"
  // Example: PO-00001, GRN-00042, PI-00003, PR-00001

  SAVE settings   // persist incremented sequence
```

---

## 7. Payment Integration

Payments are NOT created by the Purchase module. The PI UI triggers Accounting.

### Algorithm: UpdateInvoicePaymentStatus

Called by Accounting module when a payment voucher is posted that references a PI.

```
function updateInvoicePaymentStatus(invoiceId: string, paymentAmountBase: number):
  pi = LOAD PurchaseInvoice(invoiceId)
  ASSERT pi.status === 'POSTED'

  pi.paidAmountBase += paymentAmountBase
  pi.outstandingAmountBase = pi.grandTotalBase - pi.paidAmountBase
  recalcPaymentStatus(pi)
  SAVE pi
```

---

## 8. Standalone PI Validations (SIMPLE mode)

Even standalone Purchase Invoices (no PO) must have normal document validations:

```
function validateStandalonePI(pi: PurchaseInvoice):
  ASSERT pi.vendorId is valid Party with 'VENDOR' role
  ASSERT pi.lines.length > 0
  ASSERT pi.currency is in company's enabled currencies
  ASSERT pi.exchangeRate > 0

  for each line in pi.lines:
    ASSERT line.itemId is valid Item
    ASSERT line.invoicedQty > 0
    ASSERT line.unitPriceDoc >= 0
    if line.trackInventory:
      ASSERT line.warehouseId is not null
        ERROR: "Warehouse required for stock item {line.itemName}"
    if line.taxCodeId:
      taxCode = LOAD TaxCode(line.taxCodeId)
      ASSERT taxCode.active === true
      ASSERT taxCode.scope in ['PURCHASE', 'BOTH']
```

---

## 9. Tax Defaults & Snapshot Flow

### On document line creation (draft)

```
function applyTaxDefaults(line, item: Item):
  if item.defaultPurchaseTaxCodeId:
    taxCode = LOAD TaxCode(item.defaultPurchaseTaxCodeId)
    if taxCode.active:
      line.taxCodeId = taxCode.id
      line.taxRate = taxCode.rate
  else:
    line.taxCodeId = null
    line.taxRate = 0

  // User may override taxCodeId on the draft
```

### On posting (freeze snapshot)

```
function freezeTaxSnapshot(line):
  if line.taxCodeId:
    taxCode = LOAD TaxCode(line.taxCodeId)
    line.taxCode = taxCode.code      // freeze code string
    line.taxRate = taxCode.rate      // freeze rate
  line.taxAmountDoc = roundMoney(line.lineTotalDoc * line.taxRate)
  line.taxAmountBase = roundMoney(line.lineTotalBase * line.taxRate)
  // After this, changes to TaxCode master do NOT affect this line
```

---

## 10. Cross-Reference Summary

| Algorithm | Calls | Creates |
|-----------|-------|---------|
| ConfirmPO | — | — (status change only) |
| PostGoodsReceipt | `inventoryService.processIN()` | StockMovement per line |
| PostPurchaseInvoice | `inventoryService.processIN()` (SIMPLE stock only), `createAccountingVoucher()` | StockMovement (maybe), Voucher |
| PostPurchaseReturn | `inventoryService.processOUT()`, `createAccountingVoucher()` (AFTER_INVOICE only) | StockMovement, Voucher (maybe) |
| UpdateInvoicePaymentStatus | — | — (updates PI fields) |
