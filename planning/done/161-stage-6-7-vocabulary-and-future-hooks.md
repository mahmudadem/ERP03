# Task 161 — Posting Authority Stages 6 & 7: Vocabulary Cleanup + Future Hooks (Docs)

**Status:** ✅ Complete
**Date completed:** 2026-06-03
**Branch:** main (worktree `D:/DEV2026/ERP03-posting-authority`)
**Time spent:** ~0.5h
**Linked plan:** [`planning/briefs/20260603-posting-authority-fix-plan.md`](../briefs/20260603-posting-authority-fix-plan.md) — Stages 6 & 7
**Linked architecture doc:** [`docs/architecture/posting-authority.md`](../../docs/architecture/posting-authority.md) §2 Law 3, §6

---

## Definition of Done — Checklist

- [x] Code merged (docs-only; no code change needed — see below)
- [x] `docs/architecture/posting-authority.md` updated (Law 3 vocabulary note, §6 future hooks expanded, conformance table)
- [x] User guide — N/A
- [x] This completion report
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### Stage 6 — Vocabulary cleanup (already satisfied; verified + documented)

The plan asked to purge the "ticket" metaphor and standardize on override reason `{ reason,
overriddenBy }`. **This was already true in the codebase** from prior staged work:

- **Zero `ticket`-named identifiers** in `backend/src` (verified: `grep -rniE "ticket" backend/src`
  returns nothing in code; the only matches were "support ticket"-style unrelated text).
- The override shape is **uniformly `{ reason, overriddenBy }`**, enforced by the domain entities:
  - `PeriodLockOverride` (`domain/accounting/entities/PeriodLockOverride.ts`) — requires non-empty
    `reason` + `overriddenBy`.
  - `CreditOverride` (`domain/sales/entities/CreditOverride.ts`) — same shape.
  - The posting payload (`SalesController` → `{ reason: periodLockOverrideReason, overriddenBy: userId }`)
    matches.
- The two doc mentions of "ticket" already explained it is *not* a ticket object.

**Change made:** documentation only — Law 3 now records that the vocabulary is standard throughout,
and the conformance table marks Stage 6 ✅. No code change (none was warranted; inventing one would be
churn).

### Stage 7 — Future hooks (document only; DO NOT BUILD)

Expanded `posting-authority.md` §6 to fully record the two designed-for-but-unbuilt hooks, with an
explicit "do not build without go-ahead" marker and AND-gating notes:

1. **Request-gating in a module guard** — a module gates *who may request* an override; accounting
   still independently decides. Maps onto forms + permissions; never overrules the accounting guard.
2. **Account-level caps at the accounting guard** — per-COA-account exposure ceilings as a new
   accounting policy; distinct from the Sales credit limit; AND-gated, stricter wins.

Both would flow through the existing `PostingGateway` door and the uniform rejection contract — no new
bypass. **No code written.**

### Files Changed

- `docs/architecture/posting-authority.md` — Law 3 vocabulary note; §6 expanded (Stage 7);
  conformance table rows for Stages 6 & 7; "Remaining" footer points to Stage 4b only.
- `planning/briefs/20260603-posting-authority-fix-plan.md` — status section: all stages 0–7 marked
  complete; Stage 4b recorded as the sole optional follow-up.

### Verification

- [x] `grep -rniE "ticket" backend/src` → no code identifiers (metaphor purged).
- [x] Override shape uniform `{ reason, overriddenBy }` — confirmed in both override entities.
- [x] No code change → no test impact. (Full backend suite remained green as of Stage 5: 139 suites,
  1307 passed.)

### Known Issues / Follow-ups

- **Stage 4b** (the only remaining posting-authority work) — fold system-voucher exemptions into the
  policy set. Behavioural; `erp-reviewer` first.

---

## 2. End-User View

No user-facing change. Internal documentation now fully records how period-lock / credit overrides
work (a reason + who approved it) and what controls are planned but deliberately not yet built.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
