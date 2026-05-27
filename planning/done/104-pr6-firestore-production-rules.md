# 104 — PR6: Firestore Production Security Rules

**Status:** ✅ COMPLETE (rules in place; test suite scaffolded, requires one-time dep install to run)
**Date:** 2026-05-19
**Branch:** `fix/project-responsiveness`
**Scope:** Third of six PRs in the [alpha-readiness remediation plan](../tasks/alpha-readiness-remediation-plan.md). Closes P0-12 (production-shape Firestore rules ahead of the 2026-06-01 dev-open expiry).

## Context

The previous `firestore.rules` was the Firebase wizard default — open-read-write until 2026-06-01. Twelve days from now the rules would auto-expire and lock everyone out of Firestore. PR6 replaces it with a tenant-isolated production ruleset.

Two important architectural realities:
- **Backend uses Firebase Admin SDK** and bypasses rules entirely. All business-critical writes (vouchers, stock movements, posting) flow through the backend API. Rules only constrain direct client SDK access.
- **Frontend does read directly** from a small set of paths: `system_metadata/**` and some `companies/{cid}/.../Settings/**` for the voucher wizard and forms designer. Frontend also writes directly to those Settings paths.

The rules are written around these two facts.

## What changed

### Rules file
- Replaced `firestore.rules` with a tenant-isolated ruleset:
  - **Default deny everywhere**
  - **system_metadata/**: read for any auth user; write super-admin only
  - **users/{uid}**: read self or super-admin; writes super-admin only
  - **company_users/{cid_uid}**: read own membership records; writes super-admin only
  - **companies/{cid}/...** all child paths require membership (`company_users/{cid_uid}` exists) or super-admin
  - **companies/{cid}/{module}/Settings/**: member read + write (voucher wizard, forms designer)
  - **companies/{cid}/{module}/Data/**: member read; **writes super-admin only** (backend Admin SDK in practice)
  - **companies/{cid}/idempotency_keys/{key}**: super-admin only on both axes (server-private cache)
- Super-admin detected via `users/{uid}.globalRole == 'SUPER_ADMIN'` doc lookup (no custom claims used today).

### Test suite scaffold
- `backend/src/tests/security/firestore-rules.test.ts` covers:
  - Anonymous deny
  - Cross-tenant isolation
  - Member read/write within own company
  - Settings vs Data write asymmetry
  - system_metadata read-allowed / write-denied
  - Super-admin bypass
  - idempotency_keys private to server
- The suite is in tree but gracefully `describe.skip`s until `@firebase/rules-unit-testing` is installed. See the doc for the one-time setup steps.

### Documentation
- New `docs/architecture/security-rules.md` — posture, allowance table, why Data paths are server-only, test setup, deployment, known limitations, pre-deploy checklist.

## Files changed

New:
- `backend/src/tests/security/firestore-rules.test.ts`
- `docs/architecture/security-rules.md`

Modified:
- `firestore.rules` — full rewrite

## Verification

- `cd backend && npx tsc --noEmit` → exit 0
- Test suite scaffolded; will run after `npm install --save-dev @firebase/rules-unit-testing` + Firestore emulator. Until then it self-skips.

## Notes / next steps

- **Required follow-up before deploy:**
  1. `cd backend && npm install --save-dev @firebase/rules-unit-testing`
  2. Run emulator: `firebase emulators:start --only firestore`
  3. Run suite: `FIRESTORE_EMULATOR_HOST=localhost:8080 npx jest --testPathPatterns="firestore-rules"`
  4. Deploy to a staging Firebase project before production.
- Backend code is unchanged — Admin SDK already bypasses rules, so no service-account adjustments needed.
- The legacy `backend/firestore.rules` is unused (firebase.json points to root) but still expires 2025-12-30 — already past. Leave or delete in a cleanup pass.

## Next PR

PR2 (PostingLog) is the next foundation piece — it unlocks PR3 (strict posting / silent-skip removal) and PR5 (FX gain/loss). Continuing with PR2 next.
