# Reporting Architecture (Sales Gross Profit — Task 246)

> Status: **Live** on `codex/246-sales-gross-profit-facts` (PR-ready). Owner
> has authorized this work despite the 2026-06-13 feature freeze (task
> marked "post-freeze candidate").

## Scope

Sales Gross Profit Facts is a **management reporting read model**. It is
the answer to questions like:

- "How much profit did this invoice make?"
- "How much profit did this item make?"
- "How much profit by document type / by item / by period?"

It is **not**:

- the accounting Profit & Loss
- the Trading Account
- Inventory Valuation
- FX revaluation
- a substitute for the accounting Trial Balance

It lives alongside the existing financial reports (`reports/profit-loss`,
`reports/trading-account`, `reports/trial-balance`, etc.) and is
intentionally read-only.

## Accounting Boundary (HARD)

The feature **must not** change any of:

- GL vouchers
- COGS posting
- Inventory valuation
- Stock movement costing
- FX revaluation
- Trading Account
- Profit & Loss
- Tax posting
- AR/AP balances

It is a read model only. All amounts and direction flags are derived
from already-posted invoice lines. No new ledger rows, no new
valuation entries, no new postings.

## Domain Model — `SalesProfitLineFact`

File: `backend/src/domain/reporting/entities/SalesProfitLineFact.ts`

One row per posted invoice line, type-agnostic. The `documentType` field
is the discriminator; the rest is generic.

| Field                | Type             | Notes                                  |
|----------------------|------------------|----------------------------------------|
| `id`                 | string           | `${companyId}_${documentId}_${documentLineId}_${snapshotVersion}` (deterministic) |
| `companyId`          | string           | Tenant scope                           |
| `documentType`       | enum             | `SALES_INVOICE` / `SALES_RETURN` / `PURCHASE_INVOICE` / `PURCHASE_RETURN` (extensible) |
| `documentId`         | string           | The posted document's id               |
| `documentNumber`     | string           | Display only (e.g. `SI-00001`)         |
| `documentLineId`     | string           | The line's id within the document      |
| `documentDate`       | ISO date         | The posting date                       |
| `itemId`             | string           | Only dimension stored on the fact     |
| `qtyBase`, `uomId`   | number, string   | Base UoM quantity                      |
| `docCurrency`        | string           | Document issuance currency             |
| `baseCurrency`       | string           | Company base currency                  |
| `exchangeRateDocToBase` | number        | Historical, frozen at posting          |
| `revenueAmountDoc`, `revenueAmountBase` | number | Always non-negative |
| `revenueDir`         | `'IN'\|'OUT'\|null` | `null` when revenue amount is 0   |
| `costAmountDoc`, `costAmountBase` | number | Always non-negative                  |
| `costDir`            | `'IN'\|'OUT'`    | Always set                             |
| `profitAmountDoc`, `profitAmountBase` | number | abs(revenue - cost), precomputed at snapshot time |
| `profitDir`          | `'IN'\|'OUT'`    | Derived by per-type rule               |
| `marginPct`          | number           | 0 when revenue is 0                    |
| `snapshotVersion`    | number           | Monotonic per `(company, document, line)`; amend/repost = new version |
| `status`             | enum             | `ACTIVE` / `SUPERSEDED` / `REVERSED`   |
| `createdAt`, `updatedAt` | ISO datetime |                                        |

**No broad dimensions** are stored. No `customerId`, no `itemName`, no
`salespersonId`, no `branchId`, no `regionId`, no `customerGroupId`. These
are joined at report time.

### Per-Type Direction Table (LOCKED 2026-06-20)

| `documentType`   | `revenueDir` | `costDir` | `profitDir` rule                       |
|------------------|:------------:|:---------:|----------------------------------------|
| `SALES_INVOICE`  | `IN`         | `OUT`     | follows revenue (flips to OUT on net loss) |
| `SALES_RETURN`   | `OUT`        | `IN`      | follows revenue (flips to IN on net gain) |
| `PURCHASE_INVOICE` | n/a (revenue=0) | `IN`  | always `OUT` (cost is a loss)         |
| `PURCHASE_RETURN`  | n/a (revenue=0) | `OUT` | always `IN` (cost reversal is a gain) |

Profit direction rule (in code, `buildSalesProfitLineFact`):

- if `revenueAmount > 0`: `profitDir = (rev - cost) >= 0 ? revenueDir : opposite(revenueDir)`
- if `revenueAmount = 0`: `profitDir = opposite(costDir)`

This handles the SI loss case (cost > revenue → profit OUT) and the SR
net-gain case (cost > revenue on a return → profit IN) correctly while
keeping PI/PR direction fixed by per-type table.

### Why Absolute + Direction

The owner-locked design stores each metric as `amount` + `dir` so:

- **IN-side and OUT-side are visible separately** in reports
  (e.g. "Total profit IN" vs "Total profit OUT" vs "Net profit = IN − OUT")
- **type-agnostic**: a PI's `cost IN` (goods coming in) and an SR's
  `cost IN` (goods being added back to inventory) both show as cost-IN,
  but their profit direction differs (PI → profit OUT, SR → profit OUT
  by table; different economic reason)
- **single source of truth**: the algebraic profit
  (`revenue - cost`) is precomputed and stored as `profitAmount` +
  `profitDir`, so reports do not need to re-derive it

The user/owner decides presentation (e.g. "show me only profit IN lines",
"show me net profit per document", "show me cost IN vs cost OUT
separately").

## Repository Contract

File: `backend/src/repository/interfaces/reporting/ISalesProfitLineFactRepository.ts`

```ts
interface ISalesProfitLineFactRepository {
  replaceForDocumentVersion(companyId, documentId, snapshotVersion, facts, transaction?): Promise<void>;
  markSupersededForDocument(companyId, documentId, supersededByVersion, transaction?): Promise<void>;
  markReversedForDocument(companyId, documentId, transaction?): Promise<void>;
  queryFacts(companyId, filters): Promise<SalesProfitLineFact[]>;
  aggregateByDocument(companyId, filters): Promise<ProfitFactAggregationRow[]>;
  aggregateByItem(companyId, filters): Promise<ProfitFactAggregationRow[]>;
}
```

**Both implementations** accept the same `(entity, _transaction?)`
pattern used by the rest of the codebase (Firestore: typed `Transaction`;
Prisma: cast to `any` and use the tx or fall back to the prisma client).

## Implementations

| Backend  | File                                                                                              |
|----------|---------------------------------------------------------------------------------------------------|
| Firestore | `backend/src/infrastructure/firestore/repositories/reporting/FirestoreSalesProfitLineFactRepository.ts` |
| Prisma    | `backend/src/infrastructure/prisma/repositories/reporting/PrismaSalesProfitLineFactRepository.ts`    |

**Firestore collection path:**
`companies/{companyId}/reporting/Data/profit_line_facts/{factId}`. Uses
`stripUndefined` helper before write (Firestore rejects nested `undefined`).

**Prisma model:** `SalesProfitLineFact` (in `backend/prisma/schema.prisma`)
with a back-relation on `Company`, unique on
`(companyId, documentId, documentLineId, snapshotVersion)`, and 5
composite indexes:

- `(companyId, documentDate)`
- `(companyId, documentId)`
- `(companyId, itemId, documentDate)`
- `(companyId, documentType, documentDate)`
- `(companyId, status)`

DI registration: `backend/src/infrastructure/di/bindRepositories.ts`
exposes `salesProfitLineFactRepository` (DB_TYPE-switched) and
`recordSalesProfitLineFactsUseCase` (singleton, constructed at module
scope so it shares the same repo instance).

## Snapshot Generation

File: `backend/src/application/reporting/use-cases/RecordSalesProfitLineFactsUseCase.ts`

```ts
interface RecordSalesProfitFactsInput {
  companyId, documentType, documentId, documentNumber, documentDate,
  docCurrency, baseCurrency, snapshotVersion,
  lines: PostedLineForProfitFact[],   // per-line shape
  transaction?: unknown                // posting tx handle
}
```

The use case is invoked **inside the existing posting transaction** of
`PostSalesInvoiceUseCase`, `PostSalesReturnUseCase`,
`PostPurchaseInvoiceUseCase`, and `PostPurchaseReturnUseCase`, after
the entity's `update` call. The transaction handle is passed through so
fact writes succeed/fail with the posting:

- If the posting fails, no fact is written (no orphan facts)
- If fact writing fails, the posting rolls back (no posted invoice
  without its facts)

### Per-Type Line Shape (caller-provided)

The use case takes absolute amounts (always non-negative); the direction
flags are determined by the per-type table inside
`buildSalesProfitLineFact`. The caller builds the line shape from the
posted document:

| Type    | revenueBase/Doc  | costBase/Doc  | Source on the posted line       |
|---------|------------------|---------------|----------------------------------|
| SI      | `lineTotalBase`  | `lineCostBase` | The invoice's posted line       |
| SR      | `returnQty × unitPrice` (gross) | `returnQty × unitCost` (gross) | The return's posted line |
| PI      | 0                | `lineTotalBase` (cost IS the line total) | The invoice's posted line |
| PR      | 0                | `returnQty × unitCost` (gross) | The return's posted line |

**Known limitation v1:** `SalesReturnLine` and `PurchaseReturnLine`
entities do not persist the post-discount, post-tax **net** line
totals (they're computed locally during posting and not stored back on
the line). SR/PR profit facts therefore use **gross** amounts
(`returnQty × unitPrice` for revenue, `returnQty × unitCost` for cost).
A follow-up task will add the net line totals to those entities for
accuracy on discounted / tax-inclusive lines. See
`planning/done/246-sales-gross-profit-facts.md` for the exact list.

### Idempotency

- `id` = `${companyId}_${documentId}_${documentLineId}_${snapshotVersion}` is deterministic.
- Re-posting the same document at the same `snapshotVersion` produces the same id, so `replaceForDocumentVersion` is a set (no duplicates).
- Amend/repost with a new `snapshotVersion` writes the new version and the prior version's `status` becomes `SUPERSEDED` (via `markSupersededForDocument`).
- Reversal sets `status = REVERSED` (via `markReversedForDocument`).

## Report Use Cases

| Use case                                       | File                                                                                | Group key       |
|------------------------------------------------|-------------------------------------------------------------------------------------|-----------------|
| `GetGrossProfitByDocumentUseCase`              | `backend/src/application/reporting/use-cases/GetGrossProfitByDocumentUseCase.ts`   | document        |
| `GetGrossProfitByItemUseCase`                  | `backend/src/application/reporting/use-cases/GetGrossProfitByItemUseCase.ts`       | item            |

Each returns:

```ts
{
  fromDate, toDate, documentType,
  rows: ProfitFactAggregationRow[],   // per group: IN/OUT/net in base + doc currency
  totals: { lineCount, profitBaseNet, profitBaseIn, profitBaseOut, ... }
}
```

Permission: `'accounting.reports.tradingAccount.view'` (v1 reuse; a
dedicated `'reporting.salesProfit.view'` permission can be introduced
without changing the use-case contract).

## HTTP Routes

| Method | Path                                       | Controller method                          |
|--------|--------------------------------------------|--------------------------------------------|
| GET    | `/api/v1/sales/reports/gross-profit/by-document` | `SalesGrossProfitController.grossProfitByDocument` |
| GET    | `/api/v1/sales/reports/gross-profit/by-item`     | `SalesGrossProfitController.grossProfitByItem`     |

Query params: `from`, `to` (ISO YYYY-MM-DD), `documentType` (single
or comma-separated), `itemId`, `docCurrency`, `limit`.

## What the Owner Will See in Reports

- **Per document** (e.g. SI-00001): one row showing revenue IN/OUT,
  cost IN/OUT, profit IN/OUT (all in base currency), with the same
  breakdown in the document's currency. Plus IN/OUT separate
  columns on the row.
- **Per item** (e.g. `itm_a`): one row summing across all documents
  that touched the item, with IN/OUT separate.
- **Net** is always available: `profitBaseNet = profitBaseIn − profitBaseOut`.
- The user can filter by `documentType` to see e.g. only
  `SALES_INVOICE` or only `PURCHASE_RETURN`.

## Future / Out of Scope

- **Frontend report pages** — separate slice. The two backend endpoints
  are ready; the frontend `ReportContainer` + module menu wiring is a
  follow-up.
- **`EntityDimensionAssignment` model** for branch/region/customer-group
  reports — future task. The current fact model does not store these
  dimensions; they are joined at report time from the document header.
- **Custom Form Designer document types** — the fact model is
  type-agnostic (`documentType: string` underlying), but wiring the
  per-type direction rule for custom document types is a follow-up.
- **Net line totals on SR/PR** — accuracy improvement; current SR/PR
  use gross amounts.

## Verification Summary

- `npx tsc --noEmit` → 0 errors
- `npm run build` → clean
- `npm test` (full backend suite) → 168/170 suites pass, 0 failures
  (1506 tests pass, 18 pre-existing skipped)
- 31/31 reporting tests pass (direction strategy, snapshot generator,
  report use cases)
- 70/70 SI/SR/PI/PR posting tests pass (no regression)
