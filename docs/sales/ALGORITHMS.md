# Sales Module — Algorithms & Posting Logic

> **Status:** DRAFT — Pending Review  
> **References:** [MASTER_PLAN.md](./MASTER_PLAN.md), [SCHEMAS.md](./SCHEMAS.md)

---

## 1. Document Number Generation

Same pattern as Purchases:
```
generateDocumentNumber(settings, docType):
  prefix = settings[docType + 'NumberPrefix']
  seq = settings[docType + 'NumberNextSeq']
  number = prefix + '-' + padLeft(seq, 5)
  settings[docType + 'NumberNextSeq'] = seq + 1
  save(settings)
  return number
```

---

## 2. Sales Order Status Machine

```
DRAFT ──► CONFIRMED ──► PARTIALLY_DELIVERED ──► FULLY_DELIVERED ──► CLOSED
  │           │
  └── CANCELLED (from DRAFT or CONFIRMED only)
```

**Transitions triggered by:**
- `DRAFT → CONFIRMED`: User action
- `CONFIRMED → PARTIALLY_DELIVERED`: When any DN is posted for this SO
- `PARTIALLY_DELIVERED → FULLY_DELIVERED`: When all lines have `deliveredQty ≥ orderedQty`
- `FULLY_DELIVERED → CLOSED`: User action or auto-close when fully invoiced
- `* → CANCELLED`: User action (only from DRAFT or CONFIRMED)

### `updateSOStatus(so)`:
```
if so.status in ['CANCELLED', 'CLOSED']:
  return  // terminal, no change

allFullyDelivered = so.lines.every(l => l.deliveredQty >= l.orderedQty)
anyDelivered = so.lines.some(l => l.deliveredQty > 0)

if allFullyDelivered:
  so.status = 'FULLY_DELIVERED'
elif anyDelivered:
  so.status = 'PARTIALLY_DELIVERED'
// else keep current status
```

---

## 3. Delivery Note Posting Algorithm

### `PostDeliveryNote(companyId, dnId)`:

```
1. Load DN, assert status = 'DRAFT'
2. Load settings
3. If SO-linked:
   a. Load SO, assert status in ['CONFIRMED', 'PARTIALLY_DELIVERED']
   b. For each DN line with soLineId:
      soLine = find SO line
      remaining = soLine.orderedQty - soLine.deliveredQty
      if dn.line.deliveredQty > remaining + tolerance:
        THROW "Over-delivery for item [name]"

4. For each DN line:
   a. Load Item → assert trackInventory = true
   b. Load Warehouse → assert exists
   c. Call ISalesInventoryService.processOUT({
        companyId, itemId, warehouseId,
        qty: deliveredQty,
        date: deliveryDate,
        movementType: 'SALES_DELIVERY',
        refs: { type: 'DELIVERY_NOTE', docId: dnId, lineId: lineId },
        currentUser
      })
   d. stockMovement = result
   e. line.stockMovementId = stockMovement.id
   f. line.unitCostBase = stockMovement.unitCostBase  // WAC from engine
   g. line.lineCostBase = deliveredQty × unitCostBase

5. Create COGS GL voucher:
   Accumulate lines by (cogsAccountId, inventoryAccountId):
     Dr COGS Account        sum(lineCostBase)
     Cr Inventory Account   sum(lineCostBase)
   Create VoucherEntity with:
     sourceModule = 'sales'
     sourceType = 'DELIVERY_NOTE'
     sourceId = dnId
   dn.cogsVoucherId = voucher.id

6. If SO-linked:
   For each DN line with soLineId:
     soLine.deliveredQty += dn.line.deliveredQty
   updateSOStatus(so)
   save(so)

7. dn.status = 'POSTED'
   dn.postedAt = now
   save(dn)
```

---

## 4. Sales Invoice Posting Algorithm

### `PostSalesInvoice(companyId, siId)`:

```
1. Load SI, assert status = 'DRAFT'
2. Load settings, load baseCurrency

3. Validate posting quantities:
   If SO-linked:
     Load SO
     For each SI line with soLineId:
       soLine = find SO line
       mode = settings.salesControlMode
       
       if mode = 'CONTROLLED' AND soLine.trackInventory:
         ceiling = soLine.deliveredQty - soLine.invoicedQty
         if si.line.invoicedQty > ceiling:
           BLOCK "Cannot invoice more than delivered for [item]"
       
       elif mode = 'CONTROLLED' AND NOT soLine.trackInventory:
         ceiling = soLine.orderedQty - soLine.invoicedQty
         if si.line.invoicedQty > ceiling:
           BLOCK "Cannot invoice more than ordered for service [item]"
       
       elif mode = 'SIMPLE':
         ceiling = soLine.orderedQty - soLine.invoicedQty
         tolerancePct = settings.overInvoiceTolerancePct
         maxAllowed = ceiling × (1 + tolerancePct/100)
         if si.line.invoicedQty > maxAllowed:
           BLOCK "Invoice qty exceeds order qty for [item]"

4. For each SI line:
   a. Freeze tax snapshot:
      if taxCodeId: load TaxCode, snapshot code + rate
   
   b. Resolve revenue account (hierarchy):
      item.revenueAccountId → category.revenueAccountId → settings.defaultRevenueAccountId
   
   c. If SIMPLE mode AND trackInventory AND no DN:
      - Resolve COGS + inventory accounts
      - Call ISalesInventoryService.processOUT() → SALES_DELIVERY
      - line.stockMovementId = result.id
      - line.unitCostBase = result.unitCostBase (WAC)
      - line.lineCostBase = invoicedQty × unitCostBase
   
   d. If CONTROLLED mode AND trackInventory:
      - COGS already recorded by DN, no inventory action needed
      - But we still need the cost info for reporting:
        line.unitCostBase = lookup from DN line or SO line cost
        line.lineCostBase = invoicedQty × unitCostBase

5. Create Revenue GL voucher:
   Accumulate:
     Dr AR Account            sum(lineTotalBase + taxAmountBase)  [customer → default]
     Cr Revenue Account       sum(lineTotalBase)                  [per line resolved]
     Cr Sales Tax Account     sum(taxAmountBase)                  [from TaxCode]
   VoucherEntity metadata:
     sourceModule = 'sales', sourceType = 'SALES_INVOICE', sourceId = siId
   si.voucherId = voucher.id

6. If SIMPLE mode stock items had inventory movements:
   Create COGS GL voucher:
     Dr COGS Account          sum(lineCostBase)
     Cr Inventory Account     sum(lineCostBase)
   si.cogsVoucherId = cogsVoucher.id

7. If SO-linked:
   For each SI line with soLineId:
     soLine.invoicedQty += si.line.invoicedQty
   save(so)

8. si.status = 'POSTED'
   si.postedAt = now
   si.paymentStatus = 'UNPAID'
   si.outstandingAmountBase = si.grandTotalBase
   save(si)
```

---

## 5. Sales Return Posting Algorithm

### `PostSalesReturn(companyId, srId)`:

```
1. Load SR, assert status = 'DRAFT'
2. Load settings, baseCurrency

3. Validate return quantities:
   If AFTER_INVOICE:
     Load SI
     For each SR line with siLineId:
       piLine = find SI line
       previouslyReturned = sum of prior returns for this siLineId
       remaining = piLine.invoicedQty - previouslyReturned
       if sr.line.returnQty > remaining:
         BLOCK "Return qty exceeds invoiceable qty"
   
   If BEFORE_INVOICE:
     Load DN
     For each SR line with dnLineId:
       dnLine = find DN line
       previouslyReturned = sum of prior returns for this dnLineId
       remaining = dnLine.deliveredQty - previouslyReturned
       if sr.line.returnQty > remaining:
         BLOCK "Return qty exceeds delivered qty"

4. For each SR line:
   a. Create RETURN_IN inventory movement:
      ISalesInventoryService.processIN({
        movementType: 'RETURN_IN',
        refs: { type: 'SALES_RETURN', docId: srId, lineId: lineId }
      })
   b. line.stockMovementId = result.id

5. Create COGS reversal voucher (both contexts):
   Dr Inventory Account      sum(lineCostBase)
   Cr COGS Account           sum(lineCostBase)
   sr.cogsVoucherId = voucher.id

6. If AFTER_INVOICE:
   a. Create Revenue reversal voucher:
      Dr Revenue Account       sum(lineTotalBase)
      Dr Sales Tax Account     sum(taxAmountBase)
      Cr AR Account            sum(grandTotalBase)
      sr.revenueVoucherId = voucher.id
   
   b. Update SI outstanding:
      si.outstandingAmountBase -= sr.grandTotalBase
      si.paymentStatus = recalcPaymentStatus(si)
      save(si)

7. If BEFORE_INVOICE (CONTROLLED only):
   Update SO line deliveredQty:
     soLine.deliveredQty -= sr.line.returnQty
   soLine.returnedQty += sr.line.returnQty
   updateSOStatus(so)
   save(so)

8. If AFTER_INVOICE:
   Update SO line:
     soLine.invoicedQty -= sr.line.returnQty (if relevant)
     soLine.returnedQty += sr.line.returnQty
   save(so)

9. sr.status = 'POSTED'
   sr.postedAt = now
   save(sr)
```

---

## 6. Payment Status Sync

Same pattern as Purchases:

```
UpdateSalesInvoicePaymentStatus(companyId, siId, paidAmountBase):
  si = load(siId)
  si.paidAmountBase = paidAmountBase
  si.outstandingAmountBase = si.grandTotalBase - paidAmountBase
  
  if outstandingAmountBase <= 0:
    si.paymentStatus = 'PAID'
  elif paidAmountBase > 0:
    si.paymentStatus = 'PARTIALLY_PAID'
  else:
    si.paymentStatus = 'UNPAID'
  
  save(si)
```

---

## 7. COGS Cost Resolution

### From Inventory Engine (primary)
```
When processOUT is called:
  - Engine uses weighted average cost (WAC)
  - Returns StockMovement with unitCostBase populated
  - This is the authoritative COGS unit cost
```

### For CONTROLLED mode SI (cost reference)
```
When SI is posted in CONTROLLED mode:
  - Stock was already delivered via DN
  - DN lines have unitCostBase from processOUT
  - SI references DN lines for cost reporting
  - If no explicit DN-line link, use item's current WAC
```

---

## 8. Required Tests

### Phase 2 Tests (DN + SI Posting)
1. PostDN creates SALES_DELIVERY inventory movement per line
2. PostDN creates COGS GL voucher (Dr COGS, Cr Inventory)
3. PostDN updates SO line deliveredQty
4. PostDN updates SO status to PARTIALLY_DELIVERED
5. PostSI (CONTROLLED stock): blocks if invoicedQty > deliveredQty
6. PostSI (CONTROLLED service): allows without DN
7. PostSI (SIMPLE standalone): creates inventory OUT + Revenue + COGS vouchers
8. PostSI (SIMPLE SO-linked): blocks if invoicedQty > orderedQty
9. PostSI: tax snapshot frozen at posting
10. PostSI with foreign currency computes base amounts correctly

### Phase 3 Tests (SR)
11. PostSR (AFTER_INVOICE): creates RETURN_IN + Revenue reversal + COGS reversal
12. PostSR (BEFORE_INVOICE): creates RETURN_IN + COGS reversal only (no Revenue)
13. returnQty validation enforced
14. SO line returnedQty updated
15. SI outstandingAmount adjusted on return
