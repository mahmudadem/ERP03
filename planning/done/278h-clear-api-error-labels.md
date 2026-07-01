# 278h — Clear API error labels

## Status

Complete. Telegram photos 9–11 showed generic production errors in Approval Center and Account Statement. The frontend now names the failed operation and displays a safe technical reference.

## Technical developer view

The Axios error interceptor now enriches structured API errors with request metadata: HTTP status, method, and path. The shared error handler uses that metadata to replace generic `INFRA_999` / HTTP 500 wording with localized operation-specific text for key accounting endpoints:

- accounting source-document approvals
- financial approvals
- custody confirmations
- account statement

The shared `ErrorModal` displays a safe technical reference containing method, path, HTTP status, and code. This helps diagnose screenshots without exposing stack traces, secrets, request bodies, tenant ids, or internal server details.

Files changed in code commit `ccd97a81`:

- `frontend/src/api/errorInterceptor.ts`
- `frontend/src/services/errorHandler.ts`
- `frontend/src/components/ErrorModal.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`

Documentation files changed in this docs slice:

- `docs/architecture/error-taxonomy.md`
- `docs/user-guide/accounting/error-messages.md`
- `planning/done/278h-clear-api-error-labels.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

## End-user view

If Account Statement or Approval Center fails, users no longer see only a vague critical error. The message now says which accounting operation failed and includes a technical reference they can screenshot for support.

## Accounting impact

Presentation and diagnostics only. No approval status, voucher, ledger entry, balance, statement calculation, posting rule, tenant scope, or audit behavior changed. A real server 500 remains a server failure and still needs backend diagnosis if it repeats.

## Verification

- English, Arabic, and Turkish `common.json` parsing passed.
- Frontend TypeScript check passed.
- Frontend production build passed, including report route checks, no raw confirm/alert check, and SOD approve check.
- `graphify update .` could not run because the CLI is unavailable in this shell.

## Time

- Estimate: 30–45 minutes
- Actual: approximately 35 minutes

## Deployment

Deferred until all Telegram production QA fixes are complete.
