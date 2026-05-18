# Inventory Module — Cost Algorithms

> **Status:** LOCKED  
> **Prerequisite:** Read [SCHEMAS.md](./SCHEMAS.md) for field definitions.

---

## 1  Currency Conversion

```
function convertCosts(unitCostInMoveCurrency, moveCurrency,
                      baseCurrency, costCurrency,
                      fxRateMovToBase, fxRateCCYToBase):

  if moveCurrency == baseCurrency:
    unitCostBase = unitCostInMoveCurrency
    unitCostCCY  = unitCostBase / fxRateCCYToBase

  elif moveCurrency == costCurrency:
    unitCostCCY  = unitCostInMoveCurrency
    unitCostBase = unitCostCCY * fxRateCCYToBase

  else:
    // Cross-rate triangulation through base
    unitCostBase = unitCostInMoveCurrency * fxRateMovToBase
    unitCostCCY  = unitCostInMoveCurrency * (fxRateMovToBase / fxRateCCYToBase)

  // Guard: if costCurrency == baseCurrency, force equality
  if costCurrency == baseCurrency:
    unitCostCCY = unitCostBase
    fxRateCCYToBase = 1.0

  unitCostBase = roundMoney(unitCostBase, basePrecision)
  unitCostCCY  = roundMoney(unitCostCCY, ccyPrecision)

  return { unitCostBase, unitCostCCY }
```

### Rounding Rules
- FX rates: stored at 6+ decimal places, never rounded.
- `unitCostBase` / `unitCostCCY`: rounded per currency precision via `roundByCurrency()`.
- `totalCostBase` / `totalCostCCY`: computed as `roundMoney(unitCost × qty)` — rounding applied AFTER multiplication to minimize accumulated error.

---

## 2  processIN

Handles: `PURCHASE_RECEIPT`, `OPENING_STOCK`, `ADJUSTMENT_IN`, `RETURN_IN`, `TRANSFER_IN`

```
function processIN(item, warehouse, qty, date,
                   unitCostInMoveCurrency, moveCurrency,
                   fxRateMovToBase, fxRateCCYToBase,
                   movementType, refs, currentUser):

  baseCurrency = getCompanyBaseCurrency()

  // ── Step 1: Convert cost to both tracks ──
  { unitCostBase, unitCostCCY } = convertCosts(
    unitCostInMoveCurrency, moveCurrency,
    baseCurrency, item.costCurrency,
    fxRateMovToBase, fxRateCCYToBase
  )

  // ── Step 2: Read StockLevel (inside transaction) ──
  level = getOrCreateStockLevel(item.id, warehouse.id)
  qtyBefore = level.qtyOnHand
  oldMaxBusinessDate = level.maxBusinessDate

  // ── Step 3: Negative stock settlement metadata ──
  settlesNegativeQty = min(qty, max(-qtyBefore, 0))   // 0 if qtyBefore >= 0
  newPositiveQty     = qty - settlesNegativeQty

  // ── Step 4: Moving average update ──
  if qtyBefore <= 0:
    // Zero or negative stock: avg cost resets to incoming cost.
    // Whether deficit is fully or partially covered, the average
    // becomes the incoming cost (no old positive-stock value to blend).
    newAvgBase = unitCostBase
    newAvgCCY  = unitCostCCY

  else:
    // Positive stock: weighted average
    newQty     = qtyBefore + qty
    newAvgBase = roundMoney((level.avgCostBase * qtyBefore + unitCostBase * qty) / newQty)
    newAvgCCY  = roundMoney((level.avgCostCCY  * qtyBefore + unitCostCCY  * qty) / newQty)

  // ── Step 5: Update StockLevel ──
  level.qtyOnHand      += qty
  level.avgCostBase     = newAvgBase
  level.avgCostCCY      = newAvgCCY
  level.lastCostBase    = unitCostBase
  level.lastCostCCY     = unitCostCCY
  level.postingSeq     += 1
  level.version        += 1
  level.totalMovements += 1
  level.maxBusinessDate = max(oldMaxBusinessDate, date)

  qtyAfter    = level.qtyOnHand
  isBackdated = (date < oldMaxBusinessDate)
  now         = currentTimestamp()

  // ── Step 6: Create StockMovement ──
  movement = StockMovement({
    id:          generateId(),
    companyId:   item.companyId,
    date:        date,
    postingSeq:  level.postingSeq,
    createdAt:   now,
    createdBy:   currentUser,
    postedAt:    now,

    itemId:      item.id,
    warehouseId: warehouse.id,
    direction:   'IN',
    movementType: movementType,
    qty:         qty,
    uom:         item.baseUom,

    referenceType:       refs.type,
    referenceId:         refs.docId,
    referenceLineId:     refs.lineId,
    reversesMovementId:  refs.reversesMovementId,    // only for RETURN_IN
    transferPairId:      refs.transferPairId,         // only for TRANSFER_IN

    unitCostBase:    unitCostBase,
    unitCostCCY:     unitCostCCY,
    totalCostBase:   roundMoney(unitCostBase * qty),
    totalCostCCY:    roundMoney(unitCostCCY  * qty),

    movementCurrency: moveCurrency,
    fxRateMovToBase:  fxRateMovToBase,
    fxRateCCYToBase:  fxRateCCYToBase,
    fxRateKind:       'DOCUMENT',

    avgCostBaseAfter: newAvgBase,
    avgCostCCYAfter:  newAvgCCY,

    qtyBefore:           qtyBefore,
    qtyAfter:            qtyAfter,
    settlesNegativeQty:  settlesNegativeQty,
    newPositiveQty:      newPositiveQty,

    negativeQtyAtPosting: qtyAfter < 0,
    costSettled:          true,          // IN is always settled at its own cost
    isBackdated:          isBackdated,
    costSource:           deriveCostSource(movementType),
  })

  level.lastMovementId = movement.id

  // ── Step 7: Persist (atomic Firestore transaction) ──
  saveInTransaction(level, movement)
  return movement
```

---

## 3  processOUT

Handles: `SALES_DELIVERY`, `ADJUSTMENT_OUT`, `RETURN_OUT`, `TRANSFER_OUT`

```
function processOUT(item, warehouse, qty, date,
                    movementType, refs, currentUser):

  baseCurrency = getCompanyBaseCurrency()

  // ── Step 1: Read StockLevel (inside transaction) ──
  level = getOrCreateStockLevel(item.id, warehouse.id)
  qtyBefore = level.qtyOnHand
  oldMaxBusinessDate = level.maxBusinessDate

  // ── Step 2: Determine issue cost ──
  if qtyBefore > 0:
    issueCostBase = level.avgCostBase
    issueCostCCY  = level.avgCostCCY
    costBasis     = 'AVG'
  elif level.lastCostBase > 0:
    // Zero or negative stock but we have a last cost
    issueCostBase = level.lastCostBase
    issueCostCCY  = level.lastCostCCY
    costBasis     = 'LAST_KNOWN'
  else:
    // No cost information at all (sell before any purchase)
    issueCostBase = 0
    issueCostCCY  = 0
    costBasis     = 'MISSING'

  // ── Step 3: Partial settlement ──
  settledQty   = min(qty, max(qtyBefore, 0))
  unsettledQty = qty - settledQty
  costSettled  = (unsettledQty == 0)

  // ── Step 4: FX rate for OUT ──
  // OUT uses effective/derived rate, not a document rate
  if issueCostCCY > 0:
    effectiveFxCCYToBase = issueCostBase / issueCostCCY
  else:
    effectiveFxCCYToBase = 1.0   // fallback when cost is zero/missing

  // ── Step 5: Update StockLevel ──
  level.qtyOnHand      -= qty
  // avgCost does NOT change on OUT (moving average rule)
  level.postingSeq     += 1
  level.version        += 1
  level.totalMovements += 1
  level.maxBusinessDate = max(oldMaxBusinessDate, date)

  qtyAfter    = level.qtyOnHand
  isBackdated = (date < oldMaxBusinessDate)
  now         = currentTimestamp()

  // ── Step 6: Create StockMovement ──
  movement = StockMovement({
    id:          generateId(),
    companyId:   item.companyId,
    date:        date,
    postingSeq:  level.postingSeq,
    createdAt:   now,
    createdBy:   currentUser,
    postedAt:    now,

    itemId:      item.id,
    warehouseId: warehouse.id,
    direction:   'OUT',
    movementType: movementType,
    qty:         qty,
    uom:         item.baseUom,

    referenceType:       refs.type,
    referenceId:         refs.docId,
    referenceLineId:     refs.lineId,
    reversesMovementId:  refs.reversesMovementId,    // only for RETURN_OUT
    transferPairId:      refs.transferPairId,         // only for TRANSFER_OUT

    unitCostBase:    issueCostBase,
    unitCostCCY:     issueCostCCY,
    totalCostBase:   roundMoney(issueCostBase * qty),
    totalCostCCY:    roundMoney(issueCostCCY  * qty),

    movementCurrency: item.costCurrency,             // OUT cost is denominated in CCY
    fxRateMovToBase:  effectiveFxCCYToBase,
    fxRateCCYToBase:  effectiveFxCCYToBase,
    fxRateKind:       'EFFECTIVE',

    avgCostBaseAfter: level.avgCostBase,             // unchanged
    avgCostCCYAfter:  level.avgCostCCY,              // unchanged

    qtyBefore:            qtyBefore,
    qtyAfter:             qtyAfter,
    settledQty:           settledQty,
    unsettledQty:         unsettledQty,
    unsettledCostBasis:   unsettledQty > 0 ? costBasis : undefined,

    negativeQtyAtPosting: qtyAfter < 0,
    costSettled:          costSettled,
    isBackdated:          isBackdated,
    costSource:           deriveCostSource(movementType),
  })

  level.lastMovementId = movement.id

  // ── Step 7: Persist (atomic Firestore transaction) ──
  saveInTransaction(level, movement)
  return movement
```

---

## 4  processTRANSFER

Creates paired TRANSFER_OUT + TRANSFER_IN movements in a single transaction.

```
function processTRANSFER(item, sourceWarehouseId, destWarehouseId,
                         qty, date, transferDocId, currentUser):

  pairId = generateUUID()
  baseCurrency = getCompanyBaseCurrency()
  now = currentTimestamp()

  // ══════════ SOURCE: OUT ══════════
  srcLevel = getOrCreateStockLevel(item.id, sourceWarehouseId)
  srcQtyBefore = srcLevel.qtyOnHand
  srcOldMaxDate = srcLevel.maxBusinessDate

  // Transfer uses the SAME cost-determination rules as OUT
  if srcQtyBefore > 0:
    transferCostBase = srcLevel.avgCostBase
    transferCostCCY  = srcLevel.avgCostCCY
    srcCostBasis     = 'AVG'
  elif srcLevel.lastCostBase > 0:
    transferCostBase = srcLevel.lastCostBase
    transferCostCCY  = srcLevel.lastCostCCY
    srcCostBasis     = 'LAST_KNOWN'
  else:
    transferCostBase = 0
    transferCostCCY  = 0
    srcCostBasis     = 'MISSING'

  srcSettledQty   = min(qty, max(srcQtyBefore, 0))
  srcUnsettledQty = qty - srcSettledQty

  srcLevel.qtyOnHand      -= qty
  srcLevel.postingSeq     += 1
  srcLevel.version        += 1
  srcLevel.totalMovements += 1
  srcLevel.maxBusinessDate = max(srcOldMaxDate, date)

  srcQtyAfter    = srcLevel.qtyOnHand
  srcIsBackdated = (date < srcOldMaxDate)

  if transferCostCCY > 0:
    srcFxRate = transferCostBase / transferCostCCY
  else:
    srcFxRate = 1.0

  outMov = StockMovement({
    direction:       'OUT',
    movementType:    'TRANSFER_OUT',
    postingSeq:      srcLevel.postingSeq,
    transferPairId:  pairId,
    referenceType:   'STOCK_TRANSFER',
    referenceId:     transferDocId,

    unitCostBase:    transferCostBase,
    unitCostCCY:     transferCostCCY,
    totalCostBase:   roundMoney(transferCostBase * qty),
    totalCostCCY:    roundMoney(transferCostCCY  * qty),

    movementCurrency: item.costCurrency,
    fxRateMovToBase:  srcFxRate,
    fxRateCCYToBase:  srcFxRate,
    fxRateKind:       'EFFECTIVE',

    avgCostBaseAfter: srcLevel.avgCostBase,
    avgCostCCYAfter:  srcLevel.avgCostCCY,

    qtyBefore:            srcQtyBefore,
    qtyAfter:             srcQtyAfter,
    settledQty:           srcSettledQty,
    unsettledQty:         srcUnsettledQty,
    unsettledCostBasis:   srcUnsettledQty > 0 ? srcCostBasis : undefined,

    costSettled:          srcUnsettledQty == 0,
    negativeQtyAtPosting: srcQtyAfter < 0,
    isBackdated:          srcIsBackdated,
    costSource:           'TRANSFER',
    postedAt:             now,
    ...
  })

  srcLevel.lastMovementId = outMov.id

  // ══════════ DESTINATION: IN ══════════
  dstLevel = getOrCreateStockLevel(item.id, destWarehouseId)
  dstQtyBefore = dstLevel.qtyOnHand
  dstOldMaxDate = dstLevel.maxBusinessDate

  dstSettlesNeg  = min(qty, max(-dstQtyBefore, 0))
  dstNewPositive = qty - dstSettlesNeg

  if dstQtyBefore <= 0:
    dstLevel.avgCostBase = transferCostBase
    dstLevel.avgCostCCY  = transferCostCCY
  else:
    newQty = dstQtyBefore + qty
    dstLevel.avgCostBase = roundMoney(
      (dstLevel.avgCostBase * dstQtyBefore + transferCostBase * qty) / newQty
    )
    dstLevel.avgCostCCY = roundMoney(
      (dstLevel.avgCostCCY * dstQtyBefore + transferCostCCY * qty) / newQty
    )

  dstLevel.qtyOnHand      += qty
  dstLevel.lastCostBase    = transferCostBase
  dstLevel.lastCostCCY     = transferCostCCY
  dstLevel.postingSeq     += 1
  dstLevel.version        += 1
  dstLevel.totalMovements += 1
  dstLevel.maxBusinessDate = max(dstOldMaxDate, date)

  dstQtyAfter    = dstLevel.qtyOnHand
  dstIsBackdated = (date < dstOldMaxDate)

  inMov = StockMovement({
    direction:       'IN',
    movementType:    'TRANSFER_IN',
    postingSeq:      dstLevel.postingSeq,
    transferPairId:  pairId,
    referenceType:   'STOCK_TRANSFER',
    referenceId:     transferDocId,

    unitCostBase:    transferCostBase,
    unitCostCCY:     transferCostCCY,
    totalCostBase:   roundMoney(transferCostBase * qty),
    totalCostCCY:    roundMoney(transferCostCCY  * qty),

    movementCurrency: item.costCurrency,
    fxRateMovToBase:  srcFxRate,
    fxRateCCYToBase:  srcFxRate,
    fxRateKind:       'EFFECTIVE',

    avgCostBaseAfter: dstLevel.avgCostBase,
    avgCostCCYAfter:  dstLevel.avgCostCCY,

    qtyBefore:            dstQtyBefore,
    qtyAfter:             dstQtyAfter,
    settlesNegativeQty:   dstSettlesNeg,
    newPositiveQty:       dstNewPositive,

    costSettled:          true,
    negativeQtyAtPosting: dstQtyAfter < 0,
    isBackdated:          dstIsBackdated,
    costSource:           'TRANSFER',
    postedAt:             now,
    ...
  })

  dstLevel.lastMovementId = inMov.id

  // ── Persist ALL in single transaction ──
  saveAllInTransaction(srcLevel, dstLevel, outMov, inMov)
  return { outMov, inMov }
```

---

## 5  Helper: deriveCostSource

```
function deriveCostSource(movementType: MovementType): CostSource {
  switch (movementType):
    case 'PURCHASE_RECEIPT':  return 'PURCHASE'
    case 'OPENING_STOCK':     return 'OPENING'
    case 'ADJUSTMENT_IN':     return 'ADJUSTMENT'
    case 'ADJUSTMENT_OUT':    return 'ADJUSTMENT'
    case 'TRANSFER_IN':       return 'TRANSFER'
    case 'TRANSFER_OUT':      return 'TRANSFER'
    case 'RETURN_IN':         return 'RETURN'
    case 'RETURN_OUT':        return 'RETURN'
    case 'SALES_DELIVERY':    return 'PURCHASE'   // cost came from avg (originated from purchases)
}
```

---

## 6  Helper: getOrCreateStockLevel

```
function getOrCreateStockLevel(itemId, warehouseId):
  id = `${itemId}_${warehouseId}`
  level = firestore.getDoc(stockLevelsCollection, id)

  if level == null:
    // First-ever movement for this item+warehouse
    level = new StockLevel({
      id, companyId, itemId, warehouseId,
      qtyOnHand: 0,
      reservedQty: 0,
      avgCostBase: 0,
      avgCostCCY: 0,
      lastCostBase: 0,
      lastCostCCY: 0,
      postingSeq: 0,
      maxBusinessDate: '1970-01-01',
      totalMovements: 0,
      lastMovementId: '',
      version: 0,
      updatedAt: now
    })

  return level
```

---

## 7  Bug Fix Verification Checklist

| Fix ID | Bug | Algorithm Location | What to Verify |
|--------|-----|-------------------|----------------|
| B1 | Backdating flag ordering | `processIN` step 5, `processOUT` step 5 | `isBackdated` evaluated using `oldMaxBusinessDate` BEFORE updating `maxBusinessDate` |
| B2 | OUT FX rate division by zero | `processOUT` step 4 | Guard `if issueCostCCY > 0` before division; set `fxRateKind = 'EFFECTIVE'`; fallback to 1.0 |
| B3 | Transfer uses OUT cost rules | `processTRANSFER` source section | Same 3-tier cost lookup as `processOUT` (avgCost → lastCost → MISSING) |
| B4 | Sell before any IN (cost unknown) | `processOUT` step 2, else branch | `costBasis = 'MISSING'`, `issueCostBase = 0`, `costSettled = false` |
| B5 | Partial settlement persisted | `processOUT` step 3 + step 6, `processIN` step 3 + step 6 | `settledQty`, `unsettledQty`, `costSettled`, `settlesNegativeQty`, `newPositiveQty` all stored on movement |
