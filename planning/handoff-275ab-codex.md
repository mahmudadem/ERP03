# Codex task: resolve the 12 audit TODOs (275a seed data + 275b settings resolver)

You are working in the ERP03 repo (`D:\DEV2026\ERP03`). **Read `AGENTS.md` first** — it is the
source of truth for how to work here. This is a non-technical owner's pre-alpha MVP: keep the code
clean, update docs, and **never commit without asking the owner first**.

## Context
Epic 275 migrates ERP03 to launch on **Supabase/PostgreSQL**. The backend is dual-DB
(`DB_TYPE=SQL` Prisma vs `FIRESTORE`). Task 275e is **done and committed** on branch
`feat/275-supabase-integration` (real-Postgres integration harness, 25 checks green, 8 SQL bugs
fixed — see `planning/done/275e-sql-integration-tests.md`). The money-path engine is proven.

What remains before deploy are **12 audit TODO markers** left during the 275a (seed data) and
275b (settings resolver) ports. They are about **new-company starter data and settings lookups**,
NOT money math. Resolve them against the now-live Prisma schema. Work continues on branch
`feat/275-supabase-integration`.

Find them all with:
```bash
cd backend && grep -rn "TODO(275a-audit)\|TODO(275b-audit)" prisma src
```

## The 12 items and what "resolved" means for each

### Pile A — 275a seed data (6 markers)
1. **`prisma/seeds/seedBusinessDomains.ts`** — `BusinessDomain.modules` (String[]) isn't in the
   Firestore seed data, defaulted to `[]`. Confirm `[]` is correct for v1 (check how BusinessDomain
   `modules` is consumed, if at all). Either justify the default in the comment and remove the TODO,
   or populate it correctly.
2. **`prisma/seeds/seedCOATemplates.ts`** — `ChartOfAccountsTemplate` is upserted **by name**, which
   is fragile. **Add a stable `code` column** to the model and upsert by `code`. This is the most
   substantive item: schema change + seed change + confirm the company-setup wizard reads templates
   by the new key. (Pairs with item 6.)
3. **`prisma/seeds/seedModuleRegistry.ts`** (two markers) — (a) `lifecycleStatus` "ready" vs "draft"
   is inferred from an `IMPLEMENTED_CODE_MODULES` set; confirm the mapping is correct and document it.
   (b) `ai-assistant` is excluded from the module list. **Decision is final: AI is OFF for v1.** Make
   the exclusion explicit/clean and remove the TODO.
4. **`prisma/seeds/seedPermissionRegistry.ts`** (two markers) — `ai-assistant.*` permissions are
   currently seeded. Per the v1 = AI-off decision, **exclude the ai-assistant permissions** (or, if
   keeping a flat catalog is intentional, document why and gate them). Be consistent with item 3.
5. **`prisma/seeds/seedVoucherTypeDefinitions.ts`** — the Prisma `VoucherTypeDefinitionRepository`
   does **not** persist `voucherType`, `persona`, `sidebarGroup` (domain-only display extras).
   Confirm nothing in the SQL read path needs them; if confirmed cosmetic, document and drop the TODO.
   If a screen needs them, add the columns + mapping.
6. **`prisma/seeds/seedSystemMetadata.ts`** — confirm the company-creation wizard reads COA templates
   from the **`ChartOfAccountsTemplate`** table (SQL) and not the legacy `SystemMetadata` path. Make
   the wizard's source unambiguous. (Resolve together with item 2.)

### Pile B — 275b settings resolver (6 markers, all in `src/infrastructure/prisma/SettingsResolverSQL.ts`)
First answer the gating question (marker at top of the file): **does any live code path actually call
`settingsResolverSQL`?** Grep for its usages.
- **If nothing calls it → delete the file** (and its binding/wiring) as dead code. That resolves all
  6 markers at once. This is the most likely and cleanest outcome — verify carefully before deleting.
- **If something does call it →** for each placeholder descriptor method (shared module settings,
  shared `Data` doc, generic collection resolver, tax categories), wire it to the **correct Prisma
  model/table**, or make callers use the specific typed helpers and remove the generic ones. Confirm
  `'taxCode'` is the right model for tax categories (or whether a `taxCategory` model exists/should).

## Hard rules / gotchas
- **Prisma is 5.22.0 (local).** ALWAYS use `backend/node_modules/.bin/prisma` — **never `npx prisma`**
  (global 7.x fails). Run `npm install` in `backend/` if `.bin` is missing.
- **DATABASE_URL is inline only, NEVER written to `backend/.env`** (secrets red line). Local Postgres 16:
  `postgresql://postgres@localhost:5433/erp_db?schema=public`.
- Any new column must be **nullable/additive** (pre-alpha, no data migration). After a schema change run
  `node_modules/.bin/prisma db push --skip-generate` then `node_modules/.bin/prisma generate`.
- **Prisma checked vs unchecked create input** — don't mix relation `connect` with the raw scalar FK
  for the same relation (this exact mistake caused 4 of the 8 bugs in 275e). Under nested writes use
  the relation `connect`; for flat creates the scalar FK is fine.
- Touch **Prisma/seed path only**. Do not change Firestore repos or any accounting/tax/cost math.
- Prefer deleting dead code over leaving half-wired placeholders.

## Verify (must pass)
```bash
cd backend
export DATABASE_URL="postgresql://postgres@localhost:5433/erp_db?schema=public"
node_modules/.bin/prisma db push --skip-generate    # if schema changed
node_modules/.bin/prisma generate                   # if schema changed
node_modules/.bin/prisma db push --force-reset --skip-generate   # OPTIONAL clean DB, then:
npx ts-node --transpile-only prisma/seeds/runSqlSeed.ts          # full seed must run clean end-to-end
npx ts-node --transpile-only scripts/sql-integration-275e.ts     # still: ALL 25 INTEGRATION CHECKS PASSED
node_modules/.bin/tsc --noEmit                      # clean, exit 0
grep -rn "TODO(275a-audit)\|TODO(275b-audit)" prisma src   # expect: ZERO results
```
The acceptance bar: **zero remaining 275a/275b audit TODOs**, the **full SQL seed runs clean**, the
**25-check harness still passes**, and `tsc --noEmit` is clean.

## Definition of Done (repo protocol — all required)
- [ ] All 12 markers resolved (fixed or justified-and-removed); grep returns zero.
- [ ] Full SQL seed (`runSqlSeed.ts`) runs clean on a fresh DB; 25-check harness still green; tsc clean.
- [ ] Write `planning/done/275ab-audit-resolution.md` — for each of the 12 markers: what it was, the
      decision/fix, and (if a schema/seed change) why it's safe. Note any `SettingsResolverSQL` deletion.
- [ ] Update `docs/architecture/<module>.md` for any schema or seed-shape change (e.g. accounting/system-core).
- [ ] Append `planning/JOURNAL.md`; update `planning/ACTIVE.md` (next = 275f deploy) and
      `planning/PRIORITIES.md` task-lock row.
- [ ] **Ask the owner before committing.** When approved, commit on `feat/275-supabase-integration`
      as `chore(sql): resolve 275a/275b audit TODOs ...` with the `Co-Authored-By: Claude Opus 4.8`
      trailer. Do NOT merge to main.

Report back with: the disposition of each of the 12 markers (fixed vs justified-removed vs dead-code
deleted), and confirmation that the seed runs clean + 25 checks still pass + grep is zero.
