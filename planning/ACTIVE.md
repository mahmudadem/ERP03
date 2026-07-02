# 🎯 Current Focus

> Keep this file SHORT. It is "what's happening now + where I left off."
> Completed-task detail lives in `planning/done/NN-*.md` and session history in `planning/JOURNAL.md`.
> (Trimmed 2026-06-29 from a 1700-line backlog — all of that history is preserved in `done/` + `JOURNAL.md`.)

---

## Current task — Canonical worktree consolidation + frontend deploy (2026-07-02)

**Goal:** collapse the leftover frontend/i18n/setup-wizard work from `ERP03-vercel-fix` and the
useful dirty frontend polish from `ERP03-unified` into one canonical line, then merge/push/deploy
from that single traceable lane.

**Status:** consolidated into `D:\DEV2026\ERP03-consolidate` on
`codex/consolidate-worktrees-20260702`. Frontend verification passed on the combined state:
`npm run typecheck`, locale JSON parse, `git diff --check`, and `npm run build`.

**Deploy scope:** frontend only. No runtime backend/function code changed in this consolidation;
backend edits are seed/metadata support and docs, so a Firebase Functions deploy is not required.

**Next:** commit the canonical consolidation branch, merge it to `main`, push, and deploy the
frontend so future production tracing comes from one git-backed line.

---

## 🧭 PLATFORM POLICY (owner decision 2026-07-02): **SQL leads, Firestore follows**

SQL/PostgreSQL is the primary platform for all forward development; Firebase/Firestore stays
operational for demos/early trials at current feature level, periodically maintained via the
parity ritual. **Governing plan: `planning/ROADMAP-PILOT.md`** (read it before taking any task);
parity tracking: `planning/PARITY-LEDGER.md`. Every PR must declare its Firebase-impact class (A/B/C).
Immediate focus: first external tester = **POS user, Arabic speaker** — served from the Firebase
demo lane (Phase 0 Track F) while SQL cloud staging is stood up (Track S).

---

## Current task — Deployment Diagnostics page (Task 280, 2026-07-02)

**Goal:** add a production-safe Super Admin page that shows frontend/backend deployment metadata,
database mode, DB health, Firebase/Auth health, and safe runtime status without exposing secrets.

**Status:** deployed to production from branch `codex/deployment-diagnostics-page` on 2026-07-02.
Pending owner logged-in verification of `/super-admin/deployment-diagnostics`.

**Verification passed:**
- `backend`: `npm run build`
- `frontend`: `npm run typecheck`
- `frontend`: `npm run build`
- EN/AR/TR `common.json` parse check
- Firebase Functions production deploy to `erp-03` passed.
- Vercel production deploy passed and aliased to `https://erp-03.vercel.app`.
- Live checks passed: frontend `200`, backend health `ok`, diagnostics endpoint returns `401` without auth.

**Next:** owner logs in as Super Admin and verifies the live diagnostics page. Then commit/merge this
branch so production is backed by git history.

---

## Current task — CONVERGENCE MERGED ✅; finishing "SQL alone entirely" (2026-07-01)

**DONE:** convergence landed on `main` via **PR #54** (merge commit `0c6f0ebc`). One DB-agnostic
codebase now; test either DB via the `DB_TYPE` toggle.

**Goal scorecard (runs on each DB entirely):**
- **Firebase — entirely:** ✅ proven (live in prod `erp-03`; our changes were Prisma-only or
  `DB_TYPE`-guarded, so its path is unchanged).
- **SQL backend — entirely:** ✅ proven (25/25 integration across all modules + 7/7 throwers +
  settings round-trip + company create on real Postgres).
- **SQL frontend — one gap left:** ⚠️ 5 files still read Firestore directly (won't work on SQL):
  `accounting/services/voucherTypesService.ts`, `accounting/voucher-wizard/services/voucherWizardService.ts`,
  `accounting/voucher-wizard/validators/uniquenessValidator.ts`,
  `tools/forms-designer/services/documentDesignerService.ts`,
  `tools/forms-designer/validators/uniquenessValidator.ts`.
  **Backend endpoints already exist** to port them to (`/tenant/accounting/voucher-types/catalog`,
  `/designer/voucher-types`, `/tenant/accounting/voucher-forms` full CRUD+clone). Risk: these files
  ALSO run in the live Firebase lane (Firestore-direct is correct there) — the port must keep working
  in BOTH modes, so build+verify on SQL, keep on a branch, open a separate PR, verify Firebase mode
  before it lands on `main`. This is the last mile to "SQL alone entirely."

---

### (history) Convergence — how it landed

**Decision (owner-approved):** stop the two-lane drift; collapse to a single DB-agnostic
codebase on `main`. The SQL-readiness branch (`codex/sql-readiness-wip-20260628`) was
**merged up to `main`** (which carries the production 278a–z fix queue) so that from now
on every feature is written **once** and tested against either DB via the `DB_TYPE` toggle.

- The architecture already supports "one codebase, any DB" (repository interfaces + DI +
  `DB_TYPE`). Convergence is a **branch/workflow** fix, not an architecture change.
- The SQL-lane fixes are low-risk to Firebase: they live in Prisma-only files or behind
  `if (DB_TYPE === 'SQL')`, so Firebase mode doesn't execute most of them.
- Next after merge lands: one working branch off `main`; retire the `ERP03-unified` worktree;
  resume feature work (e.g. account-balance snapshots) on the unified branch, DB-agnostically.

Backups / rollback: safety tag `backup/sql-before-main-merge-20260701` (pre-merge HEAD of the SQL
branch); prod lane rollback tag `backup/unified-before-heal`; dirty-state backups in
`D:\DEV2026\ERP03-worktree-backups\20260629-160718`.

> 🔒 **Until the merge fully lands and is verified, keep lane discipline:** SQL/PostgreSQL work in
> `D:\DEV2026\ERP03`; Firebase production deploys in `D:\DEV2026\ERP03-unified`. After convergence
> this map is retired.

---

## ✅ Production — healed & LIVE (2026-06-29)

The verified 503/500 storm fix (`9e5d0ac1`) is complete in the production lane and **deployed live
to `erp-03`** (functions + firestore indexes). Verified: server boots and serves (no more
`503 Server not ready`). Details in `JOURNAL.md`.

**Deploy how-to for this project** (no predeploy hook — build first):
1. `cd backend && npm run build` (compiles to `lib/`; deploy uses the compiled output).
2. `firebase deploy --only functions,firestore --project erp-03`.
3. Skip `storage` / `database` targets — not provisioned on `erp-03`.
4. Never put `DB_TYPE=SQL` in `backend/.env` or `.env.<project>` (bricks the deploy); SQL override lives only in gitignored `.env.local`.

---

## 🔄 Production QA fixes — Telegram export queue (278a–z, on `main`)

278a ledger statement indexes (`7ef1917b`); 278b Purchase item API route (`26fa87ac`);
278c Purchase invoice query index (`a3990984`); 278d POS shift-close validation (`300eab98`);
278e Default Arabic language (`4090ccee`); 278f Account form translation (`e7a72724`, `798a92a4`);
278g Account tree RTL controls (`c3d3ec33`, `12754d34`); 278h Clear API error labels
(`ccd97a81`, `75a4f6f0`); 278i POS report date/time sort (`e52683c0`, `cbdbd133`); 278j Opening
Stock legacy movement warning (`64117d93`, `d56d5832`); 278k Sales dashboard / Purchase Settings
translations (`bfd636e0`); 278l POS shift-close summary modal (`f4917b14`); 278m POS report date
range / DatePicker i18n (`37a2feb0`); 278n–278v inventory/purchases/sales report translations;
278w–278z analytics/voucher-name/AP-selector/onboarding-RTL — all complete on `main`.

**Reconciliation branch `codex/reconcile-prod-sql-20260701`:** adds the post-main Firebase
production fixes from `ERP03-unified` back onto the SQL-converged main line:
- **278aa Purchase/Sales filtered invoice list production 500:** fixed and deployed live to
  Firebase Functions on 2026-06-30. Backend now avoids the failing filtered invoice composite-index
  query by sorting/limiting after equality-filter reads; index config still includes the tiebreaker.
- **278ab i18n namespace guard + shared selector translations:** restored Arabic default, registered
  `inventory` and `shared` locales, localized shared selectors, and added the build guard.
- **278ac Purchases translation audit batch 1/2:** Purchases list/detail/report/home/settings
  translation cleanup continued, including Turkish purchase terminology cleanup. Remaining audit work is still tracked in
  `planning/tasks/278ac-production-translation-audit.md`.
- **Frontend RTL/i18n polish dirty slice:** applied onto this reconciliation branch for review. Scope is
  presentation-only cleanup across Accounting, Inventory, POS, Purchases, Sales, onboarding, and sidebar
  labels; no backend posting or database behavior is intended.

**Next:** finish reconciliation verification, then deploy both frontend and Firebase backend from the
same main-derived branch so Firebase and SQL fixes stop living in separate lanes.

---

## 🔶 SQL-readiness — Epic 275 (remediation DONE 2026-06-30)

> ✅ **FIXED & INDEPENDENTLY VERIFIED 2026-06-30.** All 520 write-masking `as any` casts were removed
> from the repo layer and the 96 resulting schema↔repository type errors (41 files, every module)
> driven to **0**. Verified this session: `npx tsc --noEmit` (whole backend) = **0 errors**;
> `grep "as any"` in `src/infrastructure/prisma/repositories` = **0** (write- AND read-side casts gone);
> `npm run build` clean; **25/25** integration checks + smoke (2 companies, all invariants) PASS on real
> Postgres (5432 `erp_db`). DB already in sync with schema (`prisma db push` = no changes).
> 107 files changed (93 repo files + schema/domain/migration/docs). Architecture doc:
> `docs/architecture/sql-repository-layer.md`. Per-item resolution log:
> `planning/done/275-sql-remediation-report.md`. Schema/migration:
> `backend/prisma/migrations/20260630000000_init_schema_readiness_275/`.
> **Runtime-verified 2026-07-01:** the exact Category-A operations that threw
> `PrismaClientValidationError` in the UI now execute cleanly against real Postgres —
> `scripts/sql-ui-throwers-probe.ts` = **7/7 PASS** (account.update rename, auditLog.create,
> uomConversion findMany/create/update, inventoryPeriodSnapshot.saveSnapshot). This closes the
> gap between "green tsc" and "queries actually run." (Two initial probe failures were bad
> test data — FK to non-existent UOM rows — not repo bugs; fixed by using real UOM ids.)
> ⚠️ Still UNVERIFIED beyond this: full *browser* round-trips per module (clicking through the
> live UI), and cloud deploy.

**Backend SQL layer = partially verified (narrow path) on real Postgres (2026-06-29 session):**
- `scripts/sql-integration-275e.ts` → **25/25 checks PASS** (Accounting, Inventory, Sales, Purchases, RBAC, Core, POS).
- `npm run smoke:companies` (forced SQL) → **PASS** — 2 companies created end-to-end (48-acct COA, 16 voucher types/forms, FY, balanced journal, ledger balanced).

**Why it felt "totally broken" before = environment, not code.** Root causes found + fixed:
1. This worktree had **zero deps installed** (`npm install` was never run here — git worktrees don't share `node_modules`).
2. Prisma client not generated.
3. DB schema stale — needed `prisma db push` (Task 277 added `uomBarcodes` columns).
4. One real regression fixed: `PrismaItemRepository.createItem` crashed on undefined `uomBarcodes` (commit `1ffee919`).
5. **Env trap:** `.env` has `DB_TYPE=FIRESTORE`; SQL lives in `.env.local`, but standalone scripts load `.env` → they silently run in Firestore mode. Must force `DB_TYPE=SQL` for SQL runs.

**Reproducible SQL setup (run in `backend/`):**
```bash
npm install
node_modules/.bin/prisma generate
node_modules/.bin/prisma db push --skip-generate            # uses .env DATABASE_URL (5432 erp_db)
npx ts-node --transpile-only scripts/sql-integration-275e.ts          # expect 25/25
DB_TYPE=SQL DATABASE_URL="postgresql://postgres:root@localhost:5432/erp_db?schema=public" npm run smoke:companies
```
Local DB the app uses: **port 5432**, `postgres:root`, db `erp_db` (per `.env`/`.env.local`). A second Postgres on 5433 exists but is unused/leftover.

**Running app on SQL = VERIFIED (2026-06-29, via in-process probe, now removed):** the real Express app boots in SQL mode (startup validation reads Postgres), serves `/health` (200), enforces auth (401 without a token), creates+initializes a company through the running DI (42–48 accounts, voucher types/forms, fiscal year), and an authenticated owner request `GET /tenant/accounting/accounts` returns **200 with 48 accounts** — full HTTP→auth→tenant→controller→use-case→Prisma→Postgres. (Only the Firebase token *signature* check was stubbed; it's DB-agnostic.)

**Browser end-to-end on SQL = VERIFIED (2026-06-29):** real frontend (Vite) + Firebase Auth emulator + standalone SQL backend (Express on Postgres). Logged in as `sa@test.com` → auth emulator `signInWithPassword` 200 → app routed to the Super Admin portal and rendered, with authenticated API round-trips to the SQL backend all 200 (`/auth/me/permissions`, `/user/preferences`, `/super-admin/overview`). Proves the *whole stack* works on SQL in a browser. (Setup: standalone Express backend on an alt port + the running Auth emulator, to avoid colliding with Codex's production-lane emulators on the default ports.)

**Known gaps (not blockers):**
- **Frontend voucher-forms / forms-designer feature reads Firestore directly (bypasses the SQL API)** — surfaced in browser test as `Failed to load company forms: FirebaseError ... false for 'list'` during inventory setup. Non-fatal (returns `[]`), but voucher-form/designer features won't work on SQL until converted to the API. **Bounded to 5 files.** `src/api/voucherFormApi.ts` already exists to route through. Rest of frontend is API-driven (works on SQL).
  - **Symptom confirmed (2026-06-30):** the **Accounting Init Wizard** builds its selectable voucher-type list from `voucherTypesService.loadSystemVoucherTypeGroups` (Firestore-direct) → empty in SQL → user "selects all" of an empty list → `InitializeAccountingUseCase.copyDefaultVoucherTypes` skips ("if no vouchers selected, skip copying") → company ends with **0 voucher types/forms** (sidebar empty). Workaround used: seeded companies directly via `syncCompanyVoucherTemplatesFromSystem` (16 types/forms each). **Proper fix:** add a backend endpoint exposing SYSTEM voucher types (SYSTEM company has 16: ACC 5 / SALES 5 / PURCHASE 6) + point `voucherTypesService` at it. Note: company *creation* via onboarding also leaves new companies at 0 voucher types until accounting init runs (unlike `SimpleTradingCompanyInitializer`, which seeds them).
  - **Partial fix (2026-06-30):** `loadCompanyForms` ported to `voucherFormApi.list()` + a `VoucherFormResponse→VoucherFormConfig` mapper — **viewing company forms now works on SQL** (zxc company has 16 forms in Postgres; route `GET /tenant/accounting/voucher-forms`, owner bypasses the permission guard). **Still on Firestore (port pending):** in `voucherWizardService.ts` — `loadDefaultTemplates` (system templates), `saveVoucherForm`, `cloneVoucherForm`, `toggleFormEnabled`, `checkFormDeletable`/delete; plus `voucherTypesService.ts` (system types), both `uniquenessValidator.ts`, and `tools/forms-designer/services/documentDesignerService.ts`. These need a system-templates read endpoint + create/update/delete wiring (endpoints exist) before create/edit forms work on SQL.
- **FIXED (2026-06-30): `company-modules.routes.ts` was hardwired to `FirestoreCompanyModuleRepository`** (ignored `DB_TYPE`). In SQL mode the module list + initialize read/wrote **Firestore**, not Postgres — so the frontend never saw SQL-initialized modules and setup wizards looped forever ("inventory wizard won't complete"; accounting init silently written to the wrong DB). Fix: use `diContainer.companyModuleRepository` (Prisma in SQL, Firestore in Firebase — correct for both lanes). Verified: `GET /company-modules/{id}` now returns all modules from Postgres with correct `initialized` flags. ⚠️ Audit other route files for the same hardwired-Firestore-repo pattern.
- **Stale/invalid `user.activeCompanyId` breaks ALL `/tenant` calls (400 "Company Context Required")** — found 2026-06-30 while debugging a silent inventory-wizard failure. `authMiddleware` resolves company context as `headerCompanyId || storedActiveCompanyId`, but when the stored active company points to a deleted company, requests 400 instead of falling back / honoring the `x-company-id` header. Robustness bug (auth should clear or ignore an invalid stored active company). Manifested via leftover test-probe data (a user's active company pointed at a deleted company; also `CreateCompanyUseCase` sets active company but company-delete doesn't reset it). Once the pointer was valid, inventory init + all tenant reads returned 200. **Fix candidates:** in `authMiddleware`, validate the stored active company exists (else null it) and let `x-company-id` take real precedence; on company delete, null out referencing users' `activeCompanyId`.
- **FIXED (2026-07-01): create/update controllers hung forever in SQL mode ("Securing Data…" spinner never resolves).** Root cause: `AccountController.create` (and peers) `await notificationService.notify()` *before* sending the HTTP response; `notify` → `realtimeDispatcher.pushToMany()` was **hardwired to `FirebaseRealtimeDispatcher`** regardless of `DB_TYPE`. In the SQL lane there is no Firebase Realtime DB, so `admin.database().ref().update()` blocks with no timeout — the row IS written to Postgres but the response never returns. Fix: added `NullRealtimeDispatcher` and bound it in `bindRepositories.ts` when `DB_TYPE==='SQL'` (notifications still persist via Prisma; only the RTDB push is skipped). Verified: `notify()` returns in ~150ms in SQL mode. Covers ALL notify-firing controllers at once (they resolve the dispatcher through DI). Firebase lane untouched. Found via live browser QA (account create).
- **FIXED (2026-07-01): two more hardwired-Firebase runtime spots (the "audit other route files" follow-up above).** (1) `CompanyController.ts` instantiated `FirestoreCompanyRepository` at module load → now resolves `diContainer.companyRepository` (Prisma in SQL). (2) `SettingsController.ts` (`/accounting/policy-config` GET/PUT) read/wrote accounting policy settings straight to Firestore via `SettingsResolver`/`FieldValue` → now branches on `DB_TYPE`: SQL routes through `diContainer.accountingPolicyConfigProvider` + `companyModuleSettingsRepository` (company_module_settings, moduleId='accounting'); Firebase path byte-for-byte unchanged. Verified on SQL: getConfig + saveSettings→getSettings round-trip persists, `companyRepository`→`PrismaCompanyRepository`, backend `tsc` 0. Request-path audit for `new Firestore*`/`admin.firestore()`/`admin.database()` is now **clean** (only DB-branched Firebase else-branches remain).
- **Super Admin overview stats return all zeros in SQL mode** (`totalUsers/totalCompanies/...` = 0 though Postgres has 3 users) — the overview aggregation isn't wired for Postgres. Minor reporting gap; the page loads fine.
- Deleting a company that has transactions fails on `voucher_lines→accounts` RESTRICT (documented; cleanup-ordering follow-up). One stale `SMOKE-*` company left in local QA db because of this.
- **Still UNVERIFIED:** cloud deploy (275f: Supabase + Railway/Vercel). **Not merged to `main`.** Detail: `planning/done/275*`, `planning/tasks/DEPLOYMENT-PLAN-SUPABASE.md`. Migration is captured and ready for `prisma migrate deploy`.

> Browser-E2E note: `sa@test.com`'s password in the local Auth emulator was set to `password123` (the repo's `testLogin.ts` convention) during this test.
