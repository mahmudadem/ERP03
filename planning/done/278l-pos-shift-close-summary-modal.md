# 278l — POS shift close summary modal

## Technical Developer View

Telegram QA screenshot 20 showed the POS shift-close modal with:

- Arabic session using confusing close-button wording.
- A generic modal footer **Close** button below the real action buttons.
- No intermediate shift-summary review before the final close action.

Changed:

- `frontend/src/modules/pos/pages/PosShiftPage.tsx`
  - Added a two-step close modal:
    1. Enter counted payment totals.
    2. View shift summary.
    3. Confirm end session.
  - Hid the shared modal footer for this flow to remove the duplicate generic **Close** button.
  - Shows expected cash, counted cash, and cash variance before final close.
- `frontend/src/locales/{en,ar,tr}/pos.json`
  - Added localized labels for **View shift summary**, **Shift close summary**, **Edit count**, and **Confirm end session**.
- `docs/architecture/pos.md`
  - Documented that the UI is now a summary-before-confirm flow.
- `docs/user-guide/pos/shifts.md`
  - Updated end-user close-shift steps.

## End-User View

When closing a POS shift, the cashier now first enters counted totals, then clicks **View shift summary**. ERP03
shows the expected cash, counted cash, and variance. The final action is **Confirm end session**, not a vague
generic **Close** button.

## Accounting and control impact

- UI confirmation/safety only.
- Backend close validation remains authoritative.
- Cash over/short voucher posting is unchanged.
- No shift, receipt, payment, voucher, ledger, tenant, or permission model changed.

## Verification

- POS locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/`.
- Build warnings are existing bundle/browser-data warnings.
- `git diff --check` passed.
- `graphify update .` could not run because `graphify` is not installed/available in this shell.

## Time spent

~0.5h.
