# Task 240f — Phase 6 Mode Lock + Wizard/COA

## Summary

Phase 6 is complete. Company creation now asks for the inventory/accounting mode once, seeds the matching starter policy and COA, and blocks later mode changes after the company has posted stock or accounting history.

## What Changed

### Technical Developer View

- Widened `SimpleTradingCompanyInitializer` so one mode-policy map now drives:
  - COA template selection (`periodic_trading` or `standard`)
  - inventory `accountingMode`
  - costing basis
  - Sales/Purchases workflow defaults
  - linked default accounts
- Added `InventoryAccountingModeLockService` to centralize the "first posted transaction locks the mode" rule.
- Extended onboarding create-company contract with `accountingMode`.
- Extended Inventory Settings API DTOs with:
  - `accountingModeLocked`
  - `accountingModeLockReason`
- Updated `InventoryController.updateSettings` so a pre-history mode change:
  - re-runs the same starter initializer
  - re-seeds the matching COA + module defaults
  - preserves the safe reset behavior for mode-sensitive inventory mappings
- Added repository support for posted-voucher detection across Firestore, Prisma, and in-memory test helpers.

### End-User View

- In the company wizard, you now choose one of three stock-control modes:
  - **Simple**
  - **Standard**
  - **Advanced**
- ERP03 uses that choice to prepare the right chart of accounts and workflow defaults automatically.
- In Inventory Settings, you can still change the mode while the company is still pre-live.
- After the first posted stock or accounting transaction, ERP03 locks the mode and shows a readable reason instead of allowing a risky accounting change.

## Files Touched

- Backend:
  - `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
  - `backend/src/application/inventory/services/InventoryAccountingModeLockService.ts`
  - `backend/src/api/controllers/inventory/InventoryController.ts`
  - `backend/src/api/controllers/onboarding/OnboardingController.ts`
  - `backend/src/api/dtos/InventoryDTOs.ts`
  - `backend/src/domain/accounting/repositories/IVoucherRepository.ts`
  - `backend/src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2.ts`
  - `backend/src/infrastructure/prisma/repositories/PrismaVoucherRepository.ts`
  - `backend/src/tests/helpers/InMemoryVoucherRepository.ts`
- Frontend:
  - `frontend/src/modules/onboarding/components/company-wizard/*`
  - `frontend/src/modules/onboarding/api/onboardingApi.ts`
  - `frontend/src/modules/inventory/pages/InventorySettingsPage.tsx`
  - locale files under `frontend/src/locales/*/common.json`
- Docs:
  - `docs/architecture/onboarding.md`
  - `docs/architecture/inventory.md`
  - `docs/user-guide/settings/company-starter-template.md`

## Verification

- `npm --prefix backend test -- --runTestsByPath src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts src/tests/application/inventory/InventoryAccountingModeLockService.test.ts`
- `npm --prefix backend run build`
- `npm --prefix frontend run build`

## Acceptance Check

- New company: one mode answer seeds matching COA + inventory mode ✅
- Pre-transaction mode change allowed and re-seeds defaults ✅
- Post-transaction mode change blocked with readable error ✅
- Focused tests/build verification green ✅

## Known Constraints / Follow-up

- Pre-posting mode changes are implemented as **additive reseeds**, not destructive COA cleanup. This is intentional for audit safety.
- Prisma does not persist voucher `postedAt` as a first-class column, so its lock check uses the closest persisted signal there: `status = APPROVED`.
- Phase 7 still needs fresh-tenant emulator/browser proof for all three modes.

## Post-Implementation Audit (2026-06-19)

Independent audit + full re-verification of this slice (not just the self-report):

- **Reseed idempotency confirmed safe** across every path the mode-change controller re-runs: COA accounts (skip-if-code-exists), supporting accounts (`getByCode`), fiscal year (count guard), voucher types (`.doc(id).set()` upsert by deterministic id), forms (existing-keys set), warehouse (only-if-none), UOM (length guard), sales/purchase module records (update-if-exists), and all settings (`saveSettings` upsert). No duplication risk.
- **Lock correctness confirmed:** `postedAt` is the domain's canonical posted signal (`VoucherEntity.isPosted() ≡ !!postedAt`, always set on `post()`, persisted as ISO-or-null), so the Firestore `hasPostedVouchers` filter matches posted vouchers exactly and excludes drafts.
- **Finding fixed — config reset on reseed:** the reseed re-ran the full company initializer, which silently reset `strictApprovalMode`, the accounting module's `approvalRequired`/`autoPostEnabled`/`allowEditDeletePosted`, and the fiscal-year settings back to flexible/Jan–Dec defaults (pre-posting only, but a surprising wipe of owner-set policy). Added a `preserveCompanyPolicy` flag through `SimpleTradingCompanyInitializer` → `InitializeAccountingUseCase`; the `InventoryController` mode-switch path passes it `true`. A reseed now refreshes the COA template + module wiring but **preserves** the owner's approval mode and fiscal-year configuration. First-time onboarding does not pass the flag → original behavior unchanged. Regression test added (`preserves approval mode and fiscal-year settings on a reseed`).
- **Re-verification:** focused suites 2/2 (**6 tests**), `npm --prefix backend run build` green, **full backend suite 162 suites / 1455 tests / 0 failures**, frontend typecheck + production build green.

## Time Spent

- Approx. `2.4h` (+ `0.7h` audit & hardening)
