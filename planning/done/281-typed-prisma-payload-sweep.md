# Task 281 — Typed Prisma Payload Sweep

**Date:** 2026-07-02
**Branch/worktree:** isolated agent worktree off `codex/sql-readiness-wip-20260628`
**Goal:** Eliminate the bug class behind recurring runtime `PrismaClientValidationError`s: Prisma repositories building write/where payloads in untyped containers (`const x: any = {}`, `Record<string, any>`), which disabled compile-time checking of column names against the schema. (Trigger: live-QA hit `OpeningStockDocument.postedAt` missing from schema.)

## Scope

- Swept `backend/src/infrastructure/prisma/repositories/**` for every untyped payload bag passed to `prisma.*.create/update/upsert/updateMany/findMany/findFirst/count` args.
- Re-typed **74 payload sites across 47 repository files** to generated Prisma input types:
  - `data` bags → `Prisma.<Model>UncheckedUpdateInput` (Unchecked chosen because these repos set scalar FKs directly); `updateMany` bag → `Prisma.<Model>UpdateManyMutationInput` (CompanyRole).
  - Upsert bags shared between `create` and `update` → `Omit<Prisma.<Model>UncheckedCreateInput, '<key>'>` (UserPreferences, CompanySettings) so both sides stay schema-checked.
  - `where` bags → `Prisma.<Model>WhereInput`; `orderBy` bag → `Prisma.<Model>OrderByWithRelationInput` (AuditLog).
- Added the missing `import { Prisma } from '@prisma/client'` in ~20 files.
- Date-range accumulators (`where.x = {}; where.x.gte = ...` / spread-over-union patterns) restructured to typed conditional-spread form in: PrismaAuditLogRepository, PrismaRecordChangeLogRepository, PrismaCommissionEntryRepository, PrismaLedgerRepository (x2).

## Latent bugs surfaced by `tsc` and how each was resolved

Rule applied (owner-locked): **code/domain is truth** — missing columns are added to the schema; wrong names are fixed in code.

| # | File | Field(s) | Resolution |
|---|------|----------|------------|
| 1 | `inventory/PrismaOpeningStockDocumentRepository.ts` | `warehouseId`, `createAccountingEffect`, `openingBalanceAccountId`, `voucherId`, `totalValueBase`, `postedAt` on `OpeningStockDocument` | **Schema-add** — worktree schema lacked all six; mirrored the main-tree fix byte-for-byte (same model text) so the merge is clean. This is the exact bug class that broke live QA. |
| 2 | `inventory/PrismaStockAdjustmentRepository.ts` | `warehouseId`, `voucherId`, `adjustmentValueBase`, `postedAt` on `StockAdjustment` | **Schema-add** (4 columns: `String?`, `String?`, `Float @default(0)`, `DateTime?`) — posting a stock adjustment would have thrown at runtime, same shape as the OpeningStockDocument QA bug. |
| 3 | `inventory/PrismaItemCategoryRepository.ts` | `active` on `ItemCategory` (where filter + `toDomain` read) | **Schema-add** (`active Boolean @default(true)`, matching `Item.active` convention) — any category list filtered by active would have thrown. |
| 4 | `accounting/PrismaLedgerRepository.ts` | `costCenterId` on `LedgerEntry` (GL filter, balance query, `toDomain` read) | **Schema-add** (`costCenterId String?` + `@@index([companyId, costCenterId])`). Companion **code-fix**: `recordForVoucher` now persists `costCenterId: line.costCenterId ?? null` so the GL cost-center filter actually returns rows. |
| 5 | `accounting/PrismaLedgerRepository.ts` | `where.voucher = { type }` — no `voucher` relation on `LedgerEntry` | **Schema-add** (relation `voucher Voucher? @relation(fields: [voucherId], references: [id])` + back-relation `ledgerEntries LedgerEntry[]` on `Voucher`). Uses the existing `voucherId` FK column — **no new DB column**. GL voucher-type filter would have thrown at runtime. |
| 6 | `PrismaCompanyRepository.ts` (`update`) | `fiscalYearStart`/`fiscalYearEnd` passed as `number` to `DateTime` columns | **Code-fix** — normalize to `new Date(...)` before the Prisma call; rest of the partial is spread into a typed `CompanyUncheckedUpdateInput`. Previously an untyped bag let a raw month number reach Prisma → runtime validation error. |
| 7 | `core/PrismaUserPreferencesRepository.ts` (`upsert`) | appearance-settings merge spread over the JSON input union | **Code-fix** — merge into a plain `Record<string, unknown>` first, then assign as `Prisma.InputJsonValue`. Same merge semantics (existing → new → layoutMode override). |

## Schema columns/relations added (backend/prisma/schema.prisma)

- `OpeningStockDocument`: `warehouseId String?`, `createAccountingEffect Boolean @default(false)`, `openingBalanceAccountId String?`, `voucherId String?`, `totalValueBase Float @default(0)`, `postedAt DateTime?` (identical to the main-tree fix — do not double-apply).
- `StockAdjustment`: `warehouseId String?`, `voucherId String?`, `adjustmentValueBase Float @default(0)`, `postedAt DateTime?`.
- `ItemCategory`: `active Boolean @default(true)`.
- `LedgerEntry`: `costCenterId String?`, `@@index([companyId, costCenterId])`, relation `voucher Voucher?` over existing `voucherId`.
- `Voucher`: back-relation `ledgerEntries LedgerEntry[]` (no DB change).

## Deliberately untouched (and why)

- `company/PrismaCapabilityRegistryRepository.ts:134` — `setConfig(..., config: Record<string, any>)` is the interface-mandated parameter for a JSON column value, not a column-name payload bag.
- `shared/PrismaPartyItemPriceRepository.ts:22` — `stripUndefinedDeep` output accumulator; generic JSON deep-clean helper, not a Prisma payload.
- `as Record<string, any>` **read-side casts** of JSON columns throughout (`record.config`, `layout._meta`, `data.meta`, etc.) — these deserialize JSON columns and cannot mis-name schema columns.
- `updateItem`'s existing `payload as unknown as Prisma.ItemUncheckedUpdateInput` casts (PrismaItemRepository) — already typed at the call boundary in Epic 275; out of scope.

## Verification

- `npx prisma validate` / `npx prisma generate` (v5.22.0): pass; client regenerated in the worktree's own `node_modules` (installed via `npm ci`).
- `npx tsc --noEmit`: **0 errors** (baseline before sweep was also 0 — every error introduced and fixed during the sweep was a real schema/code mismatch listed above).
- Re-grep for `: any = {`, `(where|data|updateData|orderBy)\s*:\s*any\s*=`, non-cast `Record<string, any>` in the repositories directory: **0 payload bags remain** (only the two legitimate helpers above).

## Follow-up required in the main tree after merge

1. `npx prisma db push` (pre-alpha, no migrations per project policy) — new columns: `stock_adjustments` (4), `item_categories.active`, `ledger_entries.costCenterId` (+ index). `opening_stock_documents` columns may already be pushed by the main-tree fix; `db push` is idempotent.
2. `npx prisma generate` in the main tree (this worktree generated only into its own `node_modules`).
3. `npm run build` before verifying against the emulator (backend serves compiled `lib/`).
4. QA suggestion: repeat the live-QA opening-stock posting flow, plus one stock adjustment post, one category active-filter list, and a GL query filtered by voucher type and by cost center.
