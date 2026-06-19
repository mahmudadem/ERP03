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
SALES_002  SALES_INVALID_STATE                 (Task 246 — wired)
SALES_003  SALES_ALREADY_POSTED                (Task 246 — wired)

PURCH_001  PURCHASES_TRANSITION_BLOCKED        (existing)

VOUCH_001..011 (existing, including VOUCH_INVALID_STATUS = VOUCH_004 — reused by Task 246)
```

> The over-payment / settlement-rule sales rejections already use `SalesRuleError` (with the free-string codes `OVERPAYMENT_NOT_ALLOWED` / `SETTLEMENT_RULE_VIOLATION`) from Task 242 — they were already 4xx and were not touched by Task 246. The purchases mirror (`PurchaseRuleError`) exists as the designated purchases guard class but its throw sites are **not yet converted** (logged follow-up).

## 4. Worked example — the full envelope

```ts
// In the use case:
throw new SalesRuleError(
  ErrorCode.SALES_INVALID_STATE,
  `Cannot post a sales invoice in status ${si.status}; it must be DRAFT.`,
  { fieldHints: ['status'], context: { status: si.status } }
);
```

The client receives:

```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "SALES_002",
    "message": "Cannot post a sales invoice in status CANCELLED; it must be DRAFT.",
    "category": "CONFLICT",
    "severity": "error",
    "guard": "sales",
    "details": {
      "violations": [
        { "code": "SALES_002", "message": "Cannot post a sales invoice in status CANCELLED; it must be DRAFT.", "fieldHints": ["status"] }
      ]
    },
    "fieldHints": ["status"],
    "timestamp": "2026-06-19T22:00:00.000Z"
  }
}
```

The frontend `errorHandler.ts` already unwraps this envelope and pushes the `message` to the toast (see [frontend error handling](../../frontend/src/lib/errorHandler.ts)). A clearer `code` + `message` means a clearer toast — no more "Request failed with status code 500" walls of text.

## 5. The rule (one paragraph)

**When refusing a request, throw a `*RuleError extends PostingError` (or one of the existing specialized subclasses). Do not throw `new Error(...)` for lifecycle, state, settlement, or any other business-rule guard. The `errorHandler` will surface a 4xx with the right `code` and `guard`.**

There is **no** silent-200 carve-out. An already-completed operation (e.g. re-posting a `POSTED` invoice) is rejected with a clean **400** (`SALES_ALREADY_POSTED`) and creates no duplicate — a double action is *visibly* refused rather than silently swallowed. (This was a deliberate choice over the `SubmitVoucherUseCase` APPROVED-returns-voucher precedent; for posting, an explicit refusal is safer.)

## 6. Verifying the contract

Two jest suites own this contract (run via `npm --prefix backend test`):

- `backend/src/tests/application/sales/SalesRuleErrorMapping.test.ts` — pre-existing: proves sales rejections render as 400 with the right `code` + `guard: 'sales'`.
- `backend/src/tests/application/sales/ErrorTaxonomyBusinessRuleMapping.test.ts` — Task 246: re-post of an already-POSTED SI → 400 `SALES_ALREADY_POSTED` (no duplicate voucher); posting a non-DRAFT SI → 400 `SALES_INVALID_STATE`; re-submitting a PENDING voucher → 400 `VOUCH_INVALID_STATUS`; `VoucherEntity.submit` on an APPROVED voucher → 400 `VOUCH_INVALID_STATUS`. 4 tests, all green.

The full sales + accounting + domain-accounting groups (61 suites / 505 tests) pass with these changes.

## 7. What changed in Task 246

The 3 genuine leak sites (the over-payment guard was already 4xx from Task 242):

1. `SalesInvoiceUseCases.ts` `PostSalesInvoiceUseCase.execute` — not-found → `SalesRuleError(SALES_INVALID_STATE)`; already-`POSTED` → `SalesRuleError(SALES_ALREADY_POSTED)` (no duplicate voucher); other non-`DRAFT` → `SalesRuleError(SALES_INVALID_STATE)`. All 400.
2. `SubmitVoucherUseCase.ts` — non-DRAFT/REJECTED submit → `VoucherRuleError(VOUCH_INVALID_STATUS)`. 400.
3. `VoucherEntity.ts` `submit()` — same guard / code. 400.

**Not done (logged follow-up):** the purchases mirror. `PurchaseRuleError` exists as the designated purchases guard class, but `PurchaseInvoiceUseCases` / `PurchaseOrderUseCases` / `PurchaseReturnUseCases` / purchases `PaymentSyncUseCases` throw sites were **not** converted — there is no QA-confirmed 500 leak there today. The `VoucherEntity` lifecycle methods beyond `submit` were also left as-is. **Genuine infrastructure errors are unchanged — still 500 / `INFRA_999` / `critical`.**

## 8. Frontend impact

The frontend `errorHandler.ts` / `errorInterceptor.ts` already unwraps the structured envelope. The fix is transparent to the UI: a user clicking **Post** on a `CANCELLED` sales invoice now sees a localized toast reading "Sales invoice cannot be posted from status CANCELLED…" instead of "Request failed with status code 500". No frontend code change is required.
