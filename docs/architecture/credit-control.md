# Architecture: Credit Control

**Last updated:** 2026-05-20
**Status:** Phase B complete. Exposure calculation, three-policy enforcement, and override audit trail are all live at Sales Order confirm. Direct Sales Invoice creation is not yet credit-checked (see Follow-ups).

---

## Why this exists

Selling on credit to a customer who cannot pay is a cash-flow risk. Credit control allows the business to set a per-customer credit ceiling and choose how the system responds when a new order would push the customer over that ceiling — warn the operator, block the order outright, or do nothing.

---

## Master data (set on the Party record)

**File:** `backend/src/domain/shared/entities/Party.ts`

Two fields on each customer `Party` drive enforcement:

| Field | Type | Notes |
|---|---|---|
| `creditLimit` | number (optional) | The ceiling in base currency. If absent, credit control is never enforced for this customer |
| `creditHoldPolicy` | `'NONE'` \| `'WARN'` \| `'BLOCK'` | What happens when the limit is exceeded |

Setting `creditLimit` to `null` or leaving it absent is the safest way to exclude a customer from credit control entirely — policy is irrelevant when there is no limit.

---

## Exposure formula

**File:** `backend/src/application/sales/services/CreditCheckService.ts`

```
currentExposure  = Σ outstandingAmountBase  (across all POSTED invoices for the customer)
projectedExposure = currentExposure + orderAmount
overLimit        = projectedExposure > creditLimit
```

Where:
- `outstandingAmountBase` is the unpaid balance in base currency on each POSTED sales invoice (already reflects partial payments).
- `orderAmount` is `SalesOrder.grandTotalBase` — the full base-currency value of the order being confirmed.

Only invoices in status `POSTED` are included. Draft, cancelled, and voided invoices do not contribute to exposure.

**Result shape (`CreditCheckResult`):**

```ts
{
  enforced: boolean;        // false when customer has no creditLimit — no action taken
  creditLimit: number;
  currentExposure: number;
  orderAmount: number;
  projectedExposure: number;
  withinLimit: boolean;
  policy: 'NONE' | 'WARN' | 'BLOCK';
}
```

---

## The three policies

Enforcement happens inside `ConfirmSalesOrderUseCase` (`backend/src/application/sales/use-cases/SalesOrderUseCases.ts`).

| Policy | Behaviour when over limit | Outcome returned |
|---|---|---|
| `NONE` | No action — confirm proceeds regardless | `OK` |
| `WARN` | Confirm proceeds; caller receives `outcome: 'WARN'` | `WARN` |
| `BLOCK` | Throws `CreditLimitExceededError` unless an override is supplied | `OVERRIDDEN` (if override) |

If `creditLimit` is not set on the customer, enforcement is skipped entirely (`enforced: false`, outcome `OK`).

The result type is:

```ts
ConfirmSalesOrderResult {
  salesOrder: SalesOrder;
  creditCheck: CreditCheckResult & { outcome: 'OK' | 'WARN' | 'OVERRIDDEN' };
}
```

---

## BLOCK policy and the override flow

When the policy is `BLOCK` and the order is over limit, `ConfirmSalesOrderUseCase` throws `CreditLimitExceededError` (see `backend/src/domain/sales/errors/CreditLimitExceededError.ts`). The error carries the structured numbers so the API response can present a rich dialog:

```ts
{
  customerId, creditLimit, currentExposure, orderAmount, projectedExposure
}
```

The caller (API controller / frontend) may then re-submit `ConfirmSalesOrderUseCase` with an override payload:

```ts
options.override = {
  reason: string;   // mandatory, non-empty
  userId: string;   // the approving user's id
}
```

When an override is provided:
1. The use case constructs a `CreditOverride` record and persists it via `ICreditOverrideRepository`.
2. The order is confirmed normally.
3. The result carries `outcome: 'OVERRIDDEN'`.

### CreditOverride audit record

**File:** `backend/src/domain/sales/entities/CreditOverride.ts`

Every override creates an immutable record with the following fields (all `readonly`):

| Field | Notes |
|---|---|
| `customerId` | Customer whose limit was overridden |
| `sourceType` | Currently always `'SALES_ORDER'` |
| `sourceId` / `sourceNumber` | The sales order that triggered the override |
| `creditLimit` | The limit at the time of override |
| `currentExposure` | Exposure at the time of override |
| `orderAmount` | The order's grandTotalBase |
| `projectedExposure` | currentExposure + orderAmount |
| `reason` | Mandatory; the justification provided by the approver |
| `overriddenBy` | User ID of the approver |
| `overriddenAt` | Timestamp of the override |

The `reason` field is validated non-empty in the entity constructor — a blank reason throws at the domain layer.

---

## Frontend behaviour

- **WARN outcome:** The SO detail page shows a banner warning that the customer is over their credit limit. The order is still confirmed and usable.
- **BLOCK error:** The SO detail page opens a credit-override modal showing the exposure breakdown. The user must enter a justification reason before the confirm can proceed.

---

## Sequence diagram

```
Frontend                      API Controller           ConfirmSalesOrderUseCase    CreditCheckService
   │                               │                          │                          │
   │── POST /orders/:id/confirm ──►│                          │                          │
   │                               │── execute(id) ──────────►│                          │
   │                               │                          │── check(party, amount) ──►│
   │                               │                          │◄─ CreditCheckResult ──────│
   │                               │                          │                          │
   │                               │                          │ [policy=BLOCK, overLimit]
   │                               │                          │── throw CreditLimitExceededError
   │◄── 422 + exposure details ────│                          │
   │                               │                          │
   │── POST /confirm { override } ─►│                         │
   │                               │── execute(id, override) ─►│
   │                               │                          │── persist CreditOverride
   │                               │                          │── confirm order
   │◄── 200 { outcome:'OVERRIDDEN'}─│                         │
```

---

## Where enforcement is and is not applied

| Path | Credit-checked? |
|---|---|
| `ConfirmSalesOrderUseCase` | Yes |
| `CreateSalesOrderUseCase` (DRAFT creation) | No |
| `CreateSalesInvoiceUseCase` (direct invoice) | No |
| `PostSalesInvoiceUseCase` | No |

The check fires once, at the moment the operator confirms a DRAFT order. Re-confirming is not possible (confirmed orders do not revert to DRAFT), so there is no double-check problem.

---

## Follow-ups

**(a) Direct Sales Invoices are not credit-checked.**
A direct SI (no linked SO) bypasses `ConfirmSalesOrderUseCase` entirely. Customers operating in SIMPLE workflow or with approved direct-invoice governance can exceed their credit limit without a warning. A follow-up should run the credit check in `CreateSalesInvoiceUseCase` or `PostSalesInvoiceUseCase` for direct invoices.

**(b) Override is tied to SALES_ORDER only.**
`CreditOverride.sourceType` is currently typed as `'SALES_ORDER'`. Extending overrides to direct invoices requires adding `'SALES_INVOICE'` to the type and wiring the override flow there.

**(c) Exposure only counts POSTED invoices.**
CONFIRMED sales orders that have not yet been invoiced are not included in `currentExposure`. A customer could accumulate multiple confirmed orders that collectively exceed their limit if each individual order is under it. A stricter model would include confirmed-but-uninvoiced order amounts in the exposure calculation.

---

## See also

- [`docs/architecture/sales.md`](./sales.md) — Sales module overview
- [`docs/architecture/pricing.md`](./pricing.md) — Customer Party fields (creditLimit, creditHoldPolicy)
- [`docs/architecture/quotations.md`](./quotations.md) — Quotation lifecycle (no credit check at quote stage)
