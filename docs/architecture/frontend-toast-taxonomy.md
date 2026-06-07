# Frontend Feedback Taxonomy

Status: P0 contract — enforced by `frontend/scripts/check-no-confirm.mjs` (runs on `npm run build`).

This document defines the eight feedback categories the ERP03 frontend must use for every user-visible message. The categories are distinct **in color, icon, persistence, and copy template** so users learn at a glance whether they are looking at a confirmation, a policy block, a permission denial, or a real system failure.

The contract is normative for new code and for any page touched during Task 132 chrome hardening. Existing legacy usages are tracked in `frontend/scripts/check-no-confirm.allowlist.json` and must shrink to zero.

---

## Why this exists

ERP users judge whether they can trust a financial system by how it speaks back to them. Three failure modes from the pre-Task-132 baseline:

1. **Raw `window.confirm` / `alert`** bypass i18n, theme, RTL, and the ConfirmDialog tone system. They look like a browser bug, not an ERP confirmation.
2. **Generic "Error" toasts** hide whether the cause is user input, business policy, missing setup, missing permission, transient network failure, or a real integrity issue — so users can't tell which problem to escalate.
3. **Posting-reversal confirms** were the same modal as "delete this UI preference" — no visual or persistence signal that one of them rewrites the ledger.

The taxonomy below makes the cause readable from the message alone.

---

## The eight categories

| # | Category | When to trigger | Tone / color | Icon | Persistence | Component |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Success** | Action completed cleanly. | Green | check | 3s auto-dismiss | `errorHandler.showSuccess` |
| 2 | **Info / no-op** | Idempotent action; nothing to do; informational. | Blue | info-circle | 3s auto-dismiss | `errorHandler.showInfo` |
| 3 | **Validation error** | Field-level input rejected by client-side or server-side validation. | Amber | warning | until dismissed | `errorHandler.showWarning` (or inline field error) |
| 4 | **Business policy block** | Domain rule rejected the action (e.g. period locked, credit hold, posting closed). | Amber | lock | until dismissed | `errorHandler.showWarning` with policy code |
| 5 | **Missing setup** | A required configuration is absent (e.g. vendor has no AP account, no fiscal year open). | Blue | gear | until dismissed | `errorHandler.showInfo` with link to setup |
| 6 | **Permission block** | Role/scope denied. | Gray | shield | 5s auto-dismiss | `errorHandler.showWarning` with "Contact admin" line |
| 7 | **System / network error** | API timeout, 5xx, transport failure. | Red | alert-triangle | until dismissed | `errorHandler.showError` |
| 8 | **Critical / integrity error** | Tenant scope mismatch, double-post, ledger inconsistency, security tripwire. | Red + modal | alert-octagon | requires acknowledgement | `errorHandler.showError({ useModal: true, severity: CRITICAL })` |

Confirmations (not feedback) are a separate concern handled by `useConfirm()` (see below).

---

## Copy templates

Every message must answer two questions: **what happened?** and **what should I do?**

| Category | Template | Example |
| --- | --- | --- |
| Success | `<Subject> <past-verb>.` | "Invoice INV-1042 posted." |
| Info | `<observation>.` | "No new records to import." |
| Validation | `<field>: <constraint>.` | "Quantity must be greater than 0." |
| Policy block | `<rule>. <how-to-proceed>.` | "Period 2026-03 is locked. Use **Override** if you have authority, or unlock the period in Accounting → Settings → Fiscal." |
| Missing setup | `<missing>. <where-to-fix>.` | "AP account not set for vendor *Acme Ltd*. Open vendor card → Accounts." |
| Permission | `You don't have permission to <action>.` | "You don't have permission to post invoices. Contact a Controller or CFO." |
| System | `Couldn't <verb>. <next-step>.` | "Couldn't reach the server. Retrying in 5 s…" |
| Critical | `Critical: <what>. <who-to-contact>.` | "Critical: voucher number collision detected. Contact a system administrator before retrying." |

Bad copy that violates the template (and should not pass review): `"Error"`, `"Something went wrong"`, `"Operation failed"`, `"Are you sure?"` without context.

---

## Confirmations (separate from feedback)

Confirmations ask the user before doing something. They are **not** toasts. Use `useConfirm()`:

```tsx
import { useConfirm } from '@/hooks/useConfirm';

const { confirm, confirmDialog } = useConfirm();

const handleUnpost = async () => {
  const ok = await confirm({
    title: 'Unpost Purchase Invoice',
    message: 'This will reverse all accounting and inventory entries posted for this invoice.',
    confirmLabel: 'Unpost Invoice',
    tone: 'danger',
  });
  if (!ok) return;
  await api.unpost(id);
};

return <>{...page...}{confirmDialog}</>;
```

### Tone selection

| Tone | Use for |
| --- | --- |
| `info` | Routine confirmations with no irreversible side effect. |
| `warning` | Side effects on shared state (status change, status transition, role promotion). |
| `danger` | Destructive or hard-to-reverse operations (delete, unpost, demote, revoke, impersonate). |

Posting-reversal actions (Unpost SI / PI / GR / PR / etc.) **must** use `tone: 'danger'`. The confirm button label must name the specific verb (e.g. `Unpost Invoice`, not `Confirm`).

---

## Banned patterns (enforced)

- `window.confirm(...)` — replaced by `useConfirm()`.
- bare `alert(...)` — replaced by `errorHandler.showWarning` / `showError` (or `showInfo` for stubs).
- `toast(...)` called outside the `errorHandler.*` wrappers — go through the wrapper so persistence/style is consistent.
- Generic error toasts (e.g. `toast.error('Error')`) without a category-appropriate message.

`frontend/scripts/check-no-confirm.mjs` runs on `npm run build` and blocks builds with new `window.confirm` / `alert` usage. The allowlist documents the legacy sites still to migrate.

---

## Files & references

- `frontend/src/hooks/useConfirm.tsx` — confirmation hook
- `frontend/src/components/ui/ConfirmDialog.tsx` — styled dialog
- `frontend/src/services/errorHandler.ts` — toast + error pipeline
- `frontend/scripts/check-no-confirm.mjs` — enforcement
- `frontend/scripts/check-no-confirm.allowlist.json` — legacy sites still migrating
- `planning/tasks/132-phase-0.5-inventory.md` — origin inventory
