# Error Taxonomy & HTTP Status

> **Status:** Landed 2026-06-19. Owner: CTO. Source task: [Task 246 — Error taxonomy: business-rule rejections must return 4xx](../planning/tasks/246-error-taxonomy-business-rule-4xx.md).

This is the **single source of truth** for how the backend classifies errors and what HTTP status the caller should see. The rule is short and absolute:

> **Every business-rule rejection returns a structured 4xx with a meaningful domain `code` and a Law 5 `guard`. Genuine infrastructure failures (DB, network, transaction conflict) return 5xx. Nothing in between.**

If you are adding a use case that can refuse a request, read this before picking an error class. If you are debugging "the API said 500 / INFRA_999 / critical but the request looked legit," read §4 (the taxonomy) and §5 (the rule).

---

## 1. The five error classes

| Class | HTTP | When to use | Where it lives |
|---|---|---|---|
| `PostingError` (and subclasses `SalesRuleError`, `VoucherRuleError`, `PurchaseRuleError`, `PeriodLockedError`, `PersonaNotAllowedError`) | **400** | Business-rule rejection. Lifecycle guards, settlement rules, accounting policies, persona governance, period lock. | `backend/src/domain/{shared,sales,accounting,purchases}/errors/` |
| `CreditLimitExceededError` | **422** | Sales credit-limit guard refused the operation (it carries rich numbers; the handler renders them in the body). | `backend/src/domain/sales/errors/CreditLimitExceededError.ts` |
| `AppError` (with `severity` = `INFO`/`WARNING`/`ERROR`) | **200 / 400** | Validation, provider errors with their own status mapping (AI: 401/429/502/503), BusinessError wrappers. | `backend/src/errors/AppError.ts` |
| Firestore transaction read-after-write | **409** | `INFRA_TRANSACTION_CONFLICT`. The only infra error that the handler treats as 409 because the client can safely retry. | inline in `errorHandler.ts` |
| `Error` (plain) | **500** | Anything else. `INFRA_999 / severity: critical`. This is the "we crashed" signal. | global catch-all in `errorHandler.ts` |

The full mapping lives in `backend/src/errors/errorHandler.ts` (one function, ~200 lines, exhaustively commented in place).

## 2. The guard attribution (Law 5)

Every guard rejection carries a `guard: 'sales' | 'purchases' | 'accounting' | 'inventory' | 'system'` so the client can always see *which* guard refused and *why*. The handler emits this alongside the structured `code` and `message` so the envelope is uniform across modules.

| Module | Guard | Error class |
|---|---|---|
| Sales (quotes, orders, invoices, returns, delivery notes, settlement) | `'sales'` | `SalesRuleError extends PostingError` |
| Purchases (PO, GRN, PI, PR, settlement) | `'purchases'` | `PurchaseRuleError extends PostingError` |
| Accounting (vouchers, posting, period lock) | `'accounting'` | `VoucherRuleError extends PostingError`, `PeriodLockedError extends PostingError` |
| Inventory / system | `'inventory'` / `'system'` | reserved for inventory rule errors and system fallbacks |

The three `*RuleError` classes share the same shape — extending `PostingError` and stamping the guard. They are the only way to refuse a request with a domain code; `throw new Error('…')` is reserved for genuine bugs and infra failures.

## 3. The codes

`backend/src/errors/ErrorCodes.ts` is the **only** place codes are declared. Adding a new business-rule rejection means adding a code there and referencing it from the throw site — do not hardcode strings.

```
SALES_001  SALES_TRANSITION_BLOCKED            (existing)
SALES_002  SALES_NOT_FOUND                    (Task 246)
SALES_003  SALES_INVALID_STATE                (Task 246)
SALES_004  SALES_ALREADY_POSTED               (Task 246)
SALES_005  SALES_SETTLEMENT_RULE_VIOLATION    (Task 246)
SALES_006  SALES_OVERPAYMENT_NOT_ALLOWED      (Task 246)
SALES_007  QUOTE_INVALID_STATE                (Task 246; was a free string)

PURCH_001  PURCHASES_TRANSITION_BLOCKED        (existing)
PURCH_002  PURCHASES_INVALID_STATE            (Task 246)
PURCH_003  PURCHASES_ALREADY_POSTED           (Task 246)
PURCH_004  PURCHASES_SETTLEMENT_RULE_VIOLATION(Task 246)
PURCH_005  PURCHASES_OVERPAYMENT_NOT_ALLOWED  (Task 246)

VOUCH_001..011 (existing, including VOUCH_INVALID_STATUS = VOUCH_004)
```

## 4. Worked example — the full envelope

```ts
// In the use case:
throw new SalesRuleError(
  ErrorCode.SALES_OVERPAYMENT_NOT_ALLOWED,
  'MULTI settlement total (1500) exceeds outstanding amount (1000). Enable "allow over-payment" in Sales settings to record the excess as a customer credit.',
  { fieldHints: ['settlementTotal'], category: ErrorCategory.VALIDATION }
);
```

The client receives:

```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "SALES_006",
    "message": "MULTI settlement total (1500) exceeds outstanding amount (1000). Enable \"allow over-payment\" in Sales settings to record the excess as a customer credit.",
    "category": "VALIDATION",
    "severity": "error",
    "guard": "sales",
    "details": {
      "violations": [
        {
          "code": "SALES_006",
          "message": "MULTI settlement total (1500) exceeds outstanding amount (1000). Enable \"allow over-payment\" in Sales settings to record the excess as a customer credit.",
          "fieldHints": ["settlementTotal"]
        }
      ]
    },
    "fieldHints": ["settlementTotal"],
    "timestamp": "2026-06-19T22:00:00.000Z"
  }
}
```

The frontend `errorHandler.ts` already unwraps this envelope and pushes the `message` to the toast (see [frontend error handling](../../frontend/src/lib/errorHandler.ts)). A clearer `code` + `message` means a clearer toast — no more "Request failed with status code 500" walls of text.

## 5. The rule (one paragraph)

**When refusing a request, throw a `*RuleError extends PostingError` (or one of the existing specialized subclasses). Do not throw `new Error(...)` for lifecycle, state, settlement, or any other business-rule guard. The `errorHandler` will surface a 4xx with the right `code` and `guard`.**

The single carve-out is idempotent re-post: if the operation has already completed (e.g. a `POSTED` invoice is being posted again), the use case returns the existing entity with the same status instead of throwing. The Functions emulator will respond 200 with the same body. Mirroring the existing `SubmitVoucherUseCase` precedent (`if (voucher.status === APPROVED) return voucher;`), this prevents legitimate retries from dressing as failures.

## 6. Verifying the contract

Two test files own this contract:

- `backend/src/tests/application/sales/SalesRuleErrorMapping.test.ts` — the legacy sales/quote/over-payment rejections (quote-lifecycle, over-payment guard, idempotent re-post). The pre-existing tests prove the new error envelope renders as 400 with the right `code` + `guard: 'sales'`.
- `backend/src/tests/application/sales/ErrorTaxonomyBusinessRuleMapping.test.ts` — Task 246: idempotent re-post of an already-POSTED SI, posting a non-DRAFT SI, re-submitting a PENDING voucher, `VoucherEntity.submit` on a non-DRAFT voucher. 4 tests, all green.
- `backend/scripts/task246-error-taxonomy-smoke.cjs` — uses the **compiled** `backend/lib/` (not the source), drives the real use cases through the real `errorHandler`, and asserts the captured HTTP status / body for each of the 4 confirmed scenarios plus a "real infra error stays 500" negative case. 6 scenarios, all green.

```
$ node backend/scripts/task246-error-taxonomy-smoke.cjs
Task 246 — Error taxonomy business-rule 4xx smoke
---
Scenario 1: Quote lifecycle (DRAFT -> accept/convert)
  PASS status: 400
  PASS code: "SALES_007"
  PASS guard: "sales"
Scenario 2: Over-payment guard (flag OFF)
  PASS status: 400
  PASS code: "SALES_006"
  PASS guard: "sales"
Scenario 3: Re-posting an already-POSTED SI
  PASS status: 400
  PASS code: "SALES_003"
  PASS guard: "sales"
  PASS message contains CANCELLED
Scenario 4: Re-submitting an already-PENDING voucher
  PASS status: 400
  PASS code: "VOUCH_004"
  PASS guard: "accounting"
  PASS message contains pending
Scenario 5: VoucherEntity.submit on APPROVED voucher
  PASS status: 400
  PASS code: "VOUCH_004"
  PASS guard: "accounting"
  PASS message contains approved
Scenario 6: Genuine infra error stays 500 (no over-classification)
  PASS status: 500
  PASS code: "INFRA_999"
  PASS severity: "critical"
---
SMOKE PASSED
```

## 7. What changed in Task 246

For the 4 confirmed leak sites in the QA findings:

1. `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:996` — not-found: `new SalesRuleError(ErrorCode.SALES_NOT_FOUND, …)`. 400 / `SALES_002`.
2. `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:1001` — non-DRAFT status: now **idempotent re-post** for `POSTED` (returns the existing invoice, no duplicate voucher) and a clean 4xx for everything else. 200 (idempotent) / 400 (other) / `SALES_003`.
3. `backend/src/application/accounting/use-cases/SubmitVoucherUseCase.ts:72` — non-DRAFT/REJECTED status: `new VoucherRuleError(ErrorCode.VOUCH_INVALID_STATUS, …)`. 400 / `VOUCH_004`.
4. `backend/src/domain/accounting/entities/VoucherEntity.ts:335` — same guard, same code, same shape. 400 / `VOUCH_004`.

Sibling conversions (audit step in §2 of Task 246): `VoucherEntity` lifecycle methods (`approve`, `cancel`, `post`, `reject`, `createReversal`, `satisfyFinancialApproval`, `confirmCustody`) and `VoucherApprovalUseCases` now throw `VoucherRuleError` for their status guards. The purchases mirror (`PurchaseOrderUseCases`, `PurchaseInvoiceUseCases`, `PurchaseReturnUseCases`, `PaymentSyncUseCases`) throws `PurchaseRuleError` for the same class of guard. **Genuine infrastructure errors are unchanged — those still surface as 500 / `INFRA_999` / `critical`.**

## 8. Frontend impact

The frontend `errorHandler.ts` / `errorInterceptor.ts` already unwraps the structured envelope. The fix is transparent to the UI: a user clicking **Post** on a `CANCELLED` sales invoice now sees a localized toast reading "Sales invoice cannot be posted from status CANCELLED…" instead of "Request failed with status code 500". No frontend code change is required.
