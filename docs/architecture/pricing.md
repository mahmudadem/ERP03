# Architecture: Pricing — Price Lists and Customer Segmentation

**Last updated:** 2026-06-19
**Status:** Price list CRUD, tiered pricing, effective-price resolution, customer group master data, tax-inclusive pricing, and Task 241 party-item price memory are live.

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

### Task 241 observed price memory

Task 241 adds observed price memory beside configured price lists. The system now remembers real posted transaction prices at two levels:

| Level | Scope | Storage |
|---|---|---|
| Last-event | Last sale / purchase price for an item from anyone | `Item.costingStats.lastSalePriceByCcyUom` and `lastPurchaseCostByCcyUom` |
| Last-for-party | Last sale / purchase price for a specific party + item | `party_item_prices/{partyId}__{itemId}` and SQL `party_item_prices` |

Observed price memory is stored natively per `(currency, uomId)`. The map key convention is `${currency}__${uomId}`, for example `USD__uom_box`. Every stored point carries `base`, `ccy`, `currency`, `fxRateToBase`, `asOf`, `qty`, `uomId`, and source document metadata.

Average cost is intentionally different from price memory. The moving average remains a single base-currency, base-UOM cost point on the item. A document line in another currency or UOM derives cost from that one average using the document exchange rate, the item UOM conversion factor, and `InventorySettings.inventoryFxCostBasis` (`REPLACEMENT` default, `HISTORICAL` optional). There is no average selling price and no per-currency/per-UOM average cost store.

### Strict resolution after Task 242

Native sales and purchase line defaults now pass the document currency, exchange rate, and line UOM into the resolver. The chain is:

Task 242 changed line-price resolution from a cascading fallback chain to strict single-source resolution. The company setting `InventorySettings.defaultLinePriceSource` selects exactly one source:

| Policy | Sales source | Purchase source | Miss behavior |
|---|---|---|---|
| `LAST_PARTY_PRICE` | Last price for this customer and item | Last cost for this vendor and item | Blank line |
| `PRICE_LIST` | Customer/default sales price list | Vendor/default purchase price list | Blank line |
| `LAST_EVENT` | Last sale event for this item with any customer | Last purchase event for this item with any vendor | Blank line |
| `ITEM_DEFAULT` | Item `salePrice` | Item `purchasePrice` | Blank line |

The default is `LAST_PARTY_PRICE`. This means a returning customer/vendor can receive their own last price automatically, while a new customer/vendor with no memory gets a blank line for manual entry. The resolver never borrows another customer/vendor's item-level last event and never cascades from one policy to another.

`LAST_EVENT` is intentionally not part of the persistent `InventorySettings.defaultLinePriceSource` enum. It is available as a document-level override for users who explicitly want the last item event, but the company default stays conservative.

### Document-level source override after Task 243-A

Task 243-A added an optional `priceSource` query parameter to the effective-price endpoints:

| Endpoint | Parameter | Values |
|---|---|---|
| `GET /tenant/sales/price-lists/effective-price` | `priceSource` | `PRICE_LIST`, `LAST_PARTY_PRICE`, `LAST_EVENT`, `ITEM_DEFAULT` |
| `GET /tenant/purchase/price-lists/effective-price` | `priceSource` | `PRICE_LIST`, `LAST_PARTY_PRICE`, `LAST_EVENT`, `ITEM_DEFAULT` |

If `priceSource` is omitted, the resolver uses `InventorySettings.defaultLinePriceSource`. If it is supplied, it replaces the company default for that lookup only. The override is strict: `priceSource=PRICE_LIST` checks only the applicable price list; `priceSource=LAST_EVENT` checks only item-level last event memory; no fallback chain is reintroduced.

Native Sales Invoice, Purchase Invoice, and Purchase Order draft headers expose this as **Line price source**. Forms Designer-rendered sales/purchase line tables expose the same selector above the line grid and pass it through the shared `salesLinePriceResolver` / `purchaseLinePriceResolver` services.

Missing currency records are never auto-converted for prices. A USD document reads USD memory; an EUR document with no EUR record remains manual until the user types the first EUR price.

Missing UOM records are controlled by module settings:

| Setting | Default | Behavior |
|---|---|---|
| `salesSettings.deriveLinePriceAcrossUom` | `false` | If true, sales can derive same-party, same-currency remembered prices across UOMs using fixed item UOM factors. |
| `purchaseSettings.deriveLinePriceAcrossUom` | `false` | If true, purchases can derive same-vendor, same-currency remembered prices across UOMs using fixed item UOM factors. |

The derivation is same-currency only. Example: if a customer last bought a box for 10 USD and the box equals 4 units, a unit line can default to 2.5 USD only when the sales flag is on. The user can always override the default. Cost derivation is not optional; cost always derives across UOM/currency from the single average cost.

### Write path and parity

Posting `Sales Invoice`, `Sales Return`, `Purchase Invoice`, and `Purchase Return` updates price memory inside the same posting transaction:

- Sales documents write selling price to item `lastSalePriceByCcyUom` and party `lastSaleByCcyUom`.
- Purchase documents write purchase cost to item `lastPurchaseCostByCcyUom` and party `lastPurchaseByCcyUom`.
- Firestore stores party memory in `companies/{companyId}/party_item_prices/{partyId}__{itemId}`.
- SQL parity is `party_item_prices` with PK `(company_id, party_id, item_id)` and JSON maps for sale/purchase memory.

Firestore writes strip nested `undefined` values before persisting optional source metadata; this is required because real emulator writes reject undefined nested fields.

### Verification guard

`backend/scripts/task241-emulator-smoke.cjs` is a compiled-backend smoke script. Run it against a Firestore emulator after `npm --prefix backend run build`:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:GCLOUD_PROJECT='erp-03'
node backend/scripts/task241-emulator-smoke.cjs
```

The smoke posts a service Sales Invoice and Purchase Invoice through compiled `backend/lib` use cases, then reads back item-level and party-level `USD__uom_each` memory records from Firestore.

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
| `defaultPriceListId` | string (optional) | Per-customer/vendor price list override |
| `taxExempt` | boolean (optional) | Per-customer tax exemption flag |

**Important:** `creditHoldPolicy` stores the customer's credit-hold intent but enforcement (blocking or warning at Sales Order confirm) is **deferred to Phase B**. Phase A only persists the field.

The relationship between group and customer defaults is hierarchical in intent: a customer with no own `defaultPriceListId` could inherit from its group's `defaultPriceListId`. However, `GetEffectivePriceUseCase` does **not yet walk the group** — it only consults the party's own `defaultPriceListId` and the currency-level default (see Known Limitations).

The shared party master card already exposes `defaultPriceListId` for both customer and vendor commercial tabs. Task 243-A reuses that field rather than creating a second party-level pricing setting.

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
- **SalesInvoice line editor** — auto-fetches effective price when item or qty changes (calls `GET /price-lists/effective-price`) and lets users choose the document's line price source.
- **PurchaseInvoice / PurchaseOrder line editors** — auto-fetch purchase effective price and let users choose the document's line price source.
- **LinePriceSourceSelector** — shared UI component at `frontend/src/components/shared/pricing/LinePriceSourceSelector.tsx`.
- **`salesLinePriceResolver`** (`frontend/src/modules/sales/services/salesLinePriceResolver.ts`) — shared resolver used by both the native sales pages and the Forms Designer renderer (`GenericVoucherRenderer`). Exposes:
  - `isSalesDocumentDefinition(definition)` — detects sales documents (invoice, order, quote, return, delivery note) from a Forms Designer config.
  - `resolveSalesLinePrice({ customerId, itemId, qty, asOfDate, priceSource })` — non-throwing wrapper around `getEffectivePrice` that returns `null` on miss/error.
  Wiring lives in `GenericVoucherRenderer.handleRowChange` (line-level: refires on itemId / quantity change) and a customer-watcher effect (refires every priced line when the header customer changes). This is the mechanism that makes Forms Designer–rendered sales invoices auto-fill the unit price exactly like `SalesInvoiceDetailPage`.

All under `frontend/src/modules/sales/pages/` and `frontend/src/modules/sales/services/`.

---

## Known limitations / follow-ups

**(a) Legacy callers may omit document currency.**
Native sales/purchase line resolvers now pass document currency, exchange rate, and UOM into the backend resolver. Any older custom caller that still omits currency will fall back to the party default currency behavior and should be updated before relying on multi-currency price memory.

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
