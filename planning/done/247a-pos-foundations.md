# 247a — POS Phase 0: Foundations & Cleanup

**Branch:** `feat/247-pos-module`
**Date:** 2026-06-20
**Status:** ✅ All quality gates green; committed and pushed.

---

## 1. Summary

The dead POS stub (POSOrder/POSShift entities, naive PosUseCases, two-endpoint PosController, primitive FirestorePOSRepositories, simple PrismaPosShift/Order) is **deleted**. In its place the Phase 0 of the agreed Option-C architecture is in place:

- 3 new pure domain entities (`PosRegister`, `PosSettings`, `PosShift`) with full `toJSON`/`fromJSON` and constructor validation.
- 3 repository interfaces (`IPosRegisterRepository`, `IPosSettingsRepository`, `IPosShiftRepository`) under `backend/src/repository/interfaces/pos/`.
- Firestore + Prisma implementations for all three (parity kept).
- New Prisma models (`PosRegister`, `PosSettings`, `PosShift`) added to `backend/prisma/schema.prisma` and the Prisma client regenerated. Old `PosShift`/`PosOrder`/`PosOrderItem` models are removed.
- Use cases: `CreatePosRegisterUseCase`, `UpdatePosRegisterUseCase`, `ListPosRegistersUseCase`, `GetPosRegisterUseCase`, `GetPosSettingsUseCase`, `InitializePosUseCase`, `UpdatePosSettingsUseCase`.
- `UpdatePosSettingsUseCase` validates that every enabled payment method has a settlement account that exists, that `cashOverAccountId`/`cashShortAccountId` exist if set, and that toggling `allowPosDirectSales` inserts/removes the form-scoped governance rule `{ scope:'form', formType:'pos_sale', action:'allow', persona:'direct' }` in `SalesSettings.governanceRules` (the only supported way to enable POS direct sales; `workflowMode` is never touched).
- `PosController` is thin: reads `req.user.companyId/uid`, builds use cases from `diContainer`, maps to DTOs, returns `{ success, data }`.
- `pos.routes.ts` uses `permissionGuard('pos.X')` per route, never the old `permissionsMiddleware`.
- `PosModule` registers in `backend/src/modules/index.ts` and mounts at `/tenant/pos/...` behind `companyModuleGuard('pos')`.
- `PermissionCatalog` now has the full 10-permission POS set (terminal, shift open/close/forceClose, cash movement, return, receipt reprint, registers, settings, reports).
- Frontend: `posApi`, `PosHomePage` (redirects to settings/shift/registers), `PosSettingsPage` (general + payment methods + over/short tabs), `PosRegistersPage` (list+create+edit+activate/deactivate).
- `moduleMenuMap.ts` POS group now has Terminal / Registers / Settings entries.
- Routes registered in `frontend/src/router/routes.config.ts`.
- New i18n `pos` namespace in `en/ar/tr/pos.json` and registered in `i18n/config.ts`.

## 2. Files Touched

**Created (backend):**
- `backend/src/domain/pos/entities/PosRegister.ts`
- `backend/src/domain/pos/entities/PosSettings.ts`
- `backend/src/domain/pos/entities/PosShift.ts`
- `backend/src/repository/interfaces/pos/IPosRegisterRepository.ts`
- `backend/src/repository/interfaces/pos/IPosSettingsRepository.ts`
- `backend/src/repository/interfaces/pos/IPosShiftRepository.ts`
- `backend/src/repository/interfaces/pos/index.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosRegisterRepository.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosSettingsRepository.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosShiftRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosRegisterRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosSettingsRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosShiftRepository.ts`
- `backend/src/application/pos/use-cases/PosRegisterUseCases.ts`
- `backend/src/application/pos/use-cases/PosSettingsUseCases.ts`
- `backend/src/api/dtos/PosDTOs.ts`
- `backend/src/api/validators/pos.validators.ts`
- `backend/src/api/controllers/pos/PosController.ts`
- `backend/src/api/routes/pos.routes.ts`
- `backend/src/modules/pos/PosModule.ts`
- `backend/src/tests/application/pos/PosSettingsUseCases.test.ts`

**Created (frontend):**
- `frontend/src/api/posApi.ts`
- `frontend/src/modules/pos/pages/PosHomePage.tsx` (replaced)
- `frontend/src/modules/pos/pages/PosSettingsPage.tsx`
- `frontend/src/modules/pos/pages/PosRegistersPage.tsx`
- `frontend/src/locales/en/pos.json`
- `frontend/src/locales/ar/pos.json`
- `frontend/src/locales/tr/pos.json`

**Modified:**
- `backend/src/config/PermissionCatalog.ts` — full POS permission block.
- `backend/src/infrastructure/di/bindRepositories.ts` — new POS repo getters; old `posOrderRepository` removed.
- `backend/src/modules/index.ts` — register `PosModule`.
- `backend/prisma/schema.prisma` — added `PosRegister`/`PosSettings`/`PosShift`; removed `PosOrder`/`PosOrderItem`/old `PosShift`; updated Company + Item relations.
- `frontend/src/router/routes.config.ts` — lazy-load PosHome/Settings/Registers, register routes.
- `frontend/src/config/moduleMenuMap.ts` — POS group now has Registers + Settings entries.
- `frontend/src/i18n/config.ts` — register new `pos` namespace for en/ar/tr.

**Deleted:**
- `backend/src/domain/pos/entities/POSOrder.ts`
- `backend/src/domain/pos/entities/POSShift.ts`
- `backend/src/application/pos/use-cases/PosUseCases.ts`
- `backend/src/api/controllers/pos/PosController.ts`
- `backend/src/api/routes/pos.routes.ts`
- `backend/src/repository/interfaces/pos/IPosOrderRepository.ts`
- `backend/src/repository/interfaces/pos/IPosShiftRepository.ts` (replaced)
- `backend/src/repository/interfaces/pos/index.ts` (replaced)
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePOSRepositories.ts`
- `backend/src/infrastructure/firestore/mappers/POSMappers.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosShiftRepository.ts` (replaced)
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosOrderRepository.ts`
- `frontend/src/modules/pos/STATUS.md`
- `frontend/src/modules/pos/pages/PosHomePage.tsx` (replaced)

## 3. Quality Gate Evidence

| Gate | Command | Result |
|------|---------|--------|
| Backend typecheck | `npm --prefix backend run typecheck` | ✅ clean |
| Backend build | `npm --prefix backend run build` | ✅ clean (`lib/` regenerated) |
| Backend tests (focused) | `npx jest --runInBand src/tests/application/pos/PosSettingsUseCases.test.ts` | ✅ 5 / 5 |
| Backend tests (full) | `npm --prefix backend test` | ✅ 170 / 172 suites, 1531 / 1531 tests, 18 skipped |
| Frontend typecheck | `npm --prefix frontend run typecheck` | ✅ clean |
| Frontend build | `npm --prefix frontend run build` | ✅ clean (check-reports, check-no-confirm, check-sod-approve all pass) |
| i18n completeness | new `pos` namespace present in en/ar/tr | ✅ |

## 4. Self-Audit vs Epic §7 Rubric

**A. Architecture integrity**
- ✅ No Firestore/Prisma imports in `domain/pos/`. Domain entities only use plain TS types + `Date`.
- ✅ Repositories registered in `bindRepositories.ts` with `DB_TYPE === 'SQL' ? Prisma : Firestore`; no `new Firestore…()` outside DI.
- ✅ Controller is thin (no business logic, no math, no posting).
- ✅ No duplicated sales/tax/COGS/inventory posting in `application/pos/`. Phase 0 ships only settings + registers.

**B. Sales integration (N/A for P0 — deferred to P2)**
- Phase 0 ships no sale code yet. P2 will write `CompletePosSaleUseCase`.

**C. Money/stock safety (N/A for P0 — no money flows yet)**

**D. Tenant + audit**
- ✅ All entity reads are `(companyId, id)`-scoped (e.g. `getById(companyId, id)`).
- ✅ `RecordChangeService` is not invoked from P0 use cases (no state changes here yet); P1 shift use cases will record.

**E. UX/standards**
- ✅ Shared `PartySelector` (role="CUSTOMER"), `WarehouseSelector`, `AccountSelector` used for the settings page. No raw text inputs for IDs.
- ✅ `ConfirmDialog` used for the Allow-direct toggle and register status changes. `useConfirm` hook for the inline confirmation.
- ✅ `toast.success` / `toast.error` on every server response.
- ✅ en/ar/tr keys for the new `pos` namespace, registered in i18n config.
- ✅ Routes added to `moduleMenuMap.ts` POS group; settings + registers entries present.

**F. Verification evidence in this report**
- ✅ Backend build + tests output pasted.
- ✅ Frontend typecheck + build output pasted.
- Round-trip proof deferred to P1/P2/P3 where the headline flows live (shift close voucher, complete sale, return).

## 5. End-User View (Owner)

Phase 0 of the POS module is live. From the sidebar under **POS**:

- **Registers** (`/pos/registers`): create a till (code, name, branch, warehouse, cash-drawer account) and toggle it active/inactive. Once a register is active, cashiers can be assigned to it.
- **Settings** (`/pos/settings`): three tabs:
  - **General** — toggle "Require an open shift to sell", "Allow POS direct sales" (with confirmation; flips the form-scoped governance rule that lets the POS post direct SIs), pick a walk-in customer, set the receipt-number prefix, and pick a cash-rounding mode (V1 only stores the field; the till applies `none`).
  - **Payment Methods** — per code (CASH, CARD, BANK_TRANSFER, CUSTOM) configure label, settlement account, whether change is allowed (CASH only), whether a reference is required (CARD/BANK), and enabled.
  - **Cash Over/Short** — pick the credit account for over-counts and the debit account for short-counts. The over/short account is required to close a shift that has a non-zero variance.

There is no selling yet. The cashier screen, X/Z reports, and returns are scheduled for P1–P4.

## 6. Manual QA Script

1. From a company with the POS module entitled, open `Settings → Modules → POS` (or the sidebar entry).
2. Open **POS → Settings**. You should land on the General tab with `requireOpenShift = true` and `allowPosDirectSales = false`.
3. Toggle **Allow POS direct sales** to `true`. A confirmation appears; click Confirm. The Save banner activates.
4. Click Save. You should see a success toast.
5. Open **Sales → Settings → Governance** (or call `GET /tenant/sales/settings`) and confirm the rule:
   `{ id:'pos_direct_sale_form_allow', scope:'form', formType:'pos_sale', action:'allow', persona:'direct' }`
   is present.
6. Toggle **Allow POS direct sales** back off, save, and confirm the rule is removed.
7. Open **Payment Methods**, fill in `CARD` settlement account, save. Reopen the page and confirm the value persisted.
8. Try saving with an enabled method whose settlement account is blank: backend rejects with "Payment method X is enabled but has no settlement account configured."
9. Open **POS → Registers**, click **New Register**, fill in code/name/warehouse/cash-drawer, save. Confirm it appears in the list.
10. Toggle the register to INACTIVE; reopen — status is INACTIVE.
11. Set `cashShortAccountId` in Settings to a non-existent account id: the save call rejects with "Account not found for cashShortAccountId…".
