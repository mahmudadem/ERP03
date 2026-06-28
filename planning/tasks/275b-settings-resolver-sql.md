# Task 275b — Implement `SettingsResolverSQL` (remove the stub)

**Epic:** [275 — Supabase Launch](./275-supabase-launch-epic.md) · **Depends on:** none · **Est:** ~1 day
**Branch:** `feat/275b-settings-resolver-sql`

## Objective
`backend/src/infrastructure/prisma/SettingsResolverSQL.ts` currently returns `null` for all methods. Any SQL-mode code path that resolves settings through it will throw (`Cannot read property 'X' of null`). Replace the stub with a correct implementation.

## Why
A silent landmine: it "works" until a code path depends on a resolved setting, then crashes at runtime under `DB_TYPE=SQL`. Must be fixed before broad smoke testing (275c) so failures there are real bugs, not this known stub.

## Context / references
- Stub: `backend/src/infrastructure/prisma/SettingsResolverSQL.ts`.
- Firestore counterpart for behavior reference: `backend/src/application/common/services/SettingsResolver.ts` and how the Firestore repos consume it.
- Switch guide §4.3 documents the stub.

## Scope (files)
- `backend/src/infrastructure/prisma/SettingsResolverSQL.ts` (primary).
- Only touch a consumer if it assumes Firestore-specific collection-path semantics that don't apply to SQL — document any such change in the completion report.

## Steps
1. Enumerate every method the interface exposes and every caller in SQL mode.
2. Implement each to return correct values from Postgres (or a defensible non-null default where the concept doesn't apply to SQL — justify in code comments).
3. Add a focused unit test asserting no method returns `null` for valid inputs and that values match the Firestore resolver's intent.

## Acceptance criteria
- [ ] No method returns `null` for valid inputs; behavior matches the Firestore resolver's intent.
- [ ] Focused test added and green.
- [ ] `tsc --noEmit` clean; `DB_TYPE=FIRESTORE` path unaffected.

## Audit gate (CTO checks)
Read the diff for any non-null default and confirm its justification. Run the new test. Confirm no settings-dependent path can still hit a `null` from this class.

## Out of scope
Refactoring the settings architecture; changing Firestore resolver behavior.
