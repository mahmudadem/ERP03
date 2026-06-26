# Task 268 - Tax Code Master-Data Controls and Page Repolish

**Status:** Complete  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Created:** 2026-06-26  
**Estimated time:** 1.5-2.5 hours  
**Actual time:** ~2.1 hours  
**Priority:** P0 accounting-control follow-up from manual QA

## Context

Manual QA exposed that the current Tax Codes screen makes an accounting-critical setting too easy to miss:

- A tax code named `10%INC` can still be saved as exclusive if `priceIsInclusive` is false.
- The old inline checkbox was not clear enough for users.
- The rate field says `Rate (Decimal)`, forcing users to type `0.1` instead of the natural business input `10%`.
- Editing tax math fields after posted documents exist would weaken auditability.

This is not cosmetic polish. Tax code rate and inclusive/exclusive basis affect Sales, Purchases, POS, tax reports, AR/AP, inventory valuation when PI capitalizes inventory cost, and voucher explanations.

## Goal

Rework Tax Codes into a safer master-data page:

1. List-first page.
2. Add/Edit opens a modal.
3. Price basis is explicit and required: `Exclusive` vs `Inclusive`.
4. Rate input is `Rate %`; users type `10`, while backend/domain still store `0.10`.
5. If a tax code has been used in posted documents, accounting-critical fields are locked with a lock icon and explanation.
6. Backend enforces the same lock; the UI is not the control boundary.

## Scope

In scope:

- `frontend/src/modules/settings/pages/TaxCodesPage.tsx`
- `frontend/src/api/sharedApi.ts` if the DTO needs usage/locked metadata.
- `backend/src/application/shared/use-cases/TaxCodeUseCases.ts`
- `backend/src/api/controllers/shared/SharedController.ts`
- repository interfaces/implementations needed to detect posted usage safely.
- focused backend tests for tax-code immutability after posted use.
- frontend typecheck/build verification.
- planning/doc updates for the task.

Out of scope:

- Changing tax calculation math.
- Changing posted Sales Invoice / Purchase Invoice / POS voucher output.
- Recomputing old documents.
- Bulk migration or auto-renaming existing tax codes.
- New tax reports.

## Accounting Rules

### Unused Tax Code

Allow editing:

- code
- name
- rate
- tax type
- scope
- purchase tax account
- sales tax account
- price basis
- active/inactive

### Used Only In Draft Documents

Preferred behavior:

- allow editing, but do not silently recalculate existing draft lines unless current draft flows already do so.
- if implementation cannot cheaply distinguish draft-only usage, it is acceptable to treat any document usage as locked for this slice. Document that decision clearly.

### Used In Posted Documents

Lock accounting-critical fields:

- code, if documents store only the tax code reference/code for display or reporting.
- rate
- tax type
- scope
- purchase tax account
- sales tax account
- price basis (`priceIsInclusive`)

Allow safe edits:

- name/display label
- active/inactive status

Recommended user message:

> This tax code is used in posted documents. Create a new tax code to change tax treatment.

## Backend Requirements

1. Add a safe way to determine whether a tax code is used by posted documents.
   - Include Sales Invoice and Purchase Invoice at minimum.
   - Include Sales Return and Purchase Return if they can post and carry tax code ids.
   - Include POS if POS posted receipts persist tax code ids in a queryable place.
   - Do not use frontend-only checks.

2. `UpdateTaxCodeUseCase` must reject changes to locked fields after posted usage.
   - Return a clear business error.
   - Error must identify that posted usage locks accounting-critical tax fields.

3. `listTaxCodes` / `getTaxCode` should expose enough metadata for the UI:
   - `usedInPostedDocuments: boolean` or equivalent.
   - optional `lockedFields` array if practical.

4. Preserve storage format:
   - Domain/API persistence remains decimal rate, e.g. 10% stored as `0.10`.
   - UI conversion only: displayed/input percentage = decimal * 100.

5. Add tests:
   - unused tax code can change rate and basis.
   - tax code used in posted SI cannot change rate.
   - tax code used in posted PI cannot change price basis.
   - used tax code can still change name and active flag.
   - rejected error is clear.

## Frontend Requirements

1. Rework page structure:
   - Main page shows tax-code list first.
   - Primary button: `New Tax Code`.
   - `Edit` button opens modal.
   - No always-visible create/edit form above the list.

2. Use established local concepts from master-data pages:
   - list/table with compact rows.
   - action buttons with icons where useful.
   - modal form for add/edit.
   - `AccountSelector` for tax accounts, not raw account id inputs.
   - toast success/error for save results.

3. Modal fields:
   - Code
   - Name
   - Rate %
   - Type
   - Scope
   - Price Basis: required dropdown/radio-style segmented control with explicit labels:
     - `Exclusive - tax is added on top`
     - `Inclusive - entered price already includes tax`
   - Purchase Tax Account
   - Sales Tax Account
   - Active

4. Rate UX:
   - Label must be `Rate %`, not `Rate (Decimal)`.
   - User enters `10` for 10%.
   - Submit payload sends `0.10`.
   - Edit modal displays `10` for stored `0.10`.
   - Validate non-negative number.

5. Locked state UX:
   - Show a lock icon on rows where `usedInPostedDocuments` is true.
   - In edit modal, disabled locked fields must show lock icon or short helper text.
   - Do not hide locked values.
   - Allow safe fields (`Name`, `Active`) to remain editable.
   - If backend rejects, show the backend message in a toast/error area.

6. List columns should include:
   - Code
   - Name
   - Rate
   - Type
   - Scope
   - Price Basis
   - Status
   - Usage/Lock
   - Actions

## Acceptance Criteria

- A user can create a 10% inclusive tax code by typing `10`, not `0.1`.
- The list visibly shows whether each code is `Inclusive` or `Exclusive`.
- A used tax code shows a lock icon.
- Editing a used tax code disables accounting-critical fields and explains why.
- Backend rejects direct API attempts to change locked fields after posted usage.
- Existing SI/PI posting math and voucher output do not change.
- Frontend typecheck and build pass.
- Backend focused tests pass.

## Verification Commands

Run from `D:\DEV2026\ERP03-267-engine-audit`:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/shared/TaxCodeUseCases.test.ts
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix backend run build
git diff --check
```

If no focused tax-code use-case test file exists, create one instead of broadening unrelated suites first.

## Stop Conditions

- If posted usage cannot be detected without adding large cross-repository dependencies, stop and propose a narrow `TaxCodeUsageService` / repository-query design first.
- If changing the backend DTO would break existing consumers broadly, stop and propose a backward-compatible metadata field.
- Do not allow frontend-only locking without backend enforcement.
- Do not change existing tax math or update expected voucher output unless explicitly approved.

## Owner QA Script

1. Open Settings -> Tax Codes.
2. Confirm the page shows a list and `New Tax Code` button.
3. Create `VAT10-IN` with Rate `% = 10` and Price Basis `Inclusive`.
4. Create a Sales Invoice using it:
   - entered price `100`
   - expected total stays `100`
   - expected net/tax split approximately `90.91 / 9.09`
5. Return to Tax Codes and edit `VAT10-IN`.
6. Confirm rate, basis, type/scope, and tax accounts are locked with a lock icon/message.
7. Confirm name or active flag can still be changed.
8. Try direct API/manual edit of locked fields if practical; backend must reject.
