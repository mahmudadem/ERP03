# Firestore Security Rules

**Last updated:** 2026-05-19
**Status:** Production-shape rules in place (replaces dev-open rules that expired 2026-06-01). Test suite scaffolded; requires `@firebase/rules-unit-testing` install + emulator to run.
**File:** [`firestore.rules`](../../firestore.rules) (deployed) — `backend/firestore.rules` is leftover and unused.

---

## Architectural context

- **Backend writes use Firebase Admin SDK**, which **bypasses these rules entirely**. All business-critical writes — voucher posting, stock movements, AR/AP balances, idempotency cache — flow through the backend API which authorizes via `authMiddleware` + tenant context. The rules below only constrain **direct client SDK access**.
- **Frontend reads some data directly from Firestore**, primarily:
  - `system_metadata/voucher_types/items/**` (system templates — COA, voucher types, currencies)
  - `companies/{cid}/accounting/Settings/voucherForms/**` (voucher wizard)
  - `companies/{cid}/{module}/Settings/voucher_types/**` (forms designer)
  - `companies/{cid}/documentTypes/**`, `companies/{cid}/voucherTypes/**`
- **Frontend writes** are limited to settings paths under `companies/{cid}/{module}/Settings/**` (voucher wizard and forms designer). Everything else routes through backend POSTs.

## Posture

- **Default deny.** Every match block has an explicit allow rule with a condition.
- **Three identity tiers:**
  - **Anonymous** — denied everywhere.
  - **Authenticated user** — can read `system_metadata/**` and own profile (`users/{uid}`).
  - **Authenticated member of company X** — can read `companies/{X}/**` and write to `companies/{X}/{module}/Settings/**`. Cannot write to Data paths (backend-only).
  - **Super-admin** — `users/{uid}.globalRole == 'SUPER_ADMIN'` grants full bypass.

## Membership lookup

A user is a member of company `cid` when `company_users/{cid}_{uid}` exists. This is the existing identifier pattern from `FirestoreCompanyUserRepository` (see `backend/src/infrastructure/firestore/repositories/core/FirestoreCompanyUserRepository.ts:14`).

The membership check runs as `exists(/databases/$(database)/documents/company_users/$(cid + '_' + uid))`, which is one Firestore read per request — the standard cost for rule-based authorization without custom claims.

## What is allowed / denied

| Path | Read | Write |
|---|---|---|
| `system_metadata/**` | Any auth user | Super-admin only |
| `users/{uid}` | Self or super-admin | Super-admin only |
| `company_users/{cid_uid}` | Self (own id) or super-admin | Super-admin only |
| `companyUsers/{docId}` (legacy) | Owner or super-admin | Super-admin only |
| `companies/{cid}` (root) | Member of cid or super-admin | Super-admin only |
| `companies/{cid}/{module}/Settings/**` | Member of cid | Member of cid |
| `companies/{cid}/{module}/Data/**` | Member of cid | Super-admin only (backend Admin SDK in practice) |
| `companies/{cid}/documentTypes/**` | Member of cid | Super-admin only |
| `companies/{cid}/voucherTypes/**` | Member of cid | Member of cid |
| `companies/{cid}/modules/{moduleCode}` | Member of cid | Super-admin only (backend writes init state) |
| `companies/{cid}/idempotency_keys/{key}` | Super-admin only | Super-admin only |
| `companies/{cid}/**` (catch-all) | Member of cid | Super-admin only |
| Everything else | Denied | Denied |

## Why Data paths block client writes

Vouchers, stock movements, AR/AP balances, fiscal-year state — everything under `Data/**` — must go through the backend posting engine for double-entry validation, idempotency, and PostingLog audit (forthcoming in PR2). Allowing a client to write directly would bypass the entire policy stack. The Admin SDK that the backend uses ignores rules, so legitimate backend writes still work.

## Test suite

[`backend/src/tests/security/firestore-rules.test.ts`](../../backend/src/tests/security/firestore-rules.test.ts) covers:

- Anonymous read/write denied
- Cross-tenant isolation (user in A cannot read/write B)
- Members can read company data and write Settings
- Members cannot write Data paths
- `system_metadata` read-allowed / write-denied for auth users
- Super-admin bypass for read and write
- `idempotency_keys` private to super-admin (server-only)

**The suite is in tree but does not run yet.** To enable:

1. `cd backend && npm install --save-dev @firebase/rules-unit-testing`
2. Start the Firestore emulator: `cd .. && firebase emulators:start --only firestore`
3. In a second shell: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 npx jest --testPathPatterns="firestore-rules"`

Until installed, the suite gracefully skips via `describe.skip`.

## Deployment

Rules deploy via `firebase deploy --only firestore:rules`. The deploy is atomic — a syntax error in the file fails the deploy without changing prod.

**Smoke-test before any production deploy:**
1. Run the emulator suite above (after enabling).
2. Use the Firebase console Rules Playground to test the key paths manually.
3. Deploy to a staging Firebase project before production.

## Known limitations

- **Custom claims not used.** Membership is verified via Firestore doc lookups, which costs one extra read per rule evaluation. Migration to custom claims (set on company join, e.g. `companyIds: [cid1, cid2]`) would eliminate that read and make rules faster.
- **No rate limiting in rules.** Abuse mitigation should happen at the API tier (rate limiter middleware) or via App Check.
- **Frontend voucher wizard writes Settings directly.** This is convenient but mixes client-side trust with backend-driven posting. A future refactor should route all Settings writes through the backend so the rules can deny client writes everywhere except `users/{uid}` self-updates.

## Pre-deploy checklist

- [ ] `@firebase/rules-unit-testing` installed
- [ ] Emulator suite passes locally
- [ ] Staging deploy completes; frontend smoke-tests pass against staging
- [ ] Backend service account confirmed using Admin SDK (not client SDK)
- [ ] Rollback plan: prior `firestore.rules` archived; one-line revert ready
