# 278f — Account form translation

## Status

Phase 1 complete: translation resources added and validated. Phase 2 will wire
all Account form copy to these keys.

## Technical developer view

Added one complete `accountForm` translation contract to the English, Arabic,
and Turkish accounting locale files. It covers all four tabs, field labels,
select options, guidance, financial-policy explanations, custody controls, and
form action states.

Phase 2 must replace the remaining hardcoded copy in
`frontend/src/modules/accounting/components/AccountForm.tsx`.

## End-user view

After phase 2, the full Create/Edit Account window will follow the user's
selected language instead of displaying English labels in Arabic mode.

## Accounting impact

Display text only. No account validation, classification, balance-nature,
posting, approval, currency, ledger, or audit behavior changes.

## Verification

- All three locale JSON files parsed successfully.
- Frontend typecheck passed.

## Time

- Estimate for complete fix: 45–60 minutes
- Phase 1 actual: approximately 20 minutes
