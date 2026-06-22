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
                             TopSellingItems, OverrideAudit).
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
                                                PosTopSellingItemsReportPage, PosOverrideAuditReportPage,
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

Exchange workflow is modeled as two normal POS documents linked by one `exchangeId`: a POS return for the item coming back and a POS direct sale for the replacement item. `CompletePosExchangeUseCase` orchestrates the two use cases and reports net due/refund for the cashier, but it does not create a new GL document type or merge the postings. This keeps stock-in, stock-out, revenue reversal, new revenue, COGS reversal, new COGS, tax, cash movement, and settlement audit on the same proven paths as standalone returns and sales. The cashier-facing exchange mode on `PosReturnPage` collects returned receipt lines, replacement POS item lines, payment method/reference, and posts through `/tenant/pos/exchanges`; it does not calculate or persist accounting itself. SQL deployments need a Prisma migration for `exchangeId` on `pos_receipts` and `pos_returns`.

Manager override policy is centralized through `IPolicyEngine` instead of page-only checks. `POSPolicy.cashierRolePolicies[].managerOverrideActions` can require approval for `VOID_LINE`, `PRICE_OVERRIDE`, `DISCOUNT_OVERRIDE`, `TAX_OVERRIDE`, `RETURN`, and `REPRINT`. Cashier role policies can also define numeric sale-line controls: `maxLineDiscountPercent`, `maxLineDiscountAmount`, `allowPriceOverride`, and `allowTaxOverride`. Sale completion evaluates voided lines, explicit price/tax override flags, manual discounts, and cashier role limits; return completion evaluates the `RETURN` hook. If a cashier role requires approval, the use case blocks unless the payload carries an approved manager override id. Receipt line snapshots persist discount type/value, price/tax override flags, void metadata, and manager override id so the POS override audit report can review the exception after posting.

Cashier-facing manager approval capture is intentionally small and auditable. `/tenant/pos/manager-overrides` creates a `mgr_override_*` id through `CreatePosManagerOverrideUseCase` and records a `POS_MANAGER_OVERRIDE` audit entry containing the cashier, selected manager, action, reason, and context. The terminal can attach that id to voided lines and active sale lines before completion; the returns page can attach it to returns and exchanges. Exchange orchestration forwards the same override id to both the POS return leg and replacement POS sale leg. This capture flow records approval identity and reason; it does not authenticate a manager PIN/password yet, so a stronger credential challenge remains a future security-hardening slice.

Shift close stores reconciliation by payment method. `PosShift` persists expected, counted, and variance totals for `CASH`, `CARD`, `BANK_TRANSFER`, and `CUSTOM`, plus `RECONCILED` status when every method balances. Cash variance still drives the over/short GL voucher; non-cash variance is stored for operational follow-up and does not auto-post because card/bank clearing needs a separate settlement process. SQL deployments need a Prisma migration for the new `pos_shifts` JSON/date columns.

Promotions are hard-disabled by default. `PostPosSaleUseCase` does not read promotion rules unless the explicit test hook opens the gate; production must keep flash sales, BXGY, coupons, free gifts, and auto-promotions disabled until stacking/cap/conflict/return rules are implemented.

Item selling-policy guards run in `PostPosSaleUseCase`, not only in the terminal UI. Inactive items are blocked before stock, receipt, payment, or ledger writes. Migration-free POS metadata flags are also honored: `metadata.pos.enabled === false` and `metadata.pos.blocked === true` block sale; `metadata.pos.discountable === false` blocks manual and promotion discounts. Expired items are blocked when `metadata.pos.expiryDate`, `expirationDate`, or `expiresOn` is before the POS sale date. Items marked `expiryTracked` without a concrete selected expiry, `requiresBatch` / `batchRequired` / `requiresLot` / `lotRequired`, or `requiresSerial` / `serialRequired` / `serialized` are also blocked because POS sale lines do not yet capture batch, lot, or serial identity. Because exchange replacement sales use the same POS sale use case, exchanges inherit the same guards.

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

### 4a. POS-specific negative-stock policy

The company-wide `InventorySettings.allowNegativeStock` flag governs every stock OUT inside `RecordStockMovementUseCase` (throwing `NegativeStockError` when off). That flag is correct for back-office, invoice-driven sales — where invoicing ahead of a goods receipt is legitimate — but a POS sale is a physical hand-over at the till, so it must be able to refuse overselling **even when the company allows negative stock**.

`PosSettings.negativeStockPolicy` (`BLOCK` | `ALLOW`, default **`BLOCK`**) is that independent control:

- **`BLOCK`** — `PostPosSaleUseCase.assertNegativeStockAllowed` pre-fetches the selling-warehouse level (`IInventoryCore.preFetchStockLevel`) for every tracked line, aggregates requested quantity per (item, warehouse) — so a manual line plus a promotion free-good of the same item are checked together — and throws `NegativeStockError` if the result would fall below zero. The check runs **before any stock or ledger write** and also on the **dry-run preview**, so the terminal blocks before the cashier tenders.
- **`ALLOW`** — POS adds no extra block and defers to the company flag enforced inside the inventory OUT.

POS can therefore only be the **same as or stricter than** the company flag, never looser. The policy is threaded from `CompletePosSaleUseCase` into both the preview and the real post; `PostPosSaleUseCase` treats an absent policy as `ALLOW` so its use-case contract stays backward compatible (the safe `BLOCK` default lives in `PosSettings`). "Allow with manager approval" is a reserved future value that will land with the Approval-Engine override work (Task 257) — the Policy Engine decides *whether* approval is required, the Approval Engine *who* approves.

## 5. Tenant isolation

Every read is `(companyId, id)`-scoped. Settings is keyed on `companyId`. The `companyModuleGuard('pos')` runs at the tenant router mount before any of the POS routes.

POS Settings persists as a **full document** — `FirestorePosSettingsRepository.saveSettings` writes the complete entity (no `{ merge: true }`), so blanked optional fields (walk-in customer, cash over/short accounts, payment-method label) are actually cleared rather than retaining a previous value. The Settings page sends `''` (not `undefined`) for cleared fields so the clear survives JSON serialization and reaches the repository.

## 6. Permissions (full set, in `PermissionCatalog.ts`)

```
pos.terminal.access  Access POS Terminal (sell)
pos.shift.open       Open POS Shift
pos.shift.close      Close own POS Shift
pos.shift.forceClose Force-close any POS Shift (manager)
pos.override.approve Approve POS manager overrides (manager)
pos.cash.movement    Record POS Cash Movement
pos.return.create    Process POS Returns
pos.receipt.reprint  Reprint POS Receipts
pos.registers.manage Manage POS Registers
pos.settings.manage  Manage POS Settings
pos.reports.view     View POS Reports
```

## 6a. Manager-override approval seam (Policy Engine vs Approval Engine)

Sensitive POS actions — void a paid line, price/discount/tax override, return, reprint —
can require a manager's approval. Two engines split the decision:

- **Policy Engine decides *whether* approval is required.** `IPolicyEngine.resolve(scope:'pos',
  action:'managerOverride' | 'saleLineControls')` reads `CashierRolePolicy.managerOverrideActions`
  / discount-and-override limits and answers "does this action need a manager?" plus "is an
  approval token present?".
- **Approval Engine decides *who* may approve and the outcome.** `CreatePosManagerOverrideUseCase`
  routes the action through `IApprovalEngine.evaluate(...)` using the reserved subject types
  (`pos_manager_override`, `price_override`, `discount_override`, `tax_override`).
  `PosManagerOverrideApprovalPlugin` returns:
  - **PENDING** — approval required but no approver yet,
  - **REJECTED** — the approver is the acting cashier (no self-approval), or the approver does
    not hold `pos.override.approve` authority (verified server-side via the RBAC permission
    resolver, **not** a client token),
  - **APPROVED** — a distinct, authorised manager.

  The `approvedOverrideId` token is **only minted on APPROVED** and is what the Policy Engine
  later checks at sale/return/reprint time. This replaces the previous trust-the-screen gate
  (token presence) with a real workflow. `below_cost_sale` continues to route through the
  Approval Engine unchanged (it has no plugin and keeps the generic `requiresApproval → PENDING`
  fallback). See [Task 257](../../planning/tasks/257-pos-manager-override-via-approval-engine.md).

## 7. Reports (10 POS + 1 link)

| Report | Route | Permission | Source use case |
|---|---|---|---|
| Z Report (by shift) | `/pos/reports/z` | pos.reports.view | `GetPosZReportUseCase` |
| Daily Summary | `/pos/reports/daily` | pos.reports.view | `GetDailyPosSummaryUseCase` |
| Payment Methods | `/pos/reports/payments` | pos.reports.view | `GetPaymentMethodSummaryUseCase` |
| Cashier Sales | `/pos/reports/cashiers` | pos.reports.view | `GetCashierSalesSummaryUseCase` |
| Cash Over/Short | `/pos/reports/over-short` | pos.reports.view | `GetCashOverShortReportUseCase` |
| Receipt History | `/pos/reports/receipts` | pos.reports.view | `GetReceiptHistoryUseCase` |
| Cancelled Receipts | `/pos/reports/cancelled-receipts` | pos.reports.view | `GetCancelledReceiptsUseCase` |
| Top Selling Items | `/pos/reports/top-selling-items` | pos.reports.view | `GetTopSellingItemsUseCase` |
| Override Audit | `/pos/reports/override-audit` | pos.reports.view | `GetPosOverrideAuditReportUseCase` |
| Reprint Audit | `/pos/reports/reprint-audit` | pos.reports.view | `GetPosReprintAuditReportUseCase` |
| Unsettled Costs (link) | `/inventory/reports/unsettled-costs` | pos.reports.view | (existing inventory report) |

All UI report pages use the shared `<ReportContainer>` and pass `check-reports.mjs`. The Payment Methods report aggregates stored `PosPayment` rows for the receipt set selected by date/register filters; CASH is reported net of `changeGiven` so it reconciles to settlement and drawer cash. Cancelled Receipts lists posted POS receipts whose status is `VOIDED` after reversal through `VoidPosReceiptUseCase`; it does not mark receipts voided directly. Top Selling Items ranks gross completed receipt lines by item and excludes voided lines; it does not net later returns. The Override Audit page exposes voided lines, manual discounts, price overrides, and tax overrides for manager review. The Reprint Audit page reads `POS_RECEIPT` record-change rows created by `ReprintPosReceiptUseCase` and shows duplicate receipt-copy events.

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
  - `ReprintPosReceiptUseCase.test.ts`
  - **Focused POS suites are green through Task 251 slice 13.**
- **Architecture guards** assert POS imports no Sales application/domain internals, POS financial events go through `IAccountingBridge`, POS uses `ITaxEngine`, POS uses `INumberingEngine`, POS stock refs keep POS identity, and POS uses `IInventoryCore`.

## 9. Documentation

- [POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md) — the ADR that ruled out A/B in favor of C.
- [docs/user-guide/pos/setup.md](../user-guide/pos/setup.md) — owner-facing setup guide (Phase 0 + governance toggle).
- `planning/done/247a-pos-foundations.md` … `247e-pos-reports-and-docs.md` — phase completion reports with self-audit + manual QA scripts.
