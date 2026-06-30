# 278e — Default Arabic application language

## Completion status

Implementation and verification complete; awaiting owner-approved commit and
final batch deployment.

## Technical developer view

- Changed i18n startup to use Arabic when `erp_language` is absent.
- Removed browser and HTML language detection from the default-selection path.
- Seeded the legacy IP detector compatibility key so it cannot overwrite the
  product default or a manual user choice.
- Changed frontend context fallbacks and the empty API preference response to
  Arabic.
- Preserved existing local and backend language preferences.

Files:

- `frontend/src/i18n/config.ts`
- `frontend/src/context/UserPreferencesContext.tsx`
- `backend/src/api/controllers/core/UserPreferencesController.ts`
- `docs/architecture/frontend-ux-layout-audit.md`
- `docs/user-guide/settings/default-language.md`

## End-user view

New users now see Arabic from the first screen. Users who manually selected
English, Arabic, or Turkish keep their saved choice.

## Accounting and security impact

None. This changes interface language selection only. It does not modify
tenant data, permissions, posting, inventory valuation, taxes, balances, or
audit records.

## Verification

- Frontend `npm run typecheck`: passed.
- Frontend `npm run build`: passed, including report, confirm-dialog, and
  segregation-of-duties checks.
- Backend `npm run build`: passed.

## Time

- Estimate: 20–30 minutes
- Actual: approximately 25 minutes
