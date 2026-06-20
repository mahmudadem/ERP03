# POS Module — Technical Architecture (FINAL — all 5 phases shipped)

**Module namespace:** `pos`
**Branch:** `feat/247-pos-module` (5 incremental commits)
**Status:** ✅ All five phases (247a → 247e) shipped; all quality gates green; ready for CTO audit + owner testing.

---

## 1. Architecture

The POS module follows the project's **layered clean architecture** (see [POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md) for the rationale and the rejected alternatives).

```
domain/pos/entities/         PosRegister, PosSettings, PosShift, PosCashMovement,
                             PosReceipt, PosPayment, PosReturn — all pure classes
                             with toJSON/fromJSON and constructor validation.
repository/interfaces/pos/  IPosRegisterRepository, IPosSettingsRepository,
                             IPosShiftRepository, IPosCashMovementRepository,
                             IPosReceiptRepository, IPosPaymentRepository,
                             IPosReturnRepository.
infrastructure/firestore/   Firestore*Repository (one per entity, parity with Prisma).
infrastructure/prisma/       Prisma*Repository (one per entity, parity with Firestore).
application/pos/use-cases/   PosRegisterUseCases, PosSettingsUseCases,
                             PosShiftUseCases (Open/Close/ForceClose/CashMovement/
                             XReport), PosBootstrapUseCase, CompletePosSaleUseCase,
                             CompletePosReturnUseCase, PosReportingUseCases
                             (Z, Daily, Payment, Cashier, Over/Short, ReceiptHistory).
infrastructure/di/           bound in bindRepositories.ts via DB_TYPE branching.
api/dtos/PosDTOs.ts          PosDTOMapper + DTOs for every entity + reports.
api/validators/pos.validators.ts
api/controllers/pos/PosController.ts
api/routes/pos.routes.ts     permissionGuard('pos.X') per route.
modules/pos/PosModule.ts     registered in modules/index.ts (auto-mounts at /tenant/pos).
```

## 2. Frontend

```
frontend/src/api/posApi.ts                       typed axios client; every endpoint.
frontend/src/i18n/config.ts                      pos namespace registered for en/ar/tr.
frontend/src/locales/{en,ar,tr}/pos.json         full coverage of settings/registers/shift/
                                                terminal/return/report/sale/sale-* keys.
frontend/src/router/routes.config.ts            all 7 routes registered.
frontend/src/config/moduleMenuMap.ts            pos group with Reports parent.
frontend/src/modules/pos/pages/                 PosHomePage, PosSettingsPage, PosRegistersPage,
                                                PosShiftPage, PosTerminalPage, PosReturnPage,
                                                PosZReportPage, PosDailySummaryReportPage,
                                                PosPaymentMethodReportPage, PosCashierSalesReportPage,
                                                PosCashOverShortReportPage, PosReceiptHistoryReportPage,
                                                PosDateRangeInitiator.
```

## 3. The headline integration (Phase 2 — the heart of the module)

`CompletePosSaleUseCase` builds a `CreateSalesInvoiceInput` from the cart, with:

```
{
  companyId,
  customerId,
  invoiceDate: today,
  source: 'pos',
  formType: 'pos_sale',
  persona: 'direct',
  lines: [{ itemId, invoicedQty, unitPriceDoc, taxCodeId, warehouseId: register.warehouseId, ... }]
}
```

…and a `SettlementInput` (`CASH_FULL` for single-tender exact cash, `MULTI` for split/change). It then calls the existing `CreateAndPostSalesInvoiceUseCase` from `SalesInvoiceUseCases`. **No new posting, no new tax, no new COGS, no new inventory logic.** The Sales use case does what it always did, with a form-scoped governance rule `{ scope:'form', formType:'pos_sale', action:'allow', persona:'direct' }` flipped on by the `allowPosDirectSales` toggle in POS Settings.

Returns go through the same boundary via `CreateSalesReturnUseCase` + `PostSalesReturnUseCase` against the receipt's linked `salesInvoiceId` (`AFTER_INVOICE`).

## 4. Money / stock safety

- One OPEN shift per register (`OpenPosShiftUseCase` enforces; UI refuses to render when no open shift).
- Over/short voucher: only posted when variance ≠ 0; balanced Dr/Cr; missing over/short account blocks close with a readable error.
- `PersonaNotAllowedError` from Sales is surfaced as-is, never caught-and-converted.
- CASH change is netted off the SI settlement (settlement total = receipt grand total).
- `allowPosDirectSales` toggle is the **only** way to let POS post direct sales. `workflowMode` is never touched.
- Cash math: `expectedCash = openingFloat + SALE_CASH − REFUND_CASH + PAYIN − PAYOUT − DROP`.

## 5. Tenant isolation

Every read is `(companyId, id)`-scoped. Settings is keyed on `companyId`. The `companyModuleGuard('pos')` runs at the tenant router mount before any of the POS routes.

## 6. Permissions (full set, in `PermissionCatalog.ts`)

```
pos.terminal.access  Access POS Terminal (sell)
pos.shift.open       Open POS Shift
pos.shift.close      Close own POS Shift
pos.shift.forceClose Force-close any POS Shift (manager)
pos.cash.movement    Record POS Cash Movement
pos.return.create    Process POS Returns
pos.receipt.reprint  Reprint POS Receipts
pos.registers.manage Manage POS Registers
pos.settings.manage  Manage POS Settings
pos.reports.view     View POS Reports
```

## 7. Reports (6 POS + 1 link)

| Report | Route | Permission | Source use case |
|---|---|---|---|
| Z Report (by shift) | `/pos/reports/z` | pos.reports.view | `GetPosZReportUseCase` |
| Daily Summary | `/pos/reports/daily` | pos.reports.view | `GetDailyPosSummaryUseCase` |
| Payment Methods | `/pos/reports/payments` | pos.reports.view | `GetPaymentMethodSummaryUseCase` |
| Cashier Sales | `/pos/reports/cashiers` | pos.reports.view | `GetCashierSalesSummaryUseCase` |
| Cash Over/Short | `/pos/reports/over-short` | pos.reports.view | `GetCashOverShortReportUseCase` |
| Receipt History | `/pos/reports/receipts` | pos.reports.view | `GetReceiptHistoryUseCase` |
| Unsettled Costs (link) | `/inventory/reports/unsettled-costs` | pos.reports.view | (existing inventory report) |

All reports use the shared `<ReportContainer>` and pass `check-reports.mjs`.

## 8. Testing

- **Domain entities** have constructor validation; `toJSON`/`fromJSON` are symmetric.
- **Use cases** are unit-tested with mock repos. POS tests live in `backend/src/tests/application/pos/`:
  - `PosSettingsUseCases.test.ts` — 5 tests
  - `PosShiftUseCases.test.ts` — 10 tests
  - `CompletePosSale.test.ts` — 9 tests
  - `CompletePosReturn.test.ts` — 5 tests
  - `PosReporting.test.ts` — 4 tests
  - **33 focused POS tests, all green.**

## 9. Documentation

- [POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md) — the ADR that ruled out A/B in favor of C.
- [docs/user-guide/pos/setup.md](../user-guide/pos/setup.md) — owner-facing setup guide (Phase 0 + governance toggle).
- `planning/done/247a-pos-foundations.md` … `247e-pos-reports-and-docs.md` — phase completion reports with self-audit + manual QA scripts.
