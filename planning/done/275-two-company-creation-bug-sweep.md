# 275 — Two-company creation bug sweep + smoke test

**Date:** 2026-06-28
**Area:** Epic 275 (SQL/Postgres). Company creation + module initialization on the SQL/Prisma path.
**Branch:** local (DB_TYPE=SQL, portable Postgres). Not committed/merged — awaiting owner go.

## Problem

Owner reported a cascade of errors creating companies in SQL mode. Symptoms:
1. Finishing the wizard failed, but the company row was still created (orphan in the selector).
2. "Try again" reported the company "already exists".
3. Creating a different company failed with `Unique constraint failed on the fields: (taxId)`.

## Root cause — one class, three Postgres invariants the Firestore→SQL port missed

| # | Invariant Firestore lacked | Symptom | Fix |
|---|----------------------------|---------|-----|
| 1 | `UNIQUE` treats `''` as a real value (Postgres allows many `NULL`s) | Blank `taxId` collided after the first company | `taxId` nullable; blank → `NULL` |
| 2 | Stable per-document ids became **global** primary keys | Role `'OWNER'`, voucher-type ids, `FY{year}` collided across companies | composite PK for roles; company-scoped ids for voucher types / fiscal years |
| 3 | No cross-document transaction | A mid-flow failure orphaned the company row | compensating rollback (FK cascade) |

Each only manifests on the **second** company or on a partial failure — why single-company testing missed them.

## Changes

- `backend/prisma/schema.prisma`: `Company.taxId` → `String?  @unique`; `CompanyRole` PK → `@@id([companyId, id])`.
- `PrismaCompanyRepository.save`: blank `taxId` → `null`.
- `CompleteCompanyCreationUseCase`: whole provisioning block wrapped; on failure deletes the company (cascade) and rethrows.
- `PrismaCompanyAdminRepository`: role `update`/`delete` use compound key `companyId_id`.
- `InitializeAccountingUseCase`: voucher-type copy id and `FiscalYear` id company-scoped; voucher-**form** `typeId` now the scoped type id (was the canonical code → FK violation).
- `FiscalYearUseCases`: manual fiscal-year id company-scoped.
- `PrismaAccountRepository.toDomain`: normalize `classification` on read (legacy mixed-case data). One-time backfill of 84 rows → UPPERCASE.
- `PrismaSalesSettingsRepository`, `PrismaPurchaseSettingsRepository`, `PrismaSalesProfitLineFactRepository`: removed scalar `companyId` + relation `connect` conflict in `create`.
- `PrismaVoucherSequenceRepository`: voucher-sequence id company-scoped (`<prefix>-<year>` was a global PK → collided on the 2nd company's first posting). Found by the posting extension below.

## QA script (repeatable)

```bash
cd backend
# Requires DB_TYPE=SQL and a seeded system (npm run seed:sql), plus one non-admin USER.
npm run smoke:companies
```

`src/scripts/smokeTwoCompanies.ts` drives the real `CreateCompanyUseCase` + `SimpleTradingCompanyInitializer` (identical to `OnboardingController.createCompany`) **twice** with the same owner + bundle, fully initializes modules on both, then verifies per company and cleans up:

- company row, roles (OWNER/ADMIN/MEMBER), owner membership, settings, company modules, entitlement
- chart of accounts, fiscal year, currencies
- voucher types copied **== ** voucher forms created
- no lowercase account classifications
- **posts a balanced journal on each company** (real `CreateVoucherUseCase`, auto-posts), then asserts: voucher recorded, ledger entries created, and **ledger balanced** (Σdebit == Σcredit)

Exit 0 = PASS, 1 = FAIL. It deletes every company it creates (ledger + vouchers first — `voucher_lines`/`ledger_entries` RESTRICT account deletion — then the company cascade).

## Result

`npm run smoke:companies` → **PASS** (15 checks per company). Both companies identical: 48 accounts, 16 voucher types = 16 forms, balanced journal posted, roles/settings/FY/entitlement present, classifications canonical. Backend `tsc` build clean. Orphan "ASD co" deleted.

## Follow-ups (not done)

- Audit remaining module initializers (HR, CRM, POS layouts/registers, print templates, field library) with the same two-company lens — same bug class is plausible there. (POS *settings* + register are now exercised via the initializer; a full POS sale needs item/shift fixtures.)
- **Admin "delete company" with transactions:** `voucher_lines.accountId` and `ledger_entries.accountId` are `RESTRICT`, so a plain `company.delete()` fails once a company has posted vouchers. Either delete transaction data first (as the smoke cleanup does) or change those FKs to cascade. The creation rollback is unaffected (it fires before any posting).
- Decide whether to fold `smoke:companies` into CI once Supabase is provisioned (275f); consider adding a POS sale and an inventory movement to the posting coverage.
