# Firebase Functions: 1st → 2nd gen migration + warm instances

> **Lane:** Production (`ERP03-unified`, branch `codex/unified-firestore-deploy-20260628`).
> **Sequencing:** ⛔ **Do this AFTER the current production bug batch is fixed, deployed, and confirmed stable.**
> Change one thing at a time — never migrate the runtime *and* land bug fixes in the same deploy.
> **Why now-ish:** still early production, ~no live users → the migration's brief downtime + URL change is painless. It gets riskier the more real users you have.

---

## What this fixes (and what it doesn't)

- ✅ Fixes: cold-start slowness, poor burst handling (1st gen = 1 request per instance), cheaper warm instances.
- ❌ Does NOT fix: application bugs / 500s. Those are correctness work (Codex). Keep the two separate.

---

## Phase 0 — Quick win FIRST (no migration needed)

Before migrating, get immediate relief from cold-start pain on the **existing 1st gen** function:

- [ ] In `backend/src/index.ts`, add `minInstances: 1` to the existing `runWith({...})` block.
- [ ] `cd backend && npm run build`
- [ ] `firebase deploy --only functions --project erp-03`
- [ ] Verify the app no longer "hangs on first load."
- [ ] Note: a warm instance bills even when idle (~$5–15/mo for one 512MB instance). Acceptable for testing sanity.

This alone removes most of the daily testing misery. Do the full migration below when ready.

---

## Phase 1 — Pre-flight (before changing anything)

- [ ] Confirm the bug batch is merged/deployed and prod is stable (health check green).
- [ ] Tag a rollback point: `git tag backup/before-2ndgen` and push.
- [ ] Note the **current** function URL: `https://us-central1-erp-03.cloudfunctions.net/api`.
- [ ] Confirm Firebase CLI + project: `firebase --version`, `.firebaserc` → `erp-03`.
- [ ] Pick a low-traffic window (there will be a brief outage when the old function is deleted).

## Phase 2 — Code changes (1st gen → 2nd gen syntax)

- [ ] Switch imports from `firebase-functions` (v1) to `firebase-functions/v2/https` (v2).
- [ ] Replace `functions.runWith({ memory, timeoutSeconds }).https.onRequest(...)`
      with `onRequest({ memory: '512MiB', timeoutSeconds: 120, minInstances: 1, concurrency: 80, region: 'us-central1' }, handler)`.
      - 2nd gen `concurrency` lets ONE instance serve many requests at once — the main scaling win.
      - Memory units change in v2 (`512MiB`, not `512MB`).
- [ ] Bump `firebase-functions` package to a version that supports v2 if needed; `npm install`.
- [ ] Keep the existing cold-start "await server init" guard — still useful.
- [ ] `cd backend && npm run build` → fix any type errors.

## Phase 3 — The gotchas (this is where 2nd gen surprises people)

- [ ] **Function URL changes.** 2nd gen uses a Cloud Run-style URL (e.g. `https://api-xxxxxxxx-uc.a.run.app` or a `run.app` domain), NOT the old `cloudfunctions.net/api`.
  - [ ] Update the **frontend API base URL** to the new address (search the frontend for the old `cloudfunctions.net/api` string).
  - [ ] Re-test CORS against the new origin/URL.
- [ ] **Public access (403 trap).** 2nd gen functions are private by default and return **403** until you grant invoker:
  - [ ] Allow unauthenticated invocations (Cloud Run "allUsers" invoker) for the `api` service, or set it during deploy when prompted.
- [ ] **Env / secrets.** v2 prefers Firebase **secrets/params** over bundled `.env`. Re-confirm config is read correctly; keep the `DB_TYPE=SQL` landmine rule (never in deployed env).
- [ ] **Old function deletion.** You generally can't convert in place — deploy the new 2nd gen function (new name OR accept replace), then delete the old 1st gen `api`.

## Phase 4 — Deploy + verify

- [ ] `firebase deploy --only functions --project erp-03` (deploy the new 2nd gen function).
- [ ] Grant public invoker if not done; confirm no 403.
- [ ] Hit the new URL live: expect normal responses, **no 503 "Server not ready"**, fast (warm).
- [ ] Smoke test from the frontend end-to-end (login → list → save) against the new URL.
- [ ] Delete the old 1st gen function once the new one is confirmed working.

## Phase 5 — Tune for scale (when approaching real traffic)

- [ ] Set `minInstances` to 2–3 for expected concurrency.
- [ ] Tune `concurrency` (start ~80) and `maxInstances` (cap cost).
- [ ] Clean up Firestore read patterns (batch reads, avoid hotspot single-doc writes) — biggest cost/speed lever at 100+ users.
- [ ] Confirm region is closest to your users.

## Rollback

- [ ] If the 2nd gen function misbehaves: re-deploy the 1st gen version from `backup/before-2ndgen`, revert the frontend URL, redeploy frontend. Old `cloudfunctions.net/api` URL returns.

---

## One-line summary
Warm instance now (Phase 0) for sanity; full 2nd gen migration as a deliberate, dedicated task after bugs are stable — mind the **URL change → frontend update** and the **403 public-access** gotchas.
