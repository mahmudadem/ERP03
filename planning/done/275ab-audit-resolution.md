# 275a/275b Audit Resolution

**Date:** 2026-06-28  
**Branch:** `feat/275-supabase-integration`  
**Status:** Complete locally, not committed

## Technical Developer View

### Scope

Resolved the remaining Epic 275 SQL launch audit markers from the 275a SQL seeders and 275b SQL settings resolver work. This was a launch-readiness cleanup only: no posting math, tax calculation, costing, stock valuation, ledger balancing, tenant isolation, or Firestore repository behavior was changed.

### Disposition of the 12 Audit Items

1. `seedBusinessDomains.ts` - resolved by confirming `BusinessDomain.modules` is SQL starter metadata only. The seed keeps conservative module suggestions; the v1 wizard does not consume it for company creation.
2. `seedCOATemplates.ts` - fixed by adding nullable `ChartOfAccountsTemplate.code` and re-keying the seed logic to update/create by stable code, with a legacy name claim for pre-code rows.
3. `seedModuleRegistry.ts` lifecycle status - resolved by documenting the v1 launch mapping: tested runtime modules are `ready`; placeholders remain `draft`.
4. `seedModuleRegistry.ts` AI module - fixed by keeping `ai-assistant` out of the v1 SQL module registry and deleting stale AI registry rows if a previous seed inserted them.
5. `seedPermissionRegistry.ts` AI permissions - fixed by excluding `ai-assistant.*` permissions from the v1 registry and deleting stale rows. `seedRoleTemplates.ts` was aligned so owner/admin templates no longer reference excluded AI permissions.
6. `seedVoucherTypeDefinitions.ts` display extras - fixed by keeping `voucherType`, `persona`, and `sidebarGroup` in `layout._meta` and hydrating them in `PrismaVoucherTypeDefinitionRepository.toDomain(...)` so SYSTEM templates copy correctly into tenant voucher types/forms.
7. `seedSystemMetadata.ts` COA manifest - resolved by documenting that the live company wizard reads COA options through `ChartOfAccountsTemplateRepository`; `system_metadata.coa_templates` remains a legacy/lightweight manifest with ids matching the stable template codes.
8. `SettingsResolverSQL.ts` live usage gate - resolved by verifying no production runtime path consumes it.
9. `SettingsResolverSQL.ts` shared module/settings descriptors - resolved by deleting the dead resolver rather than preserving placeholder mappings.
10. `SettingsResolverSQL.ts` generic collection descriptors - resolved by deleting the dead resolver.
11. `SettingsResolverSQL.ts` module data descriptors - resolved by deleting the dead resolver.
12. `SettingsResolverSQL.ts` tax category descriptor - resolved by deleting the dead resolver; SQL code uses typed Prisma repositories instead of a generic settings resolver.

### Files Changed

- `backend/prisma/schema.prisma`
- `backend/prisma/seeds/seedBusinessDomains.ts`
- `backend/prisma/seeds/seedCOATemplates.ts`
- `backend/prisma/seeds/seedModuleRegistry.ts`
- `backend/prisma/seeds/seedPermissionRegistry.ts`
- `backend/prisma/seeds/seedRoleTemplates.ts`
- `backend/prisma/seeds/seedSystemMetadata.ts`
- `backend/prisma/seeds/seedVoucherTypeDefinitions.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/infrastructure/firestore/repositories/company-wizard/FirestoreChartOfAccountsTemplateRepository.ts`
- `backend/src/infrastructure/prisma/repositories/company-wizard/PrismaChartOfAccountsTemplateRepository.ts`
- `backend/src/infrastructure/prisma/repositories/designer/PrismaVoucherTypeDefinitionRepository.ts`
- `backend/src/repository/interfaces/company-wizard/IChartOfAccountsTemplateRepository.ts`
- Deleted `backend/src/infrastructure/prisma/SettingsResolverSQL.ts`
- Deleted `backend/src/infrastructure/prisma/__tests__/SettingsResolverSQL.test.ts`

### Verification

- `node_modules/.bin/prisma db push --skip-generate` - passed
- `node_modules/.bin/prisma generate` - passed
- `node_modules/.bin/prisma db push --force-reset --skip-generate` - passed
- `npx ts-node --transpile-only prisma/seeds/runSqlSeed.ts` - passed on a fresh PostgreSQL database
- `npx ts-node --transpile-only scripts/sql-integration-275e.ts` - passed, `ALL 25 INTEGRATION CHECKS PASSED`
- `node_modules/.bin/tsc --noEmit` - passed
- `rg "TODO\\(275a-audit\\)|TODO\\(275b-audit\\)" prisma src` - zero results

### Time

Estimated: 2-3 hours.  
Actual: about 1.4 hours.

## End-User View

This cleanup makes the SQL launch setup safer for new companies. Starter chart-of-accounts templates now have stable internal codes, AI setup data is not exposed in the v1 SQL seed because AI is off for launch, and the company wizard continues to show the correct accounting templates when a new company is created.

There is no new screen or workflow for users to test from this task. The next owner-testable step is 275f: provision Supabase/Railway and run the launch smoke tests on the deployed SQL environment.

## Known Follow-Ups

- Commit is intentionally not created yet. Owner approval is required before committing.
- Do not merge to `main` until the owner gives the launch go.
