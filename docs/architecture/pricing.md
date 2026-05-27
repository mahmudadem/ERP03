# Architecture: Pricing — Price Lists and Customer Segmentation

**Last updated:** 2026-05-20
**Status:** Phase A complete. Price list CRUD, tiered pricing, effective-price resolution, customer group master data, and tax-inclusive pricing are all live.

---

## Why this exists

Manual price entry on every invoice line is error-prone and inconsistent. Price lists let the business define structured pricing once — with optional date windows and quantity tiers — and have the invoice line auto-populate the correct price. Customer groups add a segmentation layer so different customer segments can be routed to different default prices and payment terms.

---

## PriceList entity

**File:** `backend/src/domain/sales/entities/PriceList.ts`

### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Auto-generated |
| `companyId` | string | Tenant scoping |
| `name` | string | Required, trimmed |
| `currency` | string | ISO 4217, exactly 3 chars |
| `status` | `ACTIVE` \| `INACTIVE` | Only `ACTIVE` lists participate in resolution |
| `validFrom` | Date (optional) | Inclusive lower bound of the date window |
| `validTo` | Date (optional) | Inclusive upper bound; must be >= `validFrom` |
| `isDefault` | boolean | Marks the company-wide fallback for this currency |
| `lines` | `PriceListLine[]` | Zero or more price lines |

There is at most one default per `(companyId, currency)` pair. Setting `isDefault = true` on a new or updated list atomically clears the flag on any previous default for the same currency (via a Firestore transaction inside `CreatePriceListUseCase` / `UpdatePriceListUseCase`).

### PriceListLine

```ts
interface PriceListLine {
  itemId: string;       // inventory item
  minQty: number;       // quantity threshold for this tier (default 1)
  unitPrice: number;    // must be > 0
  discountPct?: number; // optional percentage discount (0–100)
  comment?: string;
}
```

Constructor validation enforces:
- `unitPrice > 0`
- `minQty >= 0`
- no duplicate `(itemId, minQty)` pairs within the same list

### Tiered pricing: `getEffectiveLine(itemId, qty)`

Multiple lines for the same `itemId` represent quantity break tiers. The method selects the line with the **highest `minQty` that is still ≤ `qty`** — i.e., the best-matching tier the customer has reached.

```ts
getEffectiveLine(itemId: string, qty: number): PriceListLine | null {
  const itemLines = this.lines
    .filter((l) => l.itemId === itemId && l.minQty <= qty)
    .sort((a, b) => b.minQty - a.minQty);  // descending
  return itemLines[0] ?? null;
}
```

Returns `null` if:
- the item has no lines in this list, or
- `qty` is below the smallest `minQty` tier for the item.

**Worked example — tiered pricing:**

| minQty | unitPrice |
|--------|-----------|
| 1      | 100.00    |
| 10     | 90.00     |
| 50     | 80.00     |

- Order qty 5 → tier `minQty 1` → unit price **100.00**
- Order qty 10 → tier `minQty 10` → unit price **90.00**
- Order qty 49 → tier `minQty 10` → unit price **90.00**
- Order qty 50 → tier `minQty 50` → unit price **80.00**
- Order qty 0 → no tier applies → `null` returned

### Date validity: `isActiveOn(date)`

```ts
isActiveOn(date: Date): boolean {
  if (this.status !== 'ACTIVE') return false;
  if (this.validFrom && date < this.validFrom) return false;
  if (this.validTo   && date > this.validTo)   return false;
  return true;
}
```

Both `validFrom` and `validTo` are optional. Omitting both means the list is always active (when status is `ACTIVE`). Partial windows (only a `validFrom`, or only a `validTo`) are valid.

---

## Price list use cases

**File:** `backend/src/application/sales/use-cases/PriceListUseCases.ts`

| Use case | Purpose |
|---|---|
| `CreatePriceListUseCase` | Creates list; if `isDefault`, atomically demotes previous default for the same currency |
| `UpdatePriceListUseCase` | Rebuilds entity from input to re-run all validations; same default-demotion logic |
| `DeletePriceListUseCase` | Hard-deletes; no cascade guard yet |
| `GetPriceListUseCase` | Fetch by id |
| `ListPriceListsUseCase` | Filtered list (currency, status, pagination) |
| `GetEffectivePriceUseCase` | Resolve the right unit price for a customer + item + qty on a given date |

### Effective-price resolution: `GetEffectivePriceUseCase`

The resolution order is:

1. **Customer override** — if the `Party` record has a `defaultPriceListId` (the customer's own assigned list), load it and check `isActiveOn(asOf)`. If active, use it.
2. **Currency default** — if no active override list was found, fall back to the company's default price list for the customer's `defaultCurrency` (`priceListRepo.getDefaultForCurrency`). If active, use it.
3. **Null** — if neither resolves, return `null` (caller falls back to manual entry).

In both cases, `getEffectiveLine(itemId, qty)` is called on the resolved list. If that also returns null (no matching tier), the result is `null`.

The result shape:

```ts
interface GetEffectivePriceResult {
  unitPrice: number;
  sourcePriceListId: string;
  sourceLineId: string;  // composite key: "itemId:minQty"
  isDefault: boolean;
}
```

---

## Customer Groups and customer master fields

### CustomerGroup entity

**File:** `backend/src/domain/sales/entities/CustomerGroup.ts`

Customer groups are segments — buckets of customers that share default commercial terms.

| Field | Type | Notes |
|---|---|---|
| `defaultPriceListId` | string (optional) | The price list to apply to ungrouped-field customers in this segment |
| `defaultPaymentTermsDays` | number (optional) | ≥ 0 |
| `defaultCreditLimit` | number (optional) | ≥ 0, in base currency |
| `taxExempt` | boolean | Default false |
| `status` | `ACTIVE` \| `INACTIVE` | |

Groups are purely a data/segmentation construct. They do not enforce anything at runtime in Phase A — they serve as defaults the UI can pre-fill when creating or editing a customer.

### Party fields added in Phase A

**File:** `backend/src/domain/shared/entities/Party.ts`

The shared `Party` entity gained four customer-oriented fields:

| Field | Type | Notes |
|---|---|---|
| `customerGroupId` | string (optional) | Reference to a `CustomerGroup` |
| `creditLimit` | number (optional) | ≥ 0, per-customer override |
| `creditHoldPolicy` | `'NONE'` \| `'WARN'` \| `'BLOCK'` | Master data only in Phase A |
| `defaultPriceListId` | string (optional) | Per-customer price list override |
| `taxExempt` | boolean (optional) | Per-customer tax exemption flag |

**Important:** `creditHoldPolicy` stores the customer's credit-hold intent but enforcement (blocking or warning at Sales Order confirm) is **deferred to Phase B**. Phase A only persists the field.

The relationship between group and customer defaults is hierarchical in intent: a customer with no own `defaultPriceListId` could inherit from its group's `defaultPriceListId`. However, `GetEffectivePriceUseCase` does **not yet walk the group** — it only consults the customer's own `defaultPriceListId` and the currency-level default (see Known Limitations).

---

## Tax-inclusive pricing

**File:** `backend/src/application/sales/services/SalesInvoiceCalculationService.ts`

When a price list (or manually entered price) is marked as tax-inclusive, the `priceIsInclusive` flag must be set on the invoice line calculation input. The service then treats the `unitPriceDoc` as a gross (inclusive) price and back-calculates the net.

### Algorithm

```
grossLineTotalDoc = roundMoney(qty × unitPriceDoc)         // inclusive amount
discountAmountDoc = roundMoney(gross × discountPct / 100)  // applied to gross
postDiscountDoc   = roundMoney(gross - discount)
lineTotalDoc      = roundMoney(postDiscountDoc / (1 + taxRate))  // net ex-tax
taxAmountDoc      = roundMoney(postDiscountDoc - lineTotalDoc)    // back-calculated
```

For exclusive pricing (default), `divisor = 1` so `lineTotalDoc = postDiscountDoc` and `taxAmountDoc = lineTotalDoc × taxRate`.

**Note on `taxAmountBase`:** For both modes, `taxAmountBase = roundMoney(lineTotalBase × taxRate)`. This means tax in base is computed from the net-in-base multiplied by the rate, not back-calculated from the inclusive base amount. See Known Limitations.

### Worked example — inclusive pricing at 10% tax, 5% discount

| | Doc currency |
|---|---|
| Unit price (inclusive) | 110.00 |
| Qty | 1 |
| Gross line total | 110.00 |
| Discount (5%) | 5.50 |
| Post-discount inclusive | 104.50 |
| Net (÷ 1.10) | **95.00** |
| Tax (back-calc) | **9.50** |
| Grand total | 104.50 |

Compare to exclusive pricing at the same net (100.00 ex-tax, 10% tax, no discount):
- Net 100.00, Tax 10.00, Grand total 110.00

---

## API endpoints

All under `POST|GET|PUT|DELETE /tenant/sales/` (router: `backend/src/api/routes/sales.routes.ts`):

| Method | Path | Action |
|---|---|---|
| POST | `/price-lists` | Create |
| GET | `/price-lists` | List (supports `currency`, `status` filters) |
| GET | `/price-lists/effective-price` | Resolve effective price for customer+item+qty |
| GET | `/price-lists/:id` | Get one |
| PUT | `/price-lists/:id` | Update |
| DELETE | `/price-lists/:id` | Delete |
| POST | `/customer-groups` | Create |
| GET | `/customer-groups` | List |
| GET | `/customer-groups/:id` | Get one |
| PUT | `/customer-groups/:id` | Update |
| DELETE | `/customer-groups/:id` | Delete |
| POST | `/customer-groups/assign` | Assign a customer to a group |

Controller: `backend/src/api/controllers/sales/SalesMasterDataController.ts`

---

## Frontend

- **PriceListsPage** — CRUD list/form for price lists, including tiered line editor.
- **CustomerGroupsPage** — CRUD for customer groups.
- **PartyMasterCard COMMERCIAL tab** — extended with `customerGroupId`, `creditLimit`, `creditHoldPolicy`, `defaultPriceListId`, `taxExempt`.
- **SalesInvoice line editor** — auto-fetches effective price when item or qty changes (calls `GET /price-lists/effective-price`).
- **`salesLinePriceResolver`** (`frontend/src/modules/sales/services/salesLinePriceResolver.ts`) — shared resolver used by both the native sales pages and the Forms Designer renderer (`GenericVoucherRenderer`). Exposes:
  - `isSalesDocumentDefinition(definition)` — detects sales documents (invoice, order, quote, return, delivery note) from a Forms Designer config.
  - `resolveSalesLinePrice({ customerId, itemId, qty, asOfDate })` — non-throwing wrapper around `getEffectivePrice` that returns `null` on miss/error.
  Wiring lives in `GenericVoucherRenderer.handleRowChange` (line-level: refires on itemId / quantity change) and a customer-watcher effect (refires every priced line when the header customer changes). This is the mechanism that makes Forms Designer–rendered sales invoices auto-fill the unit price exactly like `SalesInvoiceDetailPage`.

All under `frontend/src/modules/sales/pages/` and `frontend/src/modules/sales/services/`.

---

## Known limitations / follow-ups

**(a) Invoice currency vs customer default currency.**
`GetEffectivePriceUseCase` derives the fallback currency from the customer's `Party.defaultCurrency`. A future revision should accept an explicit invoice-currency parameter so that a customer with `defaultCurrency = USD` but a one-off EUR invoice still resolves the EUR default price list correctly.

**(b) `taxAmountBase` drift for inclusive pricing under FX.**
`taxAmountBase` is computed as `lineTotalBase × taxRate` rather than back-calculating from the inclusive base amount. This means sub-cent drift is possible when the exchange rate is not 1:1. The simpler formula is acceptable for pre-alpha; revisit before the first multi-currency inclusive-price deployment.

**(c) Customer-group price list not walked by `GetEffectivePriceUseCase`.**
The data model supports a three-level hierarchy (customer override → group default → currency default). However, the current resolution only checks the customer's own `defaultPriceListId` and then the currency default. A customer with no own price list but a group with `defaultPriceListId` will receive the currency default, not the group list. This gap should be closed once the group assignment workflow is mature.

**(d) No cascade protection on delete.**
Deleting a price list that is still referenced by customer records or groups is currently permitted at the use case layer. A follow-up should add a reference check before allowing deletion.

---

## See also

- [`docs/architecture/sales.md`](./sales.md) — Sales module overview
- [`docs/architecture/commissions.md`](./commissions.md) — Salesperson and commission ledger
