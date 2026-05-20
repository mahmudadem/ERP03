# Architecture: Promotions Engine

**Last updated:** 2026-05-20
**Status:** Phase B complete. Rule entity, evaluation service, CRUD use cases, and evaluate endpoint are live. Auto-invocation inside SO/SI creation is **not yet wired** — see Follow-ups.

---

## Why this exists

Manual line discounts are flexible but do not scale. The promotions engine lets the business define reusable rules — buy-X-get-Y free goods, volume thresholds, category campaigns — that can be evaluated against an order or invoice's line set and return structured suggestions for the operator (or a future auto-apply flow) to act on.

---

## PromotionRule entity

**File:** `backend/src/domain/sales/entities/PromotionRule.ts`

### Header fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Auto-generated |
| `companyId` | string | Tenant scoping |
| `name` | string | Required |
| `type` | `'BUY_X_GET_Y'` \| `'THRESHOLD_DISCOUNT'` | Determines which config block is used |
| `status` | `'ACTIVE'` \| `'INACTIVE'` | Inactive rules are never suggested |
| `priority` | integer | Lower number = evaluated first. Default 0 |
| `validFrom` | string (YYYY-MM-DD, optional) | Inclusive start of validity window |
| `validTo` | string (YYYY-MM-DD, optional) | Inclusive end; must be >= validFrom |
| `scope` | `'ALL'` \| `'ITEMS'` \| `'CATEGORIES'` | Which items the rule covers |
| `itemIds` | string[] | Required when scope = `ITEMS` |
| `categoryIds` | string[] | Required when scope = `CATEGORIES` |
| `buyXGetY` | `BuyXGetYConfig` | Required when type = `BUY_X_GET_Y` |
| `thresholdDiscount` | `ThresholdDiscountConfig` | Required when type = `THRESHOLD_DISCOUNT` |

### BuyXGetYConfig

```ts
interface BuyXGetYConfig {
  buyQty: number;   // >= 1; quantity customer must purchase
  getQty: number;   // >= 1; quantity given free
  getItemId?: string; // the free item; defaults to the purchased item if omitted
}
```

### ThresholdDiscountConfig

```ts
interface ThresholdDiscountConfig {
  thresholdBasis: 'QTY' | 'AMOUNT'; // compare line qty or line amount
  thresholdValue: number;            // > 0; the threshold to meet
  discountPct: number;               // 0–100; percentage discount applied to the line
}
```

### Domain methods

**`isActiveOn(date: string): boolean`** — returns true only when `status === 'ACTIVE'` and the date falls within the optional validity window. Both bounds are inclusive.

**`appliesToItem(itemId, categoryId?): boolean`** — scope resolution:
- `ALL` → always true
- `ITEMS` → item must be in `itemIds`
- `CATEGORIES` → `categoryId` must be non-null and in `categoryIds`

---

## PromotionApplicationService (the evaluator)

**File:** `backend/src/application/sales/services/PromotionApplicationService.ts`

A **pure, stateless service** — no I/O, no repository calls. The caller is responsible for fetching and passing in the `PromotionRule[]` objects.

### Input types

```ts
interface PromotionEvalLine {
  lineId: string;
  itemId: string;
  categoryId?: string;
  qty: number;
  unitPriceDoc: number;
  lineAmountDoc: number;    // qty × unitPrice (pre-discount)
  hasManualDiscount: boolean; // true → line is exempt from auto threshold discounts
}
```

### Output types

```ts
interface FreeGoodsSuggestion {
  sourceLineId: string;  // the line that triggered the rule
  ruleId: string;
  ruleName: string;
  itemId: string;        // the free item (may differ from sourceLineId's item)
  qty: number;
}

interface LineDiscountSuggestion {
  lineId: string;
  ruleId: string;
  ruleName: string;
  discountPct: number;
}

interface PromotionEvaluationResult {
  freeGoods: FreeGoodsSuggestion[];
  lineDiscounts: LineDiscountSuggestion[];
}
```

Suggestions are advisory — the caller decides whether to act on them.

### Evaluation algorithm

```
1. Sort active rules by priority ascending (lower number first).
2. Filter to rules where isActiveOn(asOfDate) === true.
3. For each line:
   a. Iterate rules in priority order.
   b. BUY_X_GET_Y (at most one per line):
      - if rule appliesToItem() and line.qty >= cfg.buyQty:
        freeQty = floor(line.qty / cfg.buyQty) × cfg.getQty
        emit FreeGoodsSuggestion; mark bxgyApplied = true
   c. THRESHOLD_DISCOUNT (at most one per line):
      - skip if line.hasManualDiscount (manual always wins)
      - if rule appliesToItem() and threshold met:
        emit LineDiscountSuggestion; mark discountApplied = true
   d. Short-circuit if both mechanics are decided for this line.
4. Return { freeGoods, lineDiscounts }.
```

A line may receive both a free-goods suggestion and a discount suggestion — they come from separate mechanics and are independent.

### Priority ordering example

```
Rule A  priority=0  type=BUY_X_GET_Y  scope=ALL  buy 3 get 1
Rule B  priority=1  type=BUY_X_GET_Y  scope=ALL  buy 5 get 2
```

Rule A is evaluated first. If it fires (qty >= 3), `bxgyApplied` is set to true and Rule B is skipped for that line, even if the customer could also qualify for the Rule B bonus. The first matching rule wins.

### Worked BUY_X_GET_Y example

Setup: Rule "Buy 3 Get 1 Free" — `buyQty=3`, `getQty=1`, no `getItemId` (free item = purchased item).

| Line | itemId | qty | Fires? | Free qty |
|---|---|---|---|---|
| L1 | WIDGET | 3 | Yes | floor(3/3) × 1 = **1** |
| L2 | WIDGET | 7 | Yes | floor(7/3) × 1 = **2** |
| L3 | GADGET | 2 | No (qty < 3) | 0 |

The suggestion for L1 is: `{ sourceLineId: 'L1', itemId: 'WIDGET', qty: 1 }`.

### Manual-discount precedence rule

If a user has already set a discount on a line (`hasManualDiscount: true`), the evaluator **will not emit a `THRESHOLD_DISCOUNT` suggestion for that line**. The manual discount is considered an intentional business decision that takes precedence over automated campaign discounts.

BUY_X_GET_Y free-goods suggestions are not affected by `hasManualDiscount` — free goods are a different mechanic and a line can still receive free-goods alongside a manual discount.

---

## Use cases

**File:** `backend/src/application/sales/use-cases/PromotionUseCases.ts` (CRUD) and the evaluate endpoint.

| Use case | Purpose |
|---|---|
| `CreatePromotionRuleUseCase` | Persist a new rule with full validation |
| `UpdatePromotionRuleUseCase` | Update; re-runs all validations |
| `GetPromotionRuleUseCase` | Fetch by id |
| `ListPromotionRulesUseCase` | List with optional status filter |
| `DeletePromotionRuleUseCase` | Hard-delete |
| `EvaluatePromotionsUseCase` | Load active rules for the company, run `PromotionApplicationService.evaluate()`, return suggestions |

---

## API surface

All under `/tenant/sales/` (router: `backend/src/api/routes/sales.routes.ts`):

| Method | Path | Action |
|---|---|---|
| POST | `/promotions` | Create rule |
| GET | `/promotions` | List rules |
| GET | `/promotions/:id` | Get one rule |
| PUT | `/promotions/:id` | Update rule |
| DELETE | `/promotions/:id` | Delete rule |
| POST | `/promotions/evaluate` | Evaluate lines against active rules |

The evaluate endpoint accepts the line set and `asOfDate` in the request body and returns `{ freeGoods, lineDiscounts }`.

---

## Frontend

- **PromotionsPage** (`frontend/src/modules/sales/pages/`) — admin CRUD for promotion rules.

The evaluate endpoint is available but the Sales Order / Sales Invoice line editors do not yet call it automatically. Promotions must currently be applied manually (operator calls the endpoint and applies the suggestions).

---

## Follow-ups

**(a) Evaluator is not auto-invoked during SO/SI creation.**
`PromotionApplicationService` is built and tested but is not called inside `CreateSalesOrderUseCase`, `CreateSalesInvoiceUseCase`, or their post variants. The evaluate endpoint (`POST /promotions/evaluate`) must be called explicitly by the caller. Wiring auto-evaluation into the document creation flow — and deciding whether to auto-apply suggestions or present them for operator confirmation — is the primary follow-up.

**(b) Free-goods suggestions are advisory only.**
`FreeGoodsSuggestion` carries an item ID and quantity but does not create an order line or invoice line. The caller must act on the suggestion (add a zero-priced line) manually. An auto-apply path that inserts free-goods lines into the document is deferred.

**(c) No overlap / stacking control beyond "first rule wins per mechanic".**
The current model allows a line to receive both a free-goods and a discount suggestion from different rules. It does not support mutual-exclusion between named campaigns or maximum-discount-cap rules. These would require a more expressive conflict-resolution model.

---

## See also

- [`docs/architecture/sales.md`](./sales.md) — Sales module overview
- [`docs/architecture/pricing.md`](./pricing.md) — Price list and manual line discounts
