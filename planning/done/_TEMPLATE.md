# Task NN — <Feature Name>

> **Template note:** Copy this file as `NN-feature-name.md` (next number in sequence) and fill in. Delete this blockquote when done.

**Status:** ✅ Complete
**Date completed:** YYYY-MM-DD
**Branch:** <git branch>
**Time spent:** ~Xh
**Linked plan:** [`planning/tasks/NN-feature-name.md`](../tasks/NN-feature-name.md) *(if a plan existed)*
**Linked architecture doc:** [`docs/architecture/<module>.md`](../../docs/architecture/<module>.md)
**Linked user guide:** [`docs/user-guide/<module>/<feature>.md`](../../docs/user-guide/<module>/<feature>.md)

---

## Definition of Done — Checklist

Before marking this task done, every box must be ticked:

- [ ] Code merged
- [ ] `docs/architecture/<module>.md` updated or created — technical doc for future engineers
- [ ] `docs/user-guide/<module>/<feature>.md` created — plain-language guide for end users
- [ ] This completion report links both docs above
- [ ] `planning/JOURNAL.md` appended with session summary
- [ ] `planning/ACTIVE.md` updated with next task

If any box is unchecked, the task is **not** done.

---

## 1. Technical Developer View

> **Audience:** Future SWEs reading the handoff. They need to understand WHAT changed, WHERE, and WHY.

### What Was Built

<One paragraph: the problem this solved and the approach taken.>

### Files Changed

**Backend**
- `backend/src/<path>/<file>.ts` — <what changed>

**Frontend**
- `frontend/src/<path>/<file>.tsx` — <what changed>

**Docs**
- `docs/architecture/<module>.md`
- `docs/user-guide/<module>/<feature>.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

### Architecture / Behavior

<Bullet points on key design decisions, data model changes, API contracts, validation rules, or notable behaviors. Reference the architecture doc for details.>

### Verification

- [ ] `cd backend && npx tsc --noEmit` clean
- [ ] `cd frontend && npx tsc --noEmit` clean
- [ ] `cd frontend && npm run build` clean
- [ ] Manual test of golden path
- [ ] Manual test of edge cases: <list>

### Known Issues / Follow-ups

<Anything intentionally deferred or discovered during the work. Use plain bullets — no surprises in the handoff.>

---

## 2. End-User View

> **Audience:** The product owner or end users. Plain language. No code.

### What's New

<One paragraph in everyday language: what changed in the product and why a user should care.>

### How to Use It

1. <Step one>
2. <Step two>
3. <Step three>

### Where to Find It

- Menu: <e.g., Accounting → Reports → Profit & Loss>
- URL: `/accounting/reports/p-and-l`
- Required permission: <role/permission name>

### Tips

- <Useful tip 1>
- <Useful tip 2>

### Limitations

- <Known limitation>
- <What this does not yet support>

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
