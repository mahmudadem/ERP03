# 247f — POS persistence root-cause, terminal shift resolution, cashier UX

**Date:** 2026-06-21
**Area:** POS module (frontend + narrow backend)
**Status:** Done, browser-verified on the live emulator (`asd syria` tenant).

## Context

Owner QA on the merged POS module surfaced three issues that earlier "persistence hardening" sessions had treated at the wrong layer:

1. **POS Settings "saves but does not persist"** — values reverted immediately after Save, with a green success toast and no error.
2. **POS Terminal showed "No open shift for this register"** while the Shift page clearly listed an OPEN shift for that register.
3. **The cashier screen was too basic** to be useful.

## Root causes & fixes

### 1. Double-unwrapped API responses (the real persistence bug)
The global axios response interceptor (`frontend/src/api/errorInterceptor.ts`, `setupErrorInterceptor`) already unwraps the `{ success, data }` envelope to the bare payload. But `posApi`'s `ok()` helper unwrapped **again** using a 2-level form (`r.data.data ?? r.data`) that lacked the `?? r` fallback every other api module uses. With the interceptor active, `r` is already the DTO, so `r.data` was `undefined` → **every POS read resolved to `undefined`**. The Settings page fell back to `normalizeSettings(null)` defaults, and each save round-trip reloaded `undefined` → defaults again, i.e. an instant revert with a success toast.

**Fix:** `frontend/src/api/posApi.ts` — `ok()` now uses `r?.data?.data ?? r?.data ?? r`, matching `accountingApi`/`salesApi`/`purchasesApi`. Repairs **all** POS endpoints.

### 2. Bootstrap never resolved the register/shift without a `registerId`
`backend/src/application/pos/use-cases/PosBootstrapUseCase.ts` only set `register`/`openShift` when an explicit `registerId` was passed, but the terminal calls bootstrap with only `cashierUserId`.

**Fix:** resolve a default register (explicit id → lone `ACTIVE` register → lone register of any status), read its open shift, and fall back to the cashier's open shift (hydrating its register if none was picked).

### 3. Optional settings fields could not be cleared
`stripUndefinedDeep` + `set(..., { merge: true })` kept the previous value for any blanked optional field; and the Settings page sent `undefined`, which `JSON.stringify` drops, so the use case treated it as "not provided."

**Fix:** `FirestorePosSettingsRepository.saveSettings` drops `{ merge: true }` (it always writes the complete entity); `PosSettingsPage` sends `''` for cleared walk-in customer / over-short accounts.

### 4. Cashier screen redesign
`frontend/src/modules/pos/pages/PosTerminalPage.tsx` rebuilt as a Square/Loyverse-style checkout: context bar (register/shift/cashier/last-receipt chip), product **tile grid** with scan-to-add (Enter adds top match), order panel with qty steppers + item-count badge + Clear + clear totals + large green **Pay** button, and a React-state tender dialog (method buttons from enabled methods, **Exact** helper, tendered/change/balance, "Fully paid" state) replacing the old `getElementById` form. Non-positively-priced items show **No price** and are blocked from the cart.

### 5. Zero-price POS sale reached subledger assembly
Owner QA found a POS sale that failed with `Critical Error / INFRA_999`: `Subledger voucher SI-SI-00004 must have at least two lines after assembly (got 0)`. Root cause: a zero-price POS line created a zero-value Sales Invoice; all invoice voucher entries were zero and the shared subledger assembler correctly refused to post an empty voucher.

**Fix:** `CompletePosSaleUseCase` now rejects invalid/zero POS line prices before creating a Sales Invoice draft. The cashier UI has the matching **No price** guard, but the backend is the accounting authority.

### 6. Tender dialog treated the visible amount as uncommitted
Owner QA screenshot showed **Amount = 480** but **Tendered = 0.00**, followed by `Tendered total does not match grand total.` The dialog prefilled the amount field but only validated/submitted rows already committed through **Add payment**. That made the default Exact flow look payable while the actual `payments` payload was still empty.

**Fix:** `PosTerminalPage` now derives a staged payment from the visible tender form while the dialog is open. Tendered/change/balance calculations and `completeSale` use committed rows plus the staged row. Split payments still work: **Add payment** commits the current staged row and clears the form for the next tender.

## Accounting/ERP impact
No change to posting/voucher/tax/COGS/inventory/AR-AP/tenant rules. Settlement-account routing, the `allowPosDirectSales` governance toggle, and the SI/SR posting boundary are unchanged. The zero-price guard prevents an invalid POS commercial sale from reaching Sales Invoice posting; it does not alter Sales Invoice accounting math. The tender-dialog fix only corrects which visible frontend payment rows are sent to the existing backend sale-completion use case. The only write-behavior change (full-document set) is safe because POS Settings is always persisted as the complete entity.

## Verification
- Live emulator round-trips (`asd syria`): GET/PUT settings persist + re-read; bootstrap with no `registerId` returns the open register + shift (`reg_f6954cc6…` / `shift_…3317fd86`); walk-in customer clear-then-restore works.
- Backend rebuilt (`npm --prefix backend run build`); **POS application tests 35/35 pass**.
- Frontend `tsc --noEmit` clean.
- Browser-verified the redesigned terminal end-to-end: login → `/pos` → shift detected → search → product tile → cart → qty stepper → totals → Pay → tender dialog; zero console errors; responsive (stacks ≤ lg, 7/5 split on desktop) with the app's dark-mode tokens.
- Follow-up zero-price guard verification: `CompletePosSale.test.ts` passed 12/12, including the guard that rejects zero-priced POS lines before Sales Invoice draft creation; backend typecheck/build and frontend typecheck/build also passed.
- Follow-up tender-modal staged-payment verification: `npm --prefix frontend run typecheck` passed; `npm --prefix frontend run build` passed, including `check:reports`, `check:no-confirm`, `check:sod-approve`, TypeScript, and Vite production build.

## Files
- `frontend/src/api/posApi.ts`
- `backend/src/application/pos/use-cases/PosBootstrapUseCase.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosSettingsRepository.ts`
- `frontend/src/modules/pos/pages/PosSettingsPage.tsx`
- `frontend/src/modules/pos/pages/PosTerminalPage.tsx`
- Docs: `docs/architecture/pos.md`, `docs/user-guide/pos/selling.md`

## Follow-ups (not blockers)
- The other `*Api` modules use the resilient unwrap inline; consider a single shared `unwrapResponse` helper to prevent the 2-level regression recurring.
- Quick-cash denomination buttons in the tender dialog (currency-aware) are a future nicety.
