# 278f — Account form translation

## Status

Complete. Translation resources are validated and the Account form now renders
all user-facing copy through the accounting locale.

## Technical developer view

Added one complete `accountForm` translation contract to the English, Arabic,
and Turkish accounting locale files. `AccountForm.tsx` now resolves all four
tabs, field labels, option labels, guidance, financial-policy explanations,
validation feedback, custody controls, and action states through those keys.
The option constants retain only stable accounting values, so changing language
does not alter submitted account data.

## End-user view

The full Create/Edit Account window follows the user's selected language
instead of displaying English labels in Arabic mode.

## Accounting impact

Display text only. No account validation, classification, balance-nature,
posting, approval, currency, ledger, or audit behavior changes.

## Verification

- All three locale JSON files parsed successfully.
- Frontend typecheck passed.
- Frontend production build passed.
- Hardcoded visible-text scan found no remaining English JSX copy.
- `graphify update .` could not run because the Graphify CLI is unavailable in
  this environment; no graph files were changed.

## Time

- Estimate for complete fix: 45–60 minutes
- Phase 1 actual: approximately 20 minutes
- Phase 2 actual: approximately 30 minutes
- Total actual: approximately 50 minutes
