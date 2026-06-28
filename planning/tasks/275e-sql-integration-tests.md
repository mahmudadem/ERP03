# Task 275e — SQL integration tests (real Postgres, per module)

**Epic:** [275 — Supabase Launch](./275-supabase-launch-epic.md) · **Depends on:** 275c, 275d · **Est:** 3–5 days
**Branch:** `feat/275e-sql-integration-tests`

## Objective
Add automated integration tests that run the Prisma repositories against a **real PostgreSQL** (not mocks), so SQL-mode correctness is protected by CI, not just manual smoke testing.

## Why
All 324 existing tests mock Firestore; the Prisma repos have zero coverage. Without real-DB tests, every future change risks silently breaking SQL mode — unacceptable for financial data.

## Context / references
- Switch guide §4.4 (no integration tests exist) and §5 (module-by-module checklist — use as the test matrix).
- `PrismaTransactionManager` for multi-table transactional flows.

## Scope (files)
- New `backend/src/tests/integration/sql/**` (or similar), with setup that spins up/points at a test Postgres (Docker service or `DATABASE_URL_TEST`), runs `prisma db push` + seed, and tears down between suites.
- A CI job (or documented local command) to run them; do not slow the default unit suite.

## Coverage (minimum: one meaningful flow per v1 module)
- Accounting (voucher post → ledger → trial balance), Inventory (movements + stock level + cost), Sales (SI post), Purchases (PI post), RBAC (role assign + permission check), Core (company + settings + module enable), POS (open shift → sale → close).

## Acceptance criteria
- [ ] At least one real-Postgres integration test per v1 module, all green.
- [ ] Tests are isolated/repeatable (clean state per run) and runnable in CI.
- [ ] Surface and fix any new bug they reveal (or log as a tracked blocker if large).
- [ ] Unit suite + Firestore path remain green.

## Audit gate (CTO checks)
CTO runs the integration suite against a clean Postgres twice (confirms isolation/repeatability) and reviews that the assertions check real outcomes (ledger ties, stock correct), not just "no throw".

## Out of scope
UI/e2e tests; AI module; exhaustive coverage (one solid flow per module is the bar for launch).
