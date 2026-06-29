# 278d — POS shift-close configuration validation

**Status:** Ready for commit; deployment deferred until all production fixes finish  
**Estimated time:** 0.5–1 hour  
**Actual time:** approximately 0.4 hour

## Technical developer view

Production shift close failed because a cash shortage required a Cash Short
expense account that was not configured. The accounting guard was correct, but
it threw a raw `Error`, which the API mapped to HTTP 500 and replaced with a
generic critical message.

Changed:

- Missing Cash Over/Short configuration now throws `ValidationError`.
- Structured field and POS Settings path context are included.
- Regression coverage verifies the validation type and that no voucher or shift
  mutation occurs.

Accounting impact: the close remains blocked until the proper account is
configured. No fallback account, silent write, partial voucher, or weakened
control was introduced.

## End-user view

When a shift has a cash difference and the required account is missing, the
user now sees the exact setup action instead of “unexpected error.” Configure
the account in POS Settings and retry the still-open shift.

## Verification

- POS shift and System Core boundary suites: 41/41 passed.
- Backend TypeScript build: passed.

## Acceptance criteria

- Missing Cash Over/Short setup is HTTP 400 validation, not HTTP 500.
- The message identifies the required account.
- The failed close leaves the shift and ledger unchanged.
