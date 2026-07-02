# SQL Lifecycle Readiness Audit — signup → company → bundles → module init → daily ops

**Author:** Claude (CTO) — first-hand verification, not doc claims
**Date:** 2026-07-02
**Method:** static audit of every lifecycle code path (DI bindings, controllers, frontend
Firebase usage) + live runs where claims were load-bearing. Trigger: owner's concern that the
whole lifecycle was only ever exercised on Firebase.

## Verdict

**The lifecycle chain is structurally SQL-ready — better than feared.** The request path and DI
layer are genuinely dual-database end to end. The audit found **one new real gap**
(NotificationBell), re-confirmed **three known ones**, and identified exactly what remains
*runtime-unverified* (browser walk-throughs — which is Phase 1's job). No architectural holes.

## Stage-by-stage findings (evidence per line)

| # | Lifecycle stage | Verdict | Evidence |
|---|----------------|---------|----------|
| 1 | **Signup / user creation** | ✅ structurally clean; runtime ⚠️ unverified | `OnboardingController` → `SignupUseCase(diContainer.userRepository)` → Prisma in SQL. Login + `/auth/me/permissions` proven in browser E2E (2026-06-29); *brand-new signup* never executed on SQL → QA item |
| 2 | **Plans & bundles listing** | ✅ verified | `planRegistryRepository.getAll()` / `bundleRegistryRepository.getReady()` — both DB-branched (`bindRepositories.ts:999–1016`); seed data present (see #5). Smell: `bundleRegistryRepository as any` cast at `OnboardingController.ts:253` — cleanup item, not a bug found |
| 3 | **Company creation + entitlements** | ✅ runtime-proven | Fully DI-routed; `smoke:companies` on real Postgres: 2 companies end-to-end (COA 48 accts, 16 voucher types/forms, FY, balanced journal) |
| 4 | **Module initialization** | ✅ fixed & verified (2026-06-30/07-01) | `company-modules.routes` de-hardwired to DI; accounting-init voucher catalog ported to API (`42bcbb46` on main); known robustness bug remains: stale `activeCompanyId` → 400 on ALL `/tenant` calls |
| 5 | **System data on a fresh SQL DB** | ✅ **VERIFIED LIVE TODAY** | `npm run seed:sql` ran clean against the current (post-275-remediation) schema: SYSTEM company, currencies, metadata, business domains, module registry, permission registry, **20 bundles, 5 plans**, 6 role templates, 10 COA templates, 16 voucher type definitions. Idempotent (upsert-based) — re-runnable. The old claim "seeders are Firestore-only" is **obsolete** |
| 6 | **Daily operations data layer** | ✅ proven (2026-06-30/07-01) | 25/25 integration across all modules + 7/7 UI-thrower probes on real Postgres |
| 7 | **Frontend direct-Firebase usage** | ⚠️ 5 real files total | Whole-frontend sweep: only `config/firebase.ts` (init, fine), the 4 known designer/wizard files (admin tools — Phase 1 task S4), and **NEW: `NotificationBell.tsx`** (below) |
| 8 | **NotificationBell — NEW GAP** | ❌ dead on SQL | Subscribes to Firebase RTDB (`ref(rtdb, notifications/...)`, `NotificationBell.tsx:81`). In SQL mode `NullRealtimeDispatcher` never pushes → bell remains permanently empty although notifications persist in Postgres. Fix: poll the notifications API (repo + endpoint exist) or SSE; keep RTDB path for Firebase lane |
| 9 | **Deployment Diagnostics page** (shipped 2026-07-02) | ✅ DB-branched | SQL → Prisma `SELECT 1`; Firestore path only in else-branch (`DeploymentDiagnosticsController.ts:80–87`). Reusable as SQL-staging health check |
| 10 | **AI module** | 🟡 SQL-unsupported by design | 12 repos are Firestore-only (lazy DI getters — nothing crashes at boot). AI is OFF for v1 (locked). Check item: confirm AI routes are guarded/disabled in SQL mode so a stray call fails cleanly |
| 11 | **Firebase Storage / FCM** | ✅ non-issue | Frontend uses NO `firebase/storage` anywhere; Auth/Storage/FCM stay Firebase per locked decision |
| 12 | **Backend request-path hardwiring** | ✅ clean | Sweep of `admin.firestore()/new Firestore*/admin.database()/.collection(` outside `infrastructure/`: only scripts/seeders/tests/migrations + properly DB-branched controllers. DI diff: every non-AI repo has a Prisma twin (134 vs 122 explained by AI×12 + naming aliases — verified individually) |

## What remains genuinely UNVERIFIED on SQL (the honest list)

1. **Browser click-through of the full lifecycle** — signup → create company → select bundle →
   init modules → first transactions. Structure says it works; only a real browser run proves it.
   *(= Phase 1 task S3, extended to start from signup, not login.)*
2. **NotificationBell** on SQL (will fail until the gap above is fixed).
3. **Cloud deploy** — unchanged; zero infra exists (Phase 0 Track S).
4. AI-route guarding in SQL mode (5-minute check, queued).

## Actions fed into the plan

- PARITY-LEDGER known-gaps updated: + NotificationBell (frontend realtime), + stale
  `activeCompanyId` 400 bug, + AI-route guard check, + `as any` cast at OnboardingController:253.
- Phase 1 S3 scope extended: browser QA starts at **signup**, not login.
- `seed:sql` is confirmed as the Phase 0 S1 provisioning step (rehearsed locally today).
