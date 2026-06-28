# Task 275d — Port the ~15 missing Prisma repositories (non-AI)

**Epic:** [275 — Supabase Launch](./275-supabase-launch-epic.md) · **Depends on:** none (parallel) · **Est:** 4–7 days
**Branch:** `feat/275d-missing-prisma-repos` (may split per group)

## Objective
Several Firestore repos have **no Prisma twin** yet (features added after the dual-DB layer was built). Port the non-AI ones so every v1-enabled module has a working SQL implementation and a `DB_TYPE=SQL` binding.

## Why
With `DB_TYPE=SQL`, any module hitting a Firestore-only repo either falls back to Firestore (wrong — splits the data) or has no binding. v1 modules must be fully SQL.

## In scope — port these (use the Firestore repo + the interface as the spec)
**Sales/Purchases master data:** CommissionEntry, CreditOverride, CustomerGroup, VendorGroup, PriceList, PurchasePriceList, PromotionRule, Quote, RecurringInvoiceTemplate, Salesperson.
**System-core / platform:** PolicyConfig, SellingPolicy, PostingLog, RecordChangeLog, PeriodLockOverride. (IdempotencyKey: confirm — needed by the offline-sync future and idempotent posting.)
**Print / designer:** PrintLayoutTemplate, PosLayout, FieldLibrary, CommunicationsSettings.

> Verify the live gap at start: `find .../firestore/repositories -name 'Firestore*'` vs `.../prisma/repositories -name 'Prisma*'`. Aggregator files (`*Repositories.ts`) and `.spec` are not real gaps. **EXCLUDE all `Ai*` repositories — AI module is OFF for v1.**

## Scope (files)
- New `backend/src/infrastructure/prisma/repositories/**/Prisma<Name>Repository.ts` per item.
- Schema: add any missing models/fields to `backend/prisma/schema.prisma` (some may already exist among the 105 models — check first).
- Register each in `backend/src/infrastructure/di/bindRepositories.ts` under the `DB_TYPE === 'SQL'` branch.

## Steps (per repo)
1. Read the interface (`backend/src/repository/interfaces/...`) and the Firestore impl.
2. Confirm/add the Prisma model; map `toDomain`/`toPersistence` carefully (types, nullability, arrays).
3. Implement every interface method; wire the DI binding.
4. `tsc --noEmit` clean after each.

## Acceptance criteria
- [ ] Every listed non-AI repo has a Prisma impl + SQL DI binding; no v1 module silently falls back to Firestore under `DB_TYPE=SQL`.
- [ ] Schema migrates cleanly (`prisma db push`).
- [ ] `tsc --noEmit` clean; `DB_TYPE=FIRESTORE` unaffected. (Integration tests are 275e.)

## Audit gate (CTO checks)
Re-run the Firestore-vs-Prisma gap diff and confirm only `Ai*` + aggregators + `.spec` remain. Spot-check 3 ports for faithful field mapping vs the Firestore version.

## Out of scope
AI repos; integration testing (275e); behavior changes — these are faithful ports, not redesigns.
