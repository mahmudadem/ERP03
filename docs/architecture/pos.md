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
                             CompletePosReturnUseCase, CompletePosExchangeUseCase,
                             PosReportingUseCases
                             (Z, Daily, Payment, Cashier, Over/Short, ReceiptHistory,
                             OverrideAudit).
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

## 3. POS_DIRECT_SALE posting path

POS is a standalone application over System Core engines. A completed sale is a `POS_DIRECT_SALE` operational document and does not call Sales application use cases or depend on the Sales App being enabled.

`CompletePosSaleUseCase` validates the open shift, cashier, POS policy, register, tender rows, change, cash rounding, and receipt number. It then calls `PostPosSaleUseCase`, which uses shared engines directly:

- `IInventoryCore.processOUT` for stock items.
- `ITaxEngine` for line tax math.
- `IAccountingBridge.recordFinancialEvent` for revenue, COGS, settlement, and cash rounding events.
- `IPolicyEngine` for POS direct-sale permission.
- `INumberingEngine` for receipt numbering.
- `IAuditEngine` for receipt audit.

POS identity is preserved in stock movement refs and ledger metadata:

- stock OUT refs use `POS_DIRECT_SALE`.
- POS return stock IN refs use `POS_RETURN`.
- accounting metadata uses `sourceModule: 'pos'`, `sourceType: 'POS_SALE' | 'POS_RETURN'`, and `documentPersona: 'POS_DIRECT_SALE'`.

Settlement accounts are resolved from the active register, not from company-level POS Settings:

- `CASH` uses `PosRegister.cashDrawerAccountId`.
- `CARD`, `BANK_TRANSFER`, and `CUSTOM` use `PosRegister.settlementAccountIds[method]`.
- Missing non-cash register settlement accounts block the sale before receipt/document posting.
- Registers also carry `defaultPriceListId`, `allowedCashierUserIds`, and `hardwareProfileId`. `allowedCashierUserIds` is enforced when opening a shift; an empty list means any cashier with POS access can use the register. `defaultPriceListId` and `hardwareProfileId` are persisted placeholders for the next pricing/hardware integration slices.
- Held carts are stored as `PosHeldCart` records with `HELD`, `RECALLED`, or `CANCELLED` status. A held cart captures the current register, shift, cashier, customer, line snapshots, and current totals, but it does not reserve stock, consume receipt numbers, create payments, or post accounting. Recall changes the held record to `RECALLED` and restores the cart on the terminal; cancel changes it to `CANCELLED`.

Line removal is audit-preserving. The terminal marks removed cart lines as `VOIDED` with cashier, timestamp, and reason. `CompletePosSaleUseCase` posts only active lines and appends voided snapshots to the persisted receipt; return validation filters them out so a removed line cannot later be refunded.

Posted receipt cancellation is implemented as a financial reversal, not a status-only edit. `VoidPosReceiptUseCase` builds a return for all remaining active receipt quantities, calls the same POS-owned return path, and marks the original receipt `VOIDED` inside the transaction after the return is persisted. `CompletePosReturnUseCase` subtracts prior POS returns from the receipt's sold quantity before validating new returns, preventing duplicate refunds or duplicate stock reversals.

Exchange workflow is modeled as two normal POS documents linked by one `exchangeId`: a POS return for the item coming back and a POS direct sale for the replacement item. `CompletePosExchangeUseCase` orchestrates the two use cases and reports net due/refund for the cashier, but it does not create a new GL document type or merge the postings. This keeps stock-in, stock-out, revenue reversal, new revenue, COGS reversal, new COGS, tax, cash movement, and settlement audit on the same proven paths as standalone returns and sales. SQL deployments need a Prisma migration for `exchangeId` on `pos_receipts` and `pos_returns`.

Manager override policy is centralized through `IPolicyEngine` instead of page-only checks. `POSPolicy.cashierRolePolicies[].managerOverrideActions` can require approval for `VOID_LINE`, `PRICE_OVERRIDE`, `DISCOUNT_OVERRIDE`, `TAX_OVERRIDE`, `RETURN`, and `REPRINT`. Cashier role policies can also define numeric sale-line controls: `maxLineDiscountPercent`, `maxLineDiscountAmount`, `allowPriceOverride`, and `allowTaxOverride`. Sale completion evaluates voided lines, explicit price/tax override flags, manual discounts, and cashier role limits; return completion evaluates the `RETURN` hook. If a cashier role requires approval, the use case blocks unless the payload carries an approved manager override id. Receipt line snapshots persist discount type/value, price/tax override flags, void metadata, and manager override id so the POS override audit report can review the exception after posting. The current slice creates the backend enforcement point; a richer approval-capture UI is still a follow-up.

Shift close stores reconciliation by payment method. `PosShift` persists expected, counted, and variance totals for `CASH`, `CARD`, `BANK_TRANSFER`, and `CUSTOM`, plus `RECONCILED` status when every method balances. Cash variance still drives the over/short GL voucher; non-cash variance is stored for operational follow-up and does not auto-post because card/bank clearing needs a separate settlement process. SQL deployments need a Prisma migration for the new `pos_shifts` JSON/date columns.

Promotions are hard-disabled by default. `PostPosSaleUseCase` does not read promotion rules unless the explicit test hook opens the gate; production must keep flash sales, BXGY, coupons, free gifts, and auto-promotions disabled until stacking/cap/conflict/return rules are implemented.

### 3a. Cashier screen, bootstrap, and frontend data contract

- **Bootstrap (`GetPosBootstrapUseCase`)** hydrates the terminal in one call. The cashier screen calls it with only `cashierUserId` (no register picker), so the use case resolves the **active register itself**: an explicit `registerId` wins, else a lone `ACTIVE` register (else a lone register of any status). The open shift is then read for that register, with a fallback to the cashier's own open shift (whose register is hydrated if none was picked). Without this resolution the terminal wrongly shows "No open shift for this register."
- **`posApi` unwrap contract:** the global axios response interceptor (`setupErrorInterceptor`) already unwraps the `{ success, data }` envelope to the bare payload. Any per-module helper must therefore use the resilient `r?.data?.data ?? r?.data ?? r` form (falls through to the already-unwrapped value). A 2-level `r.data.data ?? r.data` form silently resolves to `undefined` and makes every read look "not persisted." All POS reads go through `ok()`, which uses the resilient form.
- **`PosTerminalPage`** is a product-grid + order-panel checkout (search/scan tiles → cart with qty steppers → totals → green Pay → React-state tender dialog driven by the enabled payment methods). It never posts directly — `previewSale` supplies the authoritative tax-inclusive quote and `completeSale` posts the POS direct sale. Items with a non-positive sale price are blocked from the cart. Removing a line opens a reason dialog and marks the line voided instead of deleting it from the sale audit trail.

## 4. Money / stock safety

- One OPEN shift per register (`OpenPosShiftUseCase` enforces; UI refuses to render when no open shift).
- Over/short voucher: only posted when variance ≠ 0; balanced Dr/Cr; missing over/short account blocks close with a readable error.
- CASH change is netted off the POS settlement (settlement total = receipt grand total).
- All POS money in/out is register-attributed: cash drawer, non-cash settlement accounts, sale cash movements, refunds, and shift close variance all carry the register context.
- `allowPosDirectSales` toggle writes POS policy and is the **only** way to let POS post direct sales. `workflowMode` is never touched.
- Cash math: `expectedCash = openingFloat + SALE_CASH − REFUND_CASH + PAYIN − PAYOUT − DROP`.

## 5. Tenant isolation

Every read is `(companyId, id)`-scoped. Settings is keyed on `companyId`. The `companyModuleGuard('pos')` runs at the tenant router mount before any of the POS routes.

POS Settings persists as a **full document** — `FirestorePosSettingsRepository.saveSettings` writes the complete entity (no `{ merge: true }`), so blanked optional fields (walk-in customer, cash over/short accounts, payment-method label) are actually cleared rather than retaining a previous value. The Settings page sends `''` (not `undefined`) for cleared fields so the clear survives JSON serialization and reaches the repository.

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
| Override Audit | API: `/tenant/pos/reports/override-audit` | pos.reports.view | `GetPosOverrideAuditReportUseCase` |
| Unsettled Costs (link) | `/inventory/reports/unsettled-costs` | pos.reports.view | (existing inventory report) |

All UI report pages use the shared `<ReportContainer>` and pass `check-reports.mjs`. The Payment Methods report aggregates stored `PosPayment` rows for the receipt set selected by date/register filters; CASH is reported net of `changeGiven` so it reconciles to settlement and drawer cash. The override audit report is currently an API/reporting-use-case surface for manager review; adding a dedicated `ReportContainer` UI page is a follow-up.

## 8. Testing

- **Domain entities** have constructor validation; `toJSON`/`fromJSON` are symmetric.
- **Use cases** are unit-tested with mock repos. POS tests live in `backend/src/tests/application/pos/`:
  - `PosSettingsUseCases.test.ts`
  - `PosShiftUseCases.test.ts` — 10 tests
  - `PostPosSale.test.ts`
  - `PostPosReturn.test.ts`
  - `CompletePosSale.test.ts`
  - `CompletePosReturn.test.ts`
  - `PolicyEnginePosPolicy.test.ts`
  - `PosProductSearchCommercialCore.test.ts`
  - `PosReporting.test.ts`
  - **71 focused POS tests, all green in Task 251 after slice 7.**
- **Architecture guards** assert POS imports no Sales application/domain internals, POS financial events go through `IAccountingBridge`, POS uses `ITaxEngine`, POS uses `INumberingEngine`, POS stock refs keep POS identity, and POS uses `IInventoryCore`.

## 9. Documentation

- [POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md) — the ADR that ruled out A/B in favor of C.
- [docs/user-guide/pos/setup.md](../user-guide/pos/setup.md) — owner-facing setup guide (Phase 0 + governance toggle).
- `planning/done/247a-pos-foundations.md` … `247e-pos-reports-and-docs.md` — phase completion reports with self-audit + manual QA scripts.
