# POS Module — Technical Architecture (Phase 0)

**Module namespace:** `pos`
**Phase:** 247a (foundations)
**Status:** Active development — this doc will be updated as each phase lands.
**Related:** [sales.md](./sales.md), [inventory.md](./inventory.md), [accounting.md](./accounting.md), [POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md)

## 1. Architecture

The POS module follows the project's **layered clean architecture** (see [POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md) for the rationale).

```
domain/pos/entities/         pure classes, no infra (PosRegister, PosSettings, PosShift)
repository/interfaces/pos/  IPosRegisterRepository, IPosSettingsRepository, IPosShiftRepository
infrastructure/firestore/   FirestorePosRegisterRepository, ...
infrastructure/prisma/       PrismaPosRegisterRepository, ...
application/pos/use-cases/   PosRegisterUseCases, PosSettingsUseCases, (P1+ shift / sale / return)
infrastructure/di/           bound in bindRepositories.ts
api/dtos/PosDTOs.ts          PosDTOMapper
api/validators/pos.validators.ts
api/controllers/pos/PosController.ts
api/routes/pos.routes.ts     permissionGuard('pos.X') per route
modules/pos/PosModule.ts     registered in modules/index.ts
```

## 2. Entities (Phase 0)

- `PosRegister` — `id, companyId, code, name, branchId?, warehouseId, cashDrawerAccountId, status (ACTIVE|INACTIVE)`. Every register is tied to a warehouse (inventory source) and a cash-drawer account (settlement side of cash sales).
- `PosSettings` — company-scoped: `requireOpenShift, walkInCustomerId, cashOverAccountId, cashShortAccountId, receiptPrefix, receiptNextSeq, cashRounding (none|nearest_05|nearest_1), allowPosDirectSales, paymentMethods[]`.
  - `PosPaymentMethodConfig` = `{ code: CASH|CARD|BANK_TRANSFER|CUSTOM, settlementAccountId, label?, requiresReference, allowsChange, isEnabled }`.
  - `static createDefault(companyId)` returns `requireOpenShift:true`, one CASH method, `allowsChange:true` for CASH only.
- `PosShift` — `id, companyId, registerId, cashierUserId, status (OPEN|CLOSED|FORCE_CLOSED|CANCELLED), openedAt, openingFloat, closedAt?, expectedCash?, countedCash?, overShortAmount?, overShortVoucherId?`. `isOpen()` derives from `status === 'OPEN'`.

## 3. Governance rule (the only way to enable POS direct sales)

`UpdatePosSettingsUseCase` keeps `SalesSettings.governanceRules` in sync with `allowPosDirectSales`:

- **Enable** ⇒ add `{ id:'pos_direct_sale_form_allow', scope:'form', formType:'pos_sale', action:'allow', persona:'direct' }`
- **Disable** ⇒ remove the same rule.

`workflowMode` is **never** mutated. The PersonaNotAllowedError path remains the canonical blocker; the toggle is the explicit, auditable, form-scoped override.

## 4. Money / stock safety (P0)

No money flows yet. The only thing Phase 0 enforces is that every enabled payment method has a settlement account that **exists** (`accountRepository.getById`), so P2's settlement mapping can resolve the account deterministically.

## 5. Tenant isolation

Every repo read is `(companyId, id)`-scoped. The settings repo keys on `companyId` directly. All cross-tenant guards are inherited from the standard `companyModuleGuard('pos')` at mount + `authMiddleware`.

## 6. Frontend stack

- `posApi` (typed `axios` client).
- `PosSettingsPage` uses the shared `ModuleSettingsLayout` (tabs: General / Payment Methods / Cash Over/Short), `PartySelector` (role="CUSTOMER"), `AccountSelector` (per-method), `ConfirmDialog` + `useConfirm`, `toast` on every result.
- `PosRegistersPage` uses `OperationalListLayout` (which wraps the standard `DataTable`), `WarehouseSelector`, `AccountSelector`, status toggle with `useConfirm`.
- Routes registered in `frontend/src/router/routes.config.ts`. Menu entries in `moduleMenuMap.ts`.
- i18n: new `pos` namespace in `en/ar/tr`, registered in `i18n/config.ts`.

## 7. What's coming in P1–P4

- P1 — Shift lifecycle + X report + over/short voucher via `SubledgerVoucherPostingService`.
- P2 — `CompletePosSaleUseCase` calls `CreateAndPostSalesInvoiceUseCase` with `persona:'direct', source:'pos', formType:'pos_sale'`. The receipt links to the SI; no new posting code.
- P3 — `CompletePosReturnUseCase` calls `CreateSalesReturnUseCase` + `PostSalesReturnUseCase` with `salesInvoiceId` from the receipt (AFTER_INVOICE). Cash refund via `PosCashMovement(REFUND_CASH)`.
- P4 — X/Z/daily/payment-method/cashier/over-short/receipt-history reports via `<ReportContainer>`, all under `pos` → `Reports`. Plus the final i18n sweep and full DoD docs.
