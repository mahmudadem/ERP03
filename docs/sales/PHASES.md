# Sales Module — Phased Delivery Plan

> **Status:** DRAFT — Pending Review  
> **Prerequisite:** Purchase module Phases 0–3 complete (shared services exist)

---

## Phase 0 — Shared Services (COMPLETE ✅)

Already done during Purchase module implementation:
- [x] Party entity (CUSTOMER role supported)
- [x] TaxCode entity (SALES/BOTH scope supported)
- [x] Item extensions (defaultSalesTaxCodeId)
- [x] SharedController API + frontend pages

**Remaining for Sales:**
- [ ] Customer frontend pages (CustomersListPage, CustomerDetailPage)
- [ ] Item entity extension: `revenueAccountId`, `cogsAccountId` fields
- [ ] `ISalesInventoryService` implementation (`SalesInventoryService`)
- [ ] ReferenceType additions: `SALES_ORDER`, `DELIVERY_NOTE`, `SALES_RETURN`

---

## Phase 1 — Sales Orders + Settings (~3 days)

### Backend
- [ ] `SalesSettings` entity + repository + use cases
- [ ] `SalesOrder` entity + PO-style CRUD + lifecycle (confirm/cancel/close)
- [ ] `SalesModule` registration (mirrors `PurchaseModule`)
- [ ] `SalesController` + routes + DTOs + validators
- [ ] Document number generation

### Frontend  
- [ ] `salesApi.ts`
- [ ] `SalesHomePage` + initialization wizard
- [ ] `SalesOrdersListPage`
- [ ] `SalesOrderDetailPage`
- [ ] `SalesSettingsPage`
- [ ] Sidebar/menu registration

### Verification
- [ ] `npx tsc --noEmit` → PASS
- [ ] `npm run build` → PASS
- [ ] Audit report: `AUDIT_PHASE_1.md`

---

## Phase 2 — Delivery Note + Sales Invoice Posting (~5 days)

> **Critical phase** — COGS is the key differentiator from Purchases.

### Backend
- [ ] `DeliveryNote` entity + repository
- [ ] `CreateDeliveryNoteUseCase` (pre-fill from SO)
- [ ] `PostDeliveryNoteUseCase` (stock OUT + COGS GL)
- [ ] `SalesInvoice` entity + repository
- [ ] `CreateSalesInvoiceUseCase` (pre-fill from SO)
- [ ] `PostSalesInvoiceUseCase` (Revenue GL + optional COGS for SIMPLE)
- [ ] `SalesInventoryService` implementation
- [ ] `SalesPostingHelpers` (shared utilities)
- [ ] Controller endpoints for DN + SI
- [ ] 10 posting tests

### Frontend
- [ ] `DeliveryNotesListPage` + `DeliveryNoteDetailPage`
- [ ] `SalesInvoicesListPage` + `SalesInvoiceDetailPage`
- [ ] SO detail: "Deliver Goods" + "Create Invoice" buttons

### Verification
- [ ] All 10 posting tests pass
- [ ] `npx tsc --noEmit` → PASS
- [ ] `npm run build` → PASS
- [ ] Audit report: `AUDIT_PHASE_2.md`

---

## Phase 3 — Returns + Dashboard + Polish (~3 days)

### Backend
- [ ] `SalesReturn` entity + repository
- [ ] `CreateSalesReturnUseCase` (pre-fill from SI or DN)
- [ ] `PostSalesReturnUseCase` (AFTER_INVOICE: Revenue + COGS reversal; BEFORE_INVOICE: COGS reversal only)
- [ ] `UpdateSalesInvoicePaymentStatusUseCase`
- [ ] Controller endpoints for SR + payment sync
- [ ] 5 return tests

### Frontend
- [ ] `SalesReturnsListPage` + `SalesReturnDetailPage`
- [ ] SI detail: "Create Return" + "Create Receipt" buttons
- [ ] DN detail: "Create Return" button (CONTROLLED)
- [ ] SO detail: linked documents view
- [ ] Dashboard KPIs (revenue, outstanding AR, top customers)
- [ ] Sidebar finalization

### Verification
- [ ] All 15 tests pass
- [ ] `npx tsc --noEmit` → PASS
- [ ] `npm run build` → PASS
- [ ] Audit report: `AUDIT_PHASE_3.md`

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| 0 | Done | Shared services |
| 1 | ~3 days | SO + Settings |
| 2 | ~5 days | DN + SI + COGS posting |
| 3 | ~3 days | Returns + Polish |
| **Total** | **~11 days** | **Full Sales Module** |

---

## Architecture Notes

- Module mount: `SalesModule.ts` under `backend/src/modules/sales/`
- Routes: `/tenant/sales/*` (consistent with purchase module)
- Frontend: `frontend/src/modules/sales/pages/`
- API: `frontend/src/api/salesApi.ts`
- Domain: `backend/src/domain/sales/entities/`
- Use cases: `backend/src/application/sales/use-cases/`
- Repository pattern: same as purchases
