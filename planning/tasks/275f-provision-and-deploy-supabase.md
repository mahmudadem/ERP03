# Task 275f — Provision Supabase + deploy backend/frontend (staging)

**Epic:** [275 — Supabase Launch](./275-supabase-launch-epic.md) · **Depends on:** 275c, 275e · **Est:** 3–5 days
**Branch:** `feat/275f-provision-and-deploy-supabase`

## Objective
Stand up the real cloud deployment: Supabase Postgres (provisioned, schema pushed, seeded), backend on Railway, frontend on a static host, auth wired (Firebase, kept), and a full UI smoke test passing on the staging URL.

## Why
The exit of the epic: a real user logs in and runs full document flows on a deployed environment — proving the Supabase launch path end-to-end.

## Context / references
- Strategic plan §Phase 3; switch guide §1 (what stays Firebase: tokenVerifier, realtimeDispatcher, firebaseAdmin) and §3.
- Host decision: Railway (backend), static host for the Vite frontend.

## Steps
1. **Supabase:** create project; get the connection string (Settings → Database → URI); set `DATABASE_URL` (use the pooled connection for the app, direct for migrations). `prisma migrate deploy` (use real migrations, not `db push`, for production) → `npm run seed:sql`.
2. **Backend (Railway):** deploy the Node service (long-running, not Firebase Functions); set env: `DB_TYPE=SQL`, `DATABASE_URL`, Firebase admin credentials (as secrets — never in git), CORS allow-list for the frontend origin.
3. **Frontend:** build (`npm run build`) and deploy to the static host; point API base URL at the Railway backend; keep Firebase Auth client config.
4. **Auth:** provision the production Firebase project for Auth only; verify token verification works against the deployed backend.
5. **Smoke test on staging:** log in → create tenant → run Sales + Purchase full flows → verify reports. Use the switch-guide module checklist.

## Acceptance criteria
- [ ] Migrations applied + system data seeded on Supabase; ~105 tables present.
- [ ] Backend live on Railway with `DB_TYPE=SQL`; secrets in the host's secret store, not git.
- [ ] Frontend live, talking to the backend, login works (Firebase).
- [ ] A real user completes login → tenant → SI post → PI post → view reports on the staging URL.
- [ ] Rollback noted: revert toggle / redeploy previous image; `DB_TYPE=FIRESTORE` remains an emergency fallback.

## Audit gate (CTO checks)
CTO performs the staging smoke test personally (or reviews a recorded run), confirms no secret is committed (`git log`/diff scan), and confirms reports render correctly from Postgres.

## Out of scope
Production hardening (Sentry, automated backups beyond Supabase defaults, CI/CD auto-deploy, rate-limiting) → follow-up. Custom domain/TLS can be staging-default for now.

## Definition of Done (per AGENTS.md)
Update `docs/architecture/deployment-modes.md` (cloud mode now concrete), create `docs/user-guide/deployment/` if user-facing, write `planning/done/275f-*.md`, append `JOURNAL.md`, update `ACTIVE.md`.
