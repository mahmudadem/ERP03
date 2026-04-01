# Purchase Module — Phased Delivery Plan

> **Status:** DRAFT — Pending Review  
> **Prerequisites:** Read [MASTER_PLAN.md](./MASTER_PLAN.md), [SCHEMAS.md](./SCHEMAS.md), [ALGORITHMS.md](./ALGORITHMS.md)

---

## Phase 0 — Shared Services (≈ 3 days)

### Scope
Create the shared `Party` and `TaxCode` entities, repositories, use cases, API endpoints, and frontend pages. These are prerequisites for both Purchases AND future Sales.

### 0.1 Domain Entities

| Entity | File | Status |
|--------|------|--------|
| `Party` | `domain/shared/entities/Party.ts` | NEW |
| `TaxCode` | `domain/shared/entities/TaxCode.ts` | NEW |

### 0.2 Repository Interfaces

| Repository | File | Status |
|-----------|------|--------|
| `IPartyRepository` | `repository/interfaces/shared/IPartyRepository.ts` | NEW |
| `ITaxCodeRepository` | `repository/interfaces/shared/ITaxCodeRepository.ts` | NEW |

### 0.3 Firestore Implementations

| File | Status |
|------|--------|
| `infrastructure/firestore/repositories/shared/FirestorePartyRepository.ts` | NEW |
| `infrastructure/firestore/repositories/shared/FirestoreTaxCodeRepository.ts` | NEW |

### 0.4 Use Cases

| Use Case | File | Description |
|----------|------|-------------|
| `CreatePartyUseCase` | `application/shared/use-cases/PartyUseCases.ts` | NEW: validate code uniqueness, role validation |
| `UpdatePartyUseCase` | Same file | NEW |
| `ListPartiesUseCase` | Same file | NEW: filter by role, active |
| `GetPartyUseCase` | Same file | NEW |
| `CreateTaxCodeUseCase` | `application/shared/use-cases/TaxCodeUseCases.ts` | NEW: validate code uniqueness, rate consistency |
| `UpdateTaxCodeUseCase` | Same file | NEW |
| `ListTaxCodesUseCase` | Same file | NEW: filter by scope, active |

### 0.5 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/shared/parties` | Create party |
| GET | `/api/shared/parties` | List parties (filter: role, active) |
| GET | `/api/shared/parties/:id` | Get party |
| PUT | `/api/shared/parties/:id` | Update party |
| POST | `/api/shared/tax-codes` | Create tax code |
| GET | `/api/shared/tax-codes` | List tax codes (filter: scope, active) |
| GET | `/api/shared/tax-codes/:id` | Get tax code |
| PUT | `/api/shared/tax-codes/:id` | Update tax code |

### 0.6 Frontend Pages

| Page | File | Description |
|------|------|-------------|
| Vendors List | `modules/purchases/pages/VendorsListPage.tsx` | NEW: CRUD for parties with VENDOR role |
| Vendor Detail | `modules/purchases/pages/VendorDetailPage.tsx` | NEW: tabbed form (General, Commercial, Accounting) |
| Tax Codes | `modules/settings/pages/TaxCodesPage.tsx` | NEW: manage tax codes (shared settings area) |

### 0.7 Item Entity Extension

| File | Change |
|------|--------|
| `domain/inventory/entities/Item.ts` | ADD `defaultPurchaseTaxCodeId?: string` and `defaultSalesTaxCodeId?: string` |
| `api/inventoryApi.ts` (frontend) | ADD the two new fields to `InventoryItemDTO` |
| `ItemDetailPage.tsx` | ADD tax code dropdowns to the Cost tab |

### 0.8 Acceptance Criteria
- [ ] Party CRUD works — create vendor, list vendors, update vendor
- [ ] TaxCode CRUD works — create VAT 18%, list by scope
- [ ] Item can be assigned default purchase/sales tax codes
- [ ] `npx tsc --noEmit` PASS (backend)
- [ ] `npm run build` PASS (frontend)

---

## Phase 1 — Purchase Orders (≈ 4 days)

### Scope
PO creation, confirmation, status tracking, and cancellation. No inventory or accounting effects.

### 1.1 Domain Entities

| Entity | File | Status |
|--------|------|--------|
| `PurchaseSettings` | `domain/purchases/entities/PurchaseSettings.ts` | NEW |
| `PurchaseOrder` | `domain/purchases/entities/PurchaseOrder.ts` | NEW |

### 1.2 Repository Interfaces

| Repository | File | Status |
|-----------|------|--------|
| `IPurchaseSettingsRepository` | `repository/interfaces/purchases/IPurchaseSettingsRepository.ts` | NEW |
| `IPurchaseOrderRepository` | `repository/interfaces/purchases/IPurchaseOrderRepository.ts` | NEW |

### 1.3 Firestore Implementations

| File | Status |
|------|--------|
| `infrastructure/firestore/repositories/purchases/FirestorePurchaseSettingsRepository.ts` | NEW |
| `infrastructure/firestore/repositories/purchases/FirestorePurchaseOrderRepository.ts` | NEW |

### 1.4 Use Cases

| Use Case | File | Description |
|----------|------|-------------|
| `InitializePurchasesUseCase` | `application/purchases/use-cases/PurchaseSettingsUseCases.ts` | NEW: create default settings + assign AP account |
| `GetPurchaseSettingsUseCase` | Same file | NEW |
| `UpdatePurchaseSettingsUseCase` | Same file | NEW |
| `CreatePurchaseOrderUseCase` | `application/purchases/use-cases/PurchaseOrderUseCases.ts` | NEW: validate vendor, generate number, apply tax defaults |
| `UpdatePurchaseOrderUseCase` | Same file | NEW: draft-only edits |
| `ConfirmPurchaseOrderUseCase` | Same file | NEW: DRAFT → CONFIRMED |
| `CancelPurchaseOrderUseCase` | Same file | NEW: validate no receipts/invoices exist |
| `ClosePurchaseOrderUseCase` | Same file | NEW: cancel remaining qty |
| `ListPurchaseOrdersUseCase` | Same file | NEW: filter by status, vendor, date |
| `GetPurchaseOrderUseCase` | Same file | NEW |

### 1.5 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/purchases/initialize` | Initialize module |
| GET | `/api/purchases/settings` | Get settings |
| PUT | `/api/purchases/settings` | Update settings |
| POST | `/api/purchases/orders` | Create PO |
| GET | `/api/purchases/orders` | List POs |
| GET | `/api/purchases/orders/:id` | Get PO |
| PUT | `/api/purchases/orders/:id` | Update PO (draft) |
| POST | `/api/purchases/orders/:id/confirm` | Confirm PO |
| POST | `/api/purchases/orders/:id/cancel` | Cancel PO |
| POST | `/api/purchases/orders/:id/close` | Close PO |

### 1.6 Frontend Pages

| Page | File | Description |
|------|------|-------------|
| Purchase Home | `modules/purchases/pages/PurchaseHomePage.tsx` | REWRITE: initialization wizard + dashboard |
| PO List | `modules/purchases/pages/PurchaseOrdersListPage.tsx` | NEW |
| PO Detail | `modules/purchases/pages/PurchaseOrderDetailPage.tsx` | NEW: line items, totals, status badge, confirm/cancel buttons |
| Purchase Settings | `modules/purchases/pages/PurchaseSettingsPage.tsx` | NEW: procurement mode + defaults |

### 1.7 Acceptance Criteria
- [ ] PO CRUD with line items and tax defaults
- [ ] PO confirmation and cancellation
- [ ] Document numbering (PO-00001)
- [ ] Multi-currency PO with exchange rate
- [ ] Settings page with procurement mode selector

---

## Phase 2 — Goods Receipt & Purchase Invoice (≈ 5 days)

### Scope
GRN posting with inventory effect. PI posting with accounting effect. Quantity tracking on PO lines. Both SIMPLE and CONTROLLED mode logic.

### 2.1 Domain Entities

| Entity | File | Status |
|--------|------|--------|
| `GoodsReceipt` | `domain/purchases/entities/GoodsReceipt.ts` | NEW |
| `PurchaseInvoice` | `domain/purchases/entities/PurchaseInvoice.ts` | NEW |

### 2.2 Repository Interfaces

| Repository | File | Status |
|-----------|------|--------|
| `IGoodsReceiptRepository` | `repository/interfaces/purchases/IGoodsReceiptRepository.ts` | NEW |
| `IPurchaseInvoiceRepository` | `repository/interfaces/purchases/IPurchaseInvoiceRepository.ts` | NEW |

### 2.3 Firestore Implementations

| File | Status |
|------|--------|
| `infrastructure/firestore/repositories/purchases/FirestoreGoodsReceiptRepository.ts` | NEW |
| `infrastructure/firestore/repositories/purchases/FirestorePurchaseInvoiceRepository.ts` | NEW |

### 2.4 Use Cases

| Use Case | File | Description |
|----------|------|-------------|
| `CreateGoodsReceiptUseCase` | `application/purchases/use-cases/GoodsReceiptUseCases.ts` | NEW: validate PO link, pre-fill from PO |
| `PostGoodsReceiptUseCase` | Same file | NEW: **Core** — inventory processIN, PO qty update, no GL |
| `ListGoodsReceiptsUseCase` | Same file | NEW |
| `GetGoodsReceiptUseCase` | Same file | NEW |
| `CreatePurchaseInvoiceUseCase` | `application/purchases/use-cases/PurchaseInvoiceUseCases.ts` | NEW: pre-fill from PO, tax snapshot |
| `PostPurchaseInvoiceUseCase` | Same file | NEW: **Core** — qty validation, GL voucher, conditional inventory, AP |
| `ListPurchaseInvoicesUseCase` | Same file | NEW |
| `GetPurchaseInvoiceUseCase` | Same file | NEW |

### 2.5 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/purchases/goods-receipts` | Create GRN |
| GET | `/api/purchases/goods-receipts` | List GRNs |
| GET | `/api/purchases/goods-receipts/:id` | Get GRN |
| POST | `/api/purchases/goods-receipts/:id/post` | Post GRN |
| POST | `/api/purchases/invoices` | Create PI |
| GET | `/api/purchases/invoices` | List PIs |
| GET | `/api/purchases/invoices/:id` | Get PI |
| PUT | `/api/purchases/invoices/:id` | Update PI (draft) |
| POST | `/api/purchases/invoices/:id/post` | Post PI |

### 2.6 Frontend Pages

| Page | File | Description |
|------|------|-------------|
| GRN List | `modules/purchases/pages/GoodsReceiptsListPage.tsx` | NEW |
| GRN Detail | `modules/purchases/pages/GoodsReceiptDetailPage.tsx` | NEW: line items, warehouse, post button |
| PI List | `modules/purchases/pages/PurchaseInvoicesListPage.tsx` | NEW |
| PI Detail | `modules/purchases/pages/PurchaseInvoiceDetailPage.tsx` | NEW: line items, tax, totals, payment status, post button |

### 2.7 Tests

| Test | Description |
|------|-------------|
| GRN posting creates inventory movement | Post GRN → verify StockMovement created with `PURCHASE_RECEIPT` |
| GRN updates PO receivedQty | Post GRN → verify PO line `receivedQty` incremented |
| PI posting creates GL voucher | Post PI → verify voucher with Dr Inventory/Expense, Cr AP |
| PI CONTROLLED: block if not received | Stock item, no GRN → post PI → expect error |
| PI CONTROLLED: service skips GRN | Service item, no GRN → post PI → success |
| PI SIMPLE standalone: creates inventory + GL | Direct PI for stock item → verify both movement + voucher |
| PI SIMPLE PO-linked: respects orderedQty | Link to PO → try invoicing > ordered → expect error |
| Tax snapshot frozen at posting | Change tax rate after posting → verify posted line unchanged |
| Multi-currency PI | Foreign currency PI → verify base amounts correct |

### 2.8 Acceptance Criteria
- [ ] GRN posting creates `PURCHASE_RECEIPT` inventory movements
- [ ] PI posting creates GL voucher with correct debits/credits
- [ ] CONTROLLED mode: stock items require GRN before invoice
- [ ] CONTROLLED mode: services can be invoiced directly from PO
- [ ] SIMPLE mode: standalone PI works for all item types
- [ ] SIMPLE mode: PO-linked PI respects orderedQty
- [ ] Tax snapshot frozen at posting
- [ ] PO status auto-updates after GRN/PI posting
- [ ] Payment status tracking on PI

---

## Phase 3 — Purchase Returns & Polish (≈ 3 days)

### Scope
Purchase Return (both AFTER_INVOICE and BEFORE_INVOICE contexts), "Create Payment" integration, sidebar navigation, and dashboard.

### 3.1 Domain Entities

| Entity | File | Status |
|--------|------|--------|
| `PurchaseReturn` | `domain/purchases/entities/PurchaseReturn.ts` | NEW |

### 3.2 Repository & Firestore

| File | Status |
|------|--------|
| `repository/interfaces/purchases/IPurchaseReturnRepository.ts` | NEW |
| `infrastructure/firestore/repositories/purchases/FirestorePurchaseReturnRepository.ts` | NEW |

### 3.3 Use Cases

| Use Case | File | Description |
|----------|------|-------------|
| `CreatePurchaseReturnUseCase` | `application/purchases/use-cases/PurchaseReturnUseCases.ts` | NEW: determine returnContext, pre-fill from PI/GRN |
| `PostPurchaseReturnUseCase` | Same file | NEW: inventory OUT, conditional GL, PO qty update |
| `ListPurchaseReturnsUseCase` | Same file | NEW |
| `GetPurchaseReturnUseCase` | Same file | NEW |

### 3.4 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/purchases/returns` | Create return |
| GET | `/api/purchases/returns` | List returns |
| GET | `/api/purchases/returns/:id` | Get return |
| POST | `/api/purchases/returns/:id/post` | Post return |

### 3.5 Frontend Pages

| Page | File | Description |
|------|------|-------------|
| PR List | `modules/purchases/pages/PurchaseReturnsListPage.tsx` | NEW |
| PR Detail | `modules/purchases/pages/PurchaseReturnDetailPage.tsx` | NEW |

### 3.6 Integration & Polish

| Task | Description |
|------|-------------|
| **Sidebar Navigation** | Update `moduleMenuMap.ts` with all purchase pages |
| **"Create Payment" from PI** | Add button on PI detail that opens Accounting payment form pre-filled |
| **Payment Status Sync** | Add `updateInvoicePaymentStatus` hook called when Accounting posts a payment referencing a PI |
| **Purchase Dashboard** | KPIs: open POs count, pending GRNs, unpaid invoices, overdue invoices |
| **PO Detail Actions** | "Receive Goods" and "Create Invoice" buttons on PO detail page |
| **Document Links** | Show related GRNs, PIs, PRs on PO detail; show related PO, GRN on PI detail |

### 3.7 Tests

| Test | Description |
|------|-------------|
| PR AFTER_INVOICE: stock + GL reversal | Return after posted PI → verify OUT movement + Dr AP, Cr Inventory |
| PR BEFORE_INVOICE: stock only, no GL | Return after GRN, before PI → verify OUT movement, no voucher |
| PR BEFORE_INVOICE: reduces PO receivedQty | Return → verify PO line receivedQty decremented |
| PR qty validation | Return more than invoiced/received → expect error |
| Create Payment flow | Click "Create Payment" on PI → verify navigation to Accounting payment form |

### 3.8 Acceptance Criteria
- [ ] AFTER_INVOICE return: creates inventory OUT + GL voucher
- [ ] BEFORE_INVOICE return: creates inventory OUT only, no GL
- [ ] Return qty cannot exceed invoiced/received qty
- [ ] PO line `returnedQty` and `receivedQty` updated correctly
- [ ] Sidebar shows all purchase pages grouped logically
- [ ] "Create Payment" from PI screen works
- [ ] Dashboard shows open POs, pending receipts, unpaid/overdue invoices

---

## Phase Summary

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 0** | ~3 days | Shared Party + TaxCode, Item tax extensions |
| **Phase 1** | ~4 days | PO CRUD, settings, initialization wizard |
| **Phase 2** | ~5 days | GRN + PI posting with full SIMPLE/CONTROLLED logic |
| **Phase 3** | ~3 days | Purchase Return, payment integration, dashboard, polish |
| **Total** | **~15 days** | Complete Purchase module V1 |

---

## Test Plan Summary

### Unit Tests
| Area | Count Est. | Priority |
|------|-----------|----------|
| Party entity validation | ~5 | P0 |
| TaxCode entity validation | ~5 | P0 |
| PO status machine | ~8 | P0 |
| PI quantity validation (all mode × type combos) | ~12 | P0 |
| GL account resolution | ~6 | P0 |
| Tax snapshot freeze | ~4 | P0 |
| PR return context determination | ~4 | P0 |

### Integration Tests
| Scenario | Phase | Priority |
|----------|-------|----------|
| Full CONTROLLED flow: PO → GRN → PI → verify inventory + GL | 2 | P0 |
| Full SIMPLE flow: standalone PI → verify inventory + GL | 2 | P0 |
| Partial receipt + partial invoice → PO status tracking | 2 | P0 |
| Multi-currency PI with FX rate → base amounts correct | 2 | P0 |
| Return AFTER_INVOICE → inventory + GL reversal | 3 | P0 |
| Return BEFORE_INVOICE → inventory only, PO qty adjusted | 3 | P0 |
| Payment status sync → PI outstanding updated | 3 | P1 |

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Accounting voucher creation API not standardized | 🟡 | Define a clean `createAccountingVoucher()` service interface; implement against existing voucher system |
| Transaction size for PI with many lines | 🟡 | Batch ≤500 writes per Firestore txn; warn in UI |
| Existing Item entity changes break Inventory | 🟡 | New fields are optional (`defaultPurchaseTaxCodeId`); no breaking change |
| Payment status sync requires Accounting callback | 🟡 | Define interface; Accounting posts payment → calls `updateInvoicePaymentStatus` |
| UoM conversion on GRN/PI lines | 🟡 | Reuse existing `convertToBaseUom` from Inventory module |
