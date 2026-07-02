# Parity Ledger — Firestore catching up to SQL-first development

> Policy: **SQL leads, Firestore follows** (owner decision 2026-07-02 — see `ROADMAP-PILOT.md`).
> Every SQL-first feature PR adds one row here with its Firebase-impact class.
> Reviewed at each parity review (~every 5 features / 2 weeks); owner decides catch-up vs defer.

**Classes:**
- **A** — DB-agnostic, works on both automatically. Listed for the record only.
- **B** — needs Firestore adaptation (repo methods / indexes / seeders). Carries an estimate.
- **C** — SQL-only by nature (relational aggregation, DB-level constraints). Owner decides if the
  Firebase lane needs an equivalent.

| Date | Feature / PR | Class | Firebase impact & estimate | Status |
|------|--------------|-------|----------------------------|--------|
| — | *(no entries yet — ledger starts with the first SQL-first feature PR)* | | | |

## Known pre-existing gaps (SQL side, carried from Epic 275 — for symmetry)

These are places where the **SQL** lane still trails Firestore; tracked here so one document shows
both directions of drift:

| Gap | Where | Status |
|-----|-------|--------|
| 4 frontend files Firestore-direct (voucher wizard save/clone/toggle/delete, 2× uniqueness validators, document designer) | forms-designer / voucher-wizard | Phase 1 task S4 |
| **NotificationBell subscribes to Firebase RTDB → bell permanently empty on SQL** (notifications DO persist in Postgres; needs API polling/SSE fallback) | `frontend/src/components/NotificationBell.tsx:81` | Found by lifecycle audit 2026-07-02; queue Phase 1 |
| Stale/invalid `user.activeCompanyId` → 400 "Company Context Required" on ALL /tenant calls | `authMiddleware` company-context resolution | Bites both lanes; queue Phase 1 (task S5) |
| Super-admin overview stats return zeros in SQL mode | super-admin aggregation | Minor; queue for Phase 2 |
| Company delete fails on FK RESTRICT (voucher_lines→accounts) | SQL delete ordering | Documented follow-up |
| AI module: 12 repos Firestore-only (module OFF for v1) — confirm AI routes fail cleanly in SQL mode | AI module routes | 5-min check, queued |
| `bundleRegistryRepository as any` cast in onboarding wiring | `OnboardingController.ts:253` | Cleanup, low risk |

## Parity review log

| Review date | Cycle covered | Owner decision |
|-------------|---------------|----------------|
| — | — | — |
