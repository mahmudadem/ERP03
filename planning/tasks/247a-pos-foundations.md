# Task 247a — POS Phase 0: Foundations & Cleanup

**Prereq:** Read [247-pos-module-epic.md](./247-pos-module-epic.md) §1–§5 fully.
**Branch:** `feat/247a-pos-foundations`
**Estimate:** 2–3 days
**Goal:** A company can configure POS (registers, payment-method accounts, walk-in customer, over/short accounts) and enable POS direct sales. No selling yet.

---

## Step 1 — Delete the dead stub

Remove (the module is unmounted and these are placeholders — confirmed):
- `backend/src/domain/pos/entities/POSOrder.ts`
- `backend/src/domain/pos/entities/POSShift.ts`
- `backend/src/application/pos/use-cases/PosUseCases.ts`
- `backend/src/api/controllers/pos/PosController.ts` (rewrite later)
- `backend/src/api/routes/pos.routes.ts` (rewrite in this phase)
- `frontend/src/modules/pos/STATUS.md` and `frontend/src/modules/pos/pages/PosHomePage.tsx`

Keep & rewrite (do not break DI imports): `backend/src/repository/interfaces/pos/`, `backend/src/infrastructure/firestore/repositories/pos/FirestorePOSRepositories.ts`, `backend/src/infrastructure/firestore/mappers/POSMappers.ts`, `backend/src/infrastructure/prisma/repositories/pos/Prisma*`. You will replace their contents in Step 3. Update the two `diContainer` getters (Step 4) in the same commit so the build never breaks.

> Build the backend after deletion to find every dangling import and fix it before continuing.

## Step 2 — Permissions

In `backend/src/config/PermissionCatalog.ts`, replace the `pos` module block (currently only `pos.terminal.access`) with:

```ts
{
  moduleId: 'pos',
  permissions: [
    { id: 'pos.terminal.access',  label: 'Access POS Terminal (sell)' },
    { id: 'pos.shift.open',       label: 'Open POS Shift' },
    { id: 'pos.shift.close',      label: 'Close own POS Shift' },
    { id: 'pos.shift.forceClose', label: 'Force-close any POS Shift (manager)' },
    { id: 'pos.cash.movement',    label: 'Record POS Cash Movement' },
    { id: 'pos.return.create',    label: 'Process POS Returns' },
    { id: 'pos.receipt.reprint',  label: 'Reprint POS Receipts' },
    { id: 'pos.registers.manage', label: 'Manage POS Registers' },
    { id: 'pos.settings.manage',  label: 'Manage POS Settings' },
    { id: 'pos.reports.view',     label: 'View POS Reports' },
  ]
}
```

Update `frontend/src/config/moduleMenuMap.ts` `pos` group (currently only Terminal). Add Settings + Registers now; Reports/Shift/Returns parents are added in later phases:

```ts
pos: {
  label: 'POS', icon: 'Monitor',
  items: [
    { label: 'Terminal',  path: '/pos',           permission: 'pos.terminal.access', icon: 'Calculator' },
    { label: 'Registers', path: '/pos/registers', permission: 'pos.registers.manage', icon: 'MonitorSmartphone' },
    { label: 'Settings',  path: '/pos/settings',  permission: 'pos.settings.manage',  icon: 'Settings' },
  ],
},
```

## Step 3 — Domain entities + repositories

Create under `backend/src/domain/pos/entities/` (pure classes, validation in constructor, `toJSON`/`static fromJSON` — copy style from `SalesSettings.ts`):

### `PosRegister.ts`
```
id, companyId, code, name, branchId?, warehouseId, cashDrawerAccountId,
status: 'ACTIVE'|'INACTIVE', createdAt, updatedAt
```
Validation: code/name/warehouseId/cashDrawerAccountId required.

### `PosSettings.ts` (company-scoped, one per company)
```
companyId,
requireOpenShift: boolean (default true),
walkInCustomerId?: string,
cashOverAccountId?: string,
cashShortAccountId?: string,
receiptPrefix: string (default 'R'),
receiptNextSeq: number (default 1),
cashRounding: 'none'|'nearest_05'|'nearest_1' (default 'none'),
allowPosDirectSales: boolean (default false),  // mirrors the governance rule (see Step 7)
paymentMethods: PosPaymentMethodConfig[]
```
`PosPaymentMethodConfig`: `{ code:'CASH'|'CARD'|'BANK_TRANSFER'|'CUSTOM', label, settlementAccountId, requiresReference:boolean, allowsChange:boolean, isEnabled:boolean }`.
Add `static createDefault(companyId)` returning `requireOpenShift:true`, a single enabled CASH method (settlementAccountId empty until configured), `allowsChange:true` for CASH only.

### `PosShift.ts`
```
id, companyId, registerId, cashierUserId,
status: 'OPEN'|'CLOSED'|'FORCE_CLOSED'|'CANCELLED',
openedAt, openingFloat,
closedAt?, expectedCash?, countedCash?, overShortAmount?, overShortVoucherId?,
createdAt, updatedAt
method isOpen(): status === 'OPEN'
```
(Receipt/payment/cash-movement entities are added in P1/P2 — do **not** create them here.)

### Repository interfaces — `backend/src/repository/interfaces/pos/`
Replace `IPosShiftRepository.ts`, `IPosOrderRepository.ts` (delete the order one) and add `IPosRegisterRepository.ts`, `IPosSettingsRepository.ts`. Update `index.ts` exports.

```ts
// IPosRegisterRepository.ts
export interface IPosRegisterRepository {
  create(reg: PosRegister, tx?: unknown): Promise<void>;
  update(reg: PosRegister, tx?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PosRegister | null>;
  list(companyId: string): Promise<PosRegister[]>;
}
// IPosSettingsRepository.ts
export interface IPosSettingsRepository {
  getSettings(companyId: string): Promise<PosSettings | null>;
  saveSettings(settings: PosSettings, tx?: unknown): Promise<void>;
}
// IPosShiftRepository.ts  (P1 will add more)
export interface IPosShiftRepository {
  create(shift: PosShift, tx?: unknown): Promise<void>;
  update(shift: PosShift, tx?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PosShift | null>;
  getOpenShiftForRegister(companyId: string, registerId: string): Promise<PosShift | null>;
  getOpenShiftForCashier(companyId: string, cashierUserId: string): Promise<PosShift | null>;
  list(companyId: string, filters?: { registerId?: string; status?: string; limit?: number }): Promise<PosShift[]>;
}
```

### Firestore impls + mapper
Rewrite `FirestorePOSRepositories.ts` to export `FirestorePosRegisterRepository`, `FirestorePosSettingsRepository`, `FirestorePosShiftRepository`. Collections: `companies/{companyId}/posRegisters/{id}`, `companies/{companyId}/posSettings/{companyId}` (single doc), `companies/{companyId}/posShifts/{id}`. `getOpenShiftForRegister` = query `where status==OPEN where registerId==…` limit 1. Update `POSMappers.ts`.

### Prisma impls
Update `PrismaPosShiftRepository.ts`, add `PrismaPosRegisterRepository.ts`/`PrismaPosSettingsRepository.ts`, and add models to `backend/prisma/schema.prisma` (`PosRegister`, `PosSettings`, `PosShift` with `companyId` indexes; JSON column for `paymentMethods`). Run `npx prisma generate`. (No data migration needed.) If SQL parity is heavy, you MAY throw `'SQL impl not yet available'` in the Prisma getter branch like `promotionRuleRepository` does (`bindRepositories.ts:702`) — but Firestore must be complete.

## Step 4 — DI wiring

In `backend/src/infrastructure/di/bindRepositories.ts` replace the POS section (~728–738) with getters for `posRegisterRepository`, `posSettingsRepository`, `posShiftRepository`, each `DB_TYPE === 'SQL' ? new Prisma…(getPrismaClient()) : new Firestore…(getDb())`. Update the top imports.

## Step 5 — Use cases (`backend/src/application/pos/use-cases/`)

Create `PosRegisterUseCases.ts` (`Create/Update/List/GetPosRegisterUseCase`) and `PosSettingsUseCases.ts` (`GetPosSettingsUseCase`, `UpdatePosSettingsUseCase`, `InitializePosUseCase`). Copy validation/return style from `SalesSettingsUseCases.ts`. `UpdatePosSettingsUseCase` validates that every enabled payment method has a `settlementAccountId` that exists (`accountRepository.getById`), and that `cashOverAccountId`/`cashShortAccountId` exist if set.

## Step 6 — Controller, routes, DTOs, validators, module mount

- `backend/src/api/dtos/PosDTOs.ts` — rewrite with `PosDTOMapper.toRegisterDTO/toSettingsDTO/toShiftDTO`.
- `backend/src/api/validators/pos.validators.ts` — new; `validateUpsertPosRegisterInput`, `validateUpdatePosSettingsInput` (copy `sales.validators.ts` style).
- `backend/src/api/controllers/pos/PosController.ts` — rewrite, thin, copying `SalesController` patterns: `getCompanyId/getUserId/getUserEmail`, methods `getSettings`, `updateSettings`, `initializePos`, `listRegisters`, `getRegister`, `createRegister`, `updateRegister`.
- `backend/src/api/routes/pos.routes.ts`:
```ts
const router = Router();
router.use(authMiddleware);
router.post('/initialize', PosController.initializePos);
router.get('/settings', permissionGuard('pos.settings.manage'), PosController.getSettings);
router.put('/settings', permissionGuard('pos.settings.manage'), PosController.updateSettings);
router.get('/registers', permissionGuard('pos.registers.manage'), PosController.listRegisters);
router.post('/registers', permissionGuard('pos.registers.manage'), PosController.createRegister);
router.get('/registers/:id', permissionGuard('pos.registers.manage'), PosController.getRegister);
router.put('/registers/:id', permissionGuard('pos.registers.manage'), PosController.updateRegister);
export default router;
```
(Use `permissionGuard('perm')` from `../middlewares/guards/permissionGuard` per-route, exactly as `inventory.routes.ts` does — NOT the old `permissionsMiddleware`. Confirmed signature: `permissionGuard(requiredPermission: string)`.)

> **Convention note:** other modules call `router.use(moduleInitializedGuard('<id>'))` after the `/initialize` + `/settings` GET, to block operational routes until the module is initialized for the company. For POS V1 this is **optional** — the entitlement check (`companyModuleGuard('pos')`) already runs at mount. If you add it, place it after the settings GET like sales/inventory do, and ensure `InitializePosUseCase` sets whatever flag `moduleInitializedGuard('pos')` reads. If unsure, omit it for V1 and rely on `companyModuleGuard`.
- `backend/src/modules/pos/PosModule.ts` — copy `SalesModule.ts`, `metadata.id='pos'`, `name='POS'`, return `posRoutes`.
- Register it in `backend/src/modules/index.ts` (`registry.register(new PosModule());`). This auto-mounts at `/tenant/pos`.

## Step 7 — "Allow POS direct sales" governance toggle

`UpdatePosSettingsUseCase`, when `allowPosDirectSales` flips true, must ensure `SalesSettings.governanceRules` contains `{ id, scope:'form', formType:'pos_sale', action:'allow', persona:'direct' }`; when false, remove it. Do this by reading `salesSettingsRepository.getSettings` and calling the existing sales update path (inject `ISalesSettingsRepository`; mutate `governanceRules`; `saveSettings`). Do NOT alter `workflowMode`. This is the ONLY supported way to let POS post direct invoices in OPERATIONAL companies.

## Step 8 — Frontend

- `frontend/src/api/posApi.ts` — `getSettings/updateSettings/initializePos/listRegisters/createRegister/updateRegister/getRegister` → `/tenant/pos/...` (copy `salesApi.ts` client usage).
- `frontend/src/modules/pos/pages/PosSettingsPage.tsx` — copy `SalesSettingsPage.tsx`. Sections: General (requireOpenShift, walk-in customer via `PartySelector role="CUSTOMER"`, receiptPrefix, cashRounding, **Allow POS direct sales** toggle), Payment Methods (rows: code, label, account via `PartyAccountSelector`/account picker, requiresReference, allowsChange, enabled), Cash Over/Short (two account pickers). Toast on save; ConfirmDialog when toggling Allow-direct.
- `frontend/src/modules/pos/pages/PosRegistersPage.tsx` — list + create/edit register (name, code, branchId text, `WarehouseSelector`, cash-drawer account picker, status). `OperationalListLayout` + `ConfirmDialog` + toast.
- Register routes `/pos/settings`, `/pos/registers` in the app router (same place other module routes are registered). Both pages accept `isWindow`.
- i18n: add `pos` namespace keys to `frontend/src/i18n/{en,ar,tr}/...` (sidebar labels + page strings).

## Acceptance criteria
- [ ] Backend builds; `PosModule` mounts at `/tenant/pos` (hit `GET /tenant/pos/settings`).
- [ ] Create a register linked to a warehouse + cash account; persists and lists.
- [ ] Configure CASH+CARD payment methods mapped to accounts; save validates account existence.
- [ ] Toggling "Allow POS direct sales" adds/removes the `pos_sale` governance rule in Sales settings (verify via `GET /tenant/sales/settings`).
- [ ] Walk-in customer selectable and saved.
- [ ] DoD §6 of the epic met (build/typecheck/tests/docs/report).

## Tests
- `backend/src/tests/application/pos/PosSettingsUseCases.test.ts`: enabled method missing account → throws; over/short account missing → throws; allow-direct toggle mutates governance rules.
