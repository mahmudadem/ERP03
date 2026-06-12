# 211 — Jest `uuid` ESM shim (test-infra fix)

**Date:** 2026-06-12
**Branch:** `feat/overpayment-credit-balance`
**Type:** Test infrastructure / bug fix (backend)

## Problem

`uuid@14` ships **ESM-only** (`"type": "module"`, `exports` resolve to `dist-node/index.js`
which uses `export { … }`). The backend Jest setup runs under **ts-jest's CommonJS runtime**,
whose `transform` only matches `^.+\.ts$` — it does not transform `node_modules` `.js`. So the
moment a test (transitively) imported any file using `uuid`, the suite failed to *load* with:

```
SyntaxError: Unexpected token 'export'
  at node_modules/uuid/dist-node/index.js:1
```

This silently **disabled whole test suites**. Confirmed casualty: `RecurringInvoiceUseCases.test.ts`
(23 tests) — it never ran, so regressions in recurring-invoice logic were invisible. Nine production
files import `uuid` (`RecurringInvoiceUseCases`, `RecurringVoucherUseCases`, `BankReconciliationUseCases`,
`BudgetUseCases`, `ConsolidationUseCases`, `ReverseAndReplaceVoucherUseCase`, `CompanyCurrencyUseCases`,
`NotificationService`, `ConsolidationController`), so any suite touching those was at risk.

## Fix

Every production import is `import { v4 as uuidv4 } from 'uuid'`, so the shim only needs `v4`.

- Added `backend/src/tests/shims/uuidShim.ts` — `export const v4 = () => randomUUID()` (Node's
  built-in `crypto.randomUUID`), plus a default export for safety.
- Wired it in `backend/jest.config.js` via `moduleNameMapper: { '^uuid$': '<rootDir>/src/tests/shims/uuidShim.ts' }`.

ts-jest transforms the `.ts` shim normally, so the ESM `uuid` package is never loaded under Jest.
**Production is untouched** — the real `uuid` is still used everywhere outside tests.

## Verification

- `jest RecurringInvoiceUseCases` — now **23/23 pass** (was: suite failed to load).
- **Full backend suite**: `jest` → **146 suites passed, 0 failed**, 1365 tests passing, 18 skipped,
  2 suites skipped (pre-existing intentional skips). Time ~27s.
- No production code changed; the shim is test-only.

## Notes

- If a future test needs other uuid exports (`v1`, `v5`, `validate`, …), add them to the shim.
- Alternative considered: a `.js` transform (babel-jest) for `node_modules/uuid`, or pinning uuid to a
  CJS-capable version. The shim is the smallest, lowest-risk, dependency-free option.
