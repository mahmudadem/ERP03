# Accounting error messages

## What changed

When an accounting page fails because the server returns a generic error, the message now names the operation that failed instead of only saying "unexpected error" or "request failed with status code 500".

Examples:

- Account Statement failed on the server.
- Accounting source-document approvals failed on the server.
- Financial approvals failed on the server.

The error window also shows a **Technical reference**. This reference is safe to screenshot and send to support. It includes the request method, the accounting API path, the HTTP status, and the error code.

## What users should do

1. Retry the action once.
2. If the same error appears again, take a screenshot of the whole error window.
3. Send the screenshot to support or the system administrator.

## What this does not mean

This change does not change accounting numbers, approvals, vouchers, account statements, or ledger posting. It only makes production errors clearer so the failed area can be identified faster.
