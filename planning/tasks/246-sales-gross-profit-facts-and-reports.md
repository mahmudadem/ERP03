# Task 246 - Sales Gross Profit Facts and Management Reports

**Status:** Approved + in progress (2026-06-20)
**Owner:** Backend first, then frontend/reporting
**Estimated effort:** ~13 h backend first slice (4-type wiring + 2 reports + tests + docs)
**Feature type:** Management reporting read model, not accounting posting
**Worktree:** `D:\DEV2026\ERP03-246-sales-gross-profit` on branch `codex/246-sales-gross-profit-facts` (from `main @ 119e372f`)

## Goal

Build a database-agnostic gross-profit reporting layer that records a minimum historical profit fact per posted **invoice line of any document type** (sales + purchase + returns), then uses those facts to produce management reports such as:

- Gross Profit by Invoice (any document type)
- Gross Profit by Item (any document type)
- Gross Profit by Document Type / Document Number (filtered views)
- Later: Gross Profit by Customer, Salesperson, Branch, Region, Channel, Customer Group, Item Group, or other report-time criteria

This feature is for daily operational/business profit analysis. It is not the accounting Profit & Loss, not the Trading Account, not Inventory Valuation, and not FX revaluation.

## Scope Decisions (2026-06-20, owner-locked)

1. **Type-agnostic.** Generate profit facts for ALL invoice types: `SALES_INVOICE`, `SALES_RETURN`, `PURCHASE_INVOICE`, `PURCHASE_RETURN`, plus any future Form Designer document type that opts in. NOT sales-only.
2. **Model: absolute + direction** (not plain signed). Each metric is stored as `amount` + `dir` so reports can show IN-side and OUT-side separately and the user/owner decides presentation.
3. **No broad dimensions** on fact rows: no `customerId`, no `salespersonId`, no `itemName`. Joined at report time. Only `documentNumber` is stored (display identifier, not a grouping dimension).

## Accounting Boundary (HARD)

This task must not change:

- GL vouchers
- COGS posting
- Inventory valuation
- Stock movement costing
- FX revaluation
- Trading Account
- Profit & Loss
- Tax posting
- AR/AP balances

The gross-profit fact is a management read model built from already-posted invoice line data.

## Read Model — `SalesProfitLineFact`

One row per posted invoice line. The `documentType` field is the discriminator; everything below is generic.

```text
id                              // deterministic: companyId_documentId_documentLineId_snapshotVersion
companyId
documentType                    // SALES_INVOICE | SALES_RETURN | PURCHASE_INVOICE | PURCHASE_RETURN | <future>
documentId
documentNumber                  // display only, e.g. "SI-00001"
documentLineId
documentDate
itemId
qtyBase
uomId

docCurrency
baseCurrency
exchangeRateDocToBase

// Revenue (absolute + direction)
revenueAmountDoc                // abs
revenueAmountBase               // abs
revenueDir                      // 'IN' | 'OUT'  (null when revenueAmount = 0)

// Cost (absolute + direction)
costAmountDoc                   // abs
costAmountBase                  // abs
costDir                         // 'IN' | 'OUT'

// Profit (absolute + direction; derived at snapshot time, stored for query speed)
profitAmountDoc                 // abs(profit signed)
profitAmountBase                // abs(profit signed)
profitDir                       // 'IN' | 'OUT'

marginPct                       // based on absolute revenue; 0 when revenue = 0
snapshotVersion                 // monotonic per (companyId, documentId, documentLineId)
status                          // ACTIVE | SUPERSEDED | REVERSED

createdAt
updatedAt
```

**No broad dimensions**: no `customerId`, `salespersonId`, `itemName`, `customerName`, `branch`, `region`, `customerGroup`, `itemCategory`, etc. Report-time criteria are resolved by joining the document header and master data at query time.

## Per-Type Direction Table (LOCKED)

`IN` = metric adds to the running total. `OUT` = metric removes from the running total.

| `documentType`   | `revenueDir` | `costDir` | `profitDir` (derived) | Notes |
|------------------|:------------:|:---------:|:---------------------:|-------|
| `SALES_INVOICE`  | IN           | OUT       | IN                    | Goods leave inventory, money comes in. |
| `SALES_RETURN`   | OUT          | IN        | OUT                   | Refund leaves, goods return. **Cost basis = current avg cost at time of return** (from `ItemCostingStatsService`), NOT the original SI's cost. |
| `PURCHASE_INVOICE` | — (revenue=0) | IN      | OUT                   | Cost added to inventory; revenueAmount = 0. Stored as a loss fact. |
| `PURCHASE_RETURN` | — (revenue=0) | OUT     | IN                    | Cost removed from inventory; revenueAmount = 0. Stored as a gain fact. |

Profit direction rule (so the model is the single source of truth):

- if `revenueAmount > 0`: `profitDir = revenueDir` (profit follows revenue)
- if `revenueAmount = 0`: `profitDir = opposite(costDir)` (profit = −cost)

## Snapshot Formula

For each posted invoice line, after `lineCostBase` is finalized:

```text
revenueAmountDoc    = abs(line.lineTotalDoc)
revenueAmountBase   = abs(line.lineTotalBase)
revenueDir          = per-type table above
revenueDir = null   when revenueAmount = 0

costAmountDoc       = abs(line.lineCostBase) / exchangeRateDocToBase    // base→doc
costAmountBase      = abs(line.lineCostBase)
costDir             = per-type table above
// SR special: lineCostBase for SR is the CURRENT AVG COST at time of return
// (not the original SI cost). Looked up from ItemCostingStatsService.

// Signed algebra (used only to derive profit direction and stored amount):
signedRevenue       = revenueDir === 'IN' ?  revenueAmount : -revenueAmount
signedCost          = costDir     === 'IN' ?  costAmount    : -costAmount
signedProfit        = signedRevenue - signedCost

profitAmountDoc     = abs(signedProfit) converted to doc
profitAmountBase    = abs(signedProfit)
profitDir           = signedProfit >= 0 ? 'IN' : 'OUT'

marginPct           = revenueAmount == 0 ? 0 : (signedProfit / revenueAmount) * 100
```

Snapshot must be created in the same transaction as the underlying posting, so reports never miss a posted invoice. Snapshot failure must roll back the underlying posting.

## Idempotency

- `id` = `${companyId}_${documentId}_${documentLineId}_${snapshotVersion}` (deterministic, sortable).
- Re-posting the same document at the same version → `replaceForInvoiceVersion` is a no-op (set the same docs, same IDs).
- Amend/repost with a new `snapshotVersion` → `replaceForInvoiceVersion` writes the new version and `markSupersededForInvoice` retires the old version (sets `status = SUPERSEDED`).
- Reversal → `markReversedForInvoice` sets `status = REVERSED`.

## Future Criteria / Dimension Extension

Do not add new columns to `SalesProfitLineFact` per criterion. For flexible criteria, add a generic assignment model (future task):

```text
EntityDimensionAssignment
  companyId
  entityType: CUSTOMER | ITEM | SALESPERSON | WAREHOUSE | INVOICE | USER
  entityId
  dimensionType: BRANCH | REGION | CUSTOMER_GROUP | CHANNEL | ITEM_GROUP | ...
  dimensionId
  active
  createdAt
  updatedAt
```

Reports resolve report-time criteria via JOIN / batch-load. Out of scope for this slice.

## Corrections, Amendments, and Returns

- Posting retry must be idempotent (handled via deterministic `id`).
- Repost/amend: `markSupersededForInvoice` + new `snapshotVersion`.
- Reversal: `markReversedForInvoice`.
- Returns: included in v1 (SI/SR/PI/PR all wired). Returns create their own facts (negative-direction for SR, positive-direction for PR); they do NOT mutate the original invoice's facts.

## Backend Implementation Plan

### Slice A — Model + Repository Contract (~1.5 h)

- `backend/src/domain/reporting/entities/SalesProfitLineFact.ts` (new) — entity + value objects (Direction, DocumentType, FactStatus)
- `backend/src/repository/interfaces/reporting/ISalesProfitLineFactRepository.ts` (new) — interface
- `backend/src/api/dtos/reporting/SalesGrossProfitDtos.ts` (new) — DTOs + mappers

Repository methods (per the contract):

```text
replaceForInvoiceVersion(companyId, documentId, snapshotVersion, facts)
markSupersededForInvoice(companyId, documentId, supersededByVersion)
markReversedForInvoice(companyId, documentId)
queryFacts(filters)                                 // date range, docType, itemId, docCurrency, status
aggregateByDocument(filters)                        // for "GP by Invoice" report
aggregateByItem(filters)                            // for "GP by Item" report
```

### Slice B — Persistence (~2.5 h)

- `backend/src/infrastructure/firestore/repositories/reporting/FirestoreSalesProfitLineFactRepository.ts` (new)
- `backend/src/infrastructure/firestore/firestore.indexes.json` — add composite indexes:
  - `companyId + documentDate`
  - `companyId + documentId`
  - `companyId + itemId + documentDate`
  - `companyId + documentType + documentDate`
- `backend/src/infrastructure/prisma/repositories/reporting/PrismaSalesProfitLineFactRepository.ts` (new)
- `backend/prisma/schema.prisma` — add `SalesProfitLineFact` model (parity)
- `backend/src/infrastructure/di/bindRepositories.ts` — register both implementations

### Slice C — Snapshot Generation Hook (~2 h)

- `backend/src/application/reporting/use-cases/RecordSalesProfitLineFactsUseCase.ts` (new) — per-type direction strategy table; idempotent; uses `ItemCostingStatsService` for SR cost
- Wire into SI, SR, PI, PR posting transactions: `SalesInvoiceUseCases`, `SalesReturnUseCases`, `PurchaseInvoiceUseCases`, `PurchaseReturnUseCases` (find the actual files in recon)

### Slice D — Report Use Cases + Routes (~2 h)

- `GetGrossProfitByDocumentUseCase` (filterable by fromDate/toDate/documentType/itemId/docCurrency, returns rows grouped by `documentId`)
- `GetGrossProfitByItemUseCase` (same filters, rows grouped by `itemId`)
- Each row carries: `profitAmountBaseIn`, `profitAmountBaseOut`, `netProfitBase` (in − out), `profitAmountDocIn`, `profitAmountDocOut`, `netProfitDoc` (per currency), `revenueAmountBaseIn/Out`, `costAmountBaseIn/Out`, `marginPct`.
- `SalesGrossProfitController` + route registration under `/api/v1/reports/sales-gross-profit/...`

### Slice E — Tests (~2 h)

- Per-type direction computation (SI, SR, PI, PR — happy path)
- Base-currency vs foreign-currency
- SR with current-avg cost different from original SI cost (the 2-gain example)
- Idempotency: repost produces same `id` and no duplicate rows
- Grouping: by document and by item aggregation
- Posting-integration: SI/SR/PI/PR use cases each produce the right number of facts
- Mixed-direction aggregation: net profit = in − out

### Slice F — Verification + Docs (~1.5 h)

- `npm --prefix backend run build` ✅
- `npm --prefix backend test` (focused then full)
- `docs/architecture/reporting.md` (new)
- `docs/user-guide/reporting/sales-gross-profit.md` (new)
- `planning/done/246-sales-gross-profit-facts.md` (completion report)
- `planning/JOURNAL.md` appended

## Acceptance Criteria

- A posted base-currency `SALES_INVOICE` writes one fact per line with `revenueDir=IN`, `costDir=OUT`, `profitDir=IN`.
- A posted foreign-currency `SALES_INVOICE` writes stable `profitAmountDoc` (in invoice currency) and `profitAmountBase` (using historical rate).
- A posted `SALES_RETURN` uses the **current avg cost at time of return** for `lineCostBase`, not the original SI's cost.
- `PURCHASE_INVOICE` writes a fact with `revenueAmount=0`, `costDir=IN`, `profitDir=OUT`.
- `PURCHASE_RETURN` writes a fact with `revenueAmount=0`, `costDir=OUT`, `profitDir=IN`.
- Gross Profit by Document groups facts by `documentId` and exposes IN/OUT separately.
- Gross Profit by Item groups facts by `itemId` and exposes IN/OUT separately.
- Posting retry does not duplicate facts (deterministic `id`).
- Mixed-direction net = Σ profitDir='IN' − Σ profitDir='OUT' (verified in a test).
- No GL, COGS, inventory valuation, tax, AR/AP, or FX revaluation side effects.
- Backend build + tests pass.
- Reports use `ReportContainer` (backend route only in this slice; frontend wiring is a follow-up).

## Out of Scope (follow-up tasks)

- Frontend report pages (use `ReportContainer`).
- `EntityDimensionAssignment` model for branch/region/customer-group/etc. reports.
- Historical dimension snapshots (a separate versioned-assignment feature, not on every fact row).
- Custom Form Designer document types automatically wiring themselves up (the type is generic; an integration point is exposed, but no per-type tests in this slice).
