# Architecture: Sales Reporting (Phase C)

**Last updated:** 2026-05-20
**Status:** Phase C complete. AR Aging, Customer Ledger, Customer Statement, and three Sales Analytics reports are live. Pre-existing P&L and Inventory Valuation reports are documented in the "Related reports" section.

---

## Why this exists

Phase C fills the finance-reporting gap that existed after the order-to-cash transaction workflows were built. Accountants and managers need to answer: Who owes us money, for how long? What did a specific customer buy and pay? How are sales trending across customers, items, and salespeople? This module provides read-only use cases that answer all three questions from the posted-invoice and payment-history data that already exists on the operational side of Sales.

---

## Data sources

All reports in this module draw from two data repositories:

- **Posted Sales Invoices** — `ISalesInvoiceRepository.list(companyId, { status: 'POSTED' })`. Only invoices with status `POSTED` are included. DRAFT and CANCELLED invoices are excluded from every report in this module.
- **PaymentHistory** — `IPaymentHistoryRepository.getBySource(companyId, 'SALES_INVOICE', invoiceId)`. Payments are fetched per invoice (see Known Limitations — N+1).

---

## 1. AR Aging Report — `GetArAgingReportUseCase`

**File:** `backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts`

### Purpose

Answers: "How much do customers owe us right now, and how old is each balance?"

### Bucket algorithm

The aging date for each invoice is `dueDate ?? invoiceDate` — if a due date is set on the invoice it takes precedence; otherwise the invoice date is used as the aging anchor. This is important: an invoice with no due date ages from the day it was issued.

Days overdue = `floor((asOfDate − agingDate) / 86400000)` — whole days only, positive means past-due.

| Bucket | Condition |
|---|---|
| Current | `daysOverdue <= 0` (not yet due) |
| 1–30 days | `1 <= daysOverdue <= 30` |
| 31–60 days | `31 <= daysOverdue <= 60` |
| 61–90 days | `61 <= daysOverdue <= 90` |
| 90+ days | `daysOverdue > 90` |

Invoices with `outstandingAmountBase <= 0.005` are excluded (fully paid, within floating-point tolerance).

### Customer grouping and totals

The use case groups qualifying invoices by `customerId`. Each `ArAgingCustomerRow` carries per-bucket subtotals and a `total` field, plus the full list of contributing `ArAgingInvoiceDetail` records. A cross-customer `totals` object is computed by summing all rows.

`asOfDate` defaults to today (ISO date) if not provided by the caller. An optional `customerId` filter narrows the report to a single customer.

### Input / output shape

```ts
input:  { companyId, asOfDate?, customerId? }
output: ArAgingReport { asOfDate, rows: ArAgingCustomerRow[], totals }
```

Each `ArAgingCustomerRow` includes `current`, `days1_30`, `days31_60`, `days61_90`, `days90Plus`, `total`, and the raw `invoices` list. Every `ArAgingInvoiceDetail` records `daysOverdue` and `bucket` for drill-down.

---

## 2. Customer Ledger — `GetCustomerLedgerUseCase`

**File:** `backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts`

### Purpose

Answers: "Show me every invoice and payment for this customer in date order, with a running balance."

### Event model

Each event in the ledger is either:

- **INVOICE** — a debit (the customer owes more). `debit = grandTotalBase`, `credit = 0`.
- **PAYMENT** — a credit (the customer has paid). `debit = 0`, `credit = amountBase`.

Events are sorted chronologically by date. When an invoice and a payment share the same date, the invoice sorts first (`sortOrder 0 < 1`). This ensures the running balance never briefly goes negative on a same-day pay-and-invoice scenario.

### Running balance and period filtering

The use case replays all raw events for the customer in order, accumulating a running balance. When `fromDate` / `toDate` bounds are provided:

- Events strictly before `fromDate` are consumed but not emitted — they advance the `openingBalance`.
- Events within the period are emitted with their running balance stamped.
- Events after `toDate` are skipped entirely.

`closingBalance` is derived as `openingBalance + Σ(period debits) − Σ(period credits)`, not by reading a stored balance. This means no separate balance-tracking field is needed.

When no `fromDate` is given, `openingBalance = 0` and `closingBalance` is the full lifetime balance.

### Input / output shape

```ts
input:  { companyId, customerId, fromDate?, toDate? }
output: CustomerLedger {
  customerId, customerName, fromDate?, toDate?,
  openingBalance, events: LedgerEvent[], closingBalance
}
```

---

## 3. Customer Statement — `GetCustomerStatementUseCase`

**File:** `backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts`

### Purpose

Answers: "What is this customer's account position for the period — opening balance, all activity, closing balance, and what is still open?"

### Relationship to the Ledger use case

`GetCustomerStatementUseCase` internally constructs a `GetCustomerLedgerUseCase` and delegates all event-building and balance derivation to it. It then adds:

- `totalInvoiced` — sum of all INVOICE debit events in the period.
- `totalPaid` — sum of all PAYMENT credit events in the period.
- `openInvoices` — all posted invoices for the customer with `outstandingAmountBase > 0.005`, regardless of whether they fall within the statement period. This represents the current open AR as of the statement run time, not a period-bounded snapshot.

`fromDate` and `toDate` are both required for a statement (unlike the ledger where they are optional).

### Input / output shape

```ts
input:  { companyId, customerId, fromDate, toDate }
output: CustomerStatement {
  customerId, customerName, fromDate, toDate,
  openingBalance, closingBalance,
  lines: LedgerEvent[],
  totalInvoiced, totalPaid,
  openInvoices: [ { invoiceId, invoiceNumber, invoiceDate, dueDate,
                    grandTotalBase, outstandingAmountBase } ]
}
```

---

## 4. Sales Analytics — `SalesAnalyticsUseCases.ts`

**File:** `backend/src/application/sales/use-cases/SalesAnalyticsUseCases.ts`

All three analytics use cases share the same pattern:

1. Load all POSTED invoices for the company.
2. Filter by `fromDate` / `toDate` on `invoiceDate` using inclusive string comparison on `YYYY-MM-DD` format (safe because ISO date strings sort lexicographically).
3. Aggregate into a map, keyed by the grouping dimension.
4. Sort rows descending by revenue.
5. Compute cross-row totals.

Date bounds are both optional — omitting both returns all-time data.

### 4a. Sales by Customer — `GetSalesByCustomerUseCase`

Groups posted invoices by `customerId`. Per row: `invoiceCount`, `totalRevenueBase` (Σ `subtotalBase`), `totalTaxBase` (Σ `taxTotalBase`), `totalGrossBase` (Σ `grandTotalBase`). Rows sorted descending by `totalRevenueBase`.

### 4b. Sales by Item — `GetSalesByItemUseCase`

Iterates invoice lines (not invoice headers). Groups by `line.itemId`. Per row: `totalQty` (Σ `invoicedQty`), `totalRevenueBase` (Σ `lineTotalBase`), `lineCount`. Rows sorted descending by `totalRevenueBase`.

### 4c. Sales by Salesperson — `GetSalesBySalespersonUseCase`

Groups by `inv.salespersonId`. Invoices with no salesperson assigned use the synthetic key `UNASSIGNED` / name `"Unassigned"`. A salesperson name lookup is pre-loaded from `ISalespersonRepository.list` into a map before iterating invoices, so names resolve in O(1). Per row: `invoiceCount`, `totalRevenueBase` (Σ `subtotalBase`), `totalGrossBase` (Σ `grandTotalBase`). Note: tax subtotals are not broken out in this report. Rows sorted descending by `totalRevenueBase`.

---

## API routes

All under `GET /tenant/sales/reports/` (controller: `SalesReportingController`):

| Method | Path | Use case |
|---|---|---|
| GET | `/tenant/sales/reports/ar-aging` | `GetArAgingReportUseCase` |
| GET | `/tenant/sales/reports/customer-ledger` | `GetCustomerLedgerUseCase` |
| GET | `/tenant/sales/reports/customer-statement` | `GetCustomerStatementUseCase` |
| GET | `/tenant/sales/reports/sales-by-customer` | `GetSalesByCustomerUseCase` |
| GET | `/tenant/sales/reports/sales-by-item` | `GetSalesByItemUseCase` |
| GET | `/tenant/sales/reports/sales-by-salesperson` | `GetSalesBySalespersonUseCase` |

Query parameters follow the field names documented above (`asOfDate`, `customerId`, `fromDate`, `toDate`).

---

## Frontend pages

| Page | Reports served |
|---|---|
| `ArAgingReportPage` | AR Aging |
| `CustomerStatementPage` | Customer Statement (Statement tab) + Customer Ledger (Ledger tab toggle) |
| `SalesAnalyticsPage` | Three tabs: By Customer, By Item, By Salesperson |

All pages are under `frontend/src/modules/sales/pages/`.

---

## Related reports

These reports pre-date Phase C but form the other half of the finance-reporting surface:

**Profit & Loss**
- Use case: `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts`
- Algorithm: `closingTrialBalance(toDate) − openingTrialBalance(fromDate − 1)`. Accounts are classified by `account.classification` (REVENUE / EXPENSE) and further broken down by `account.plSubgroup` (SALES, OTHER_REVENUE, COST_OF_SALES, OPERATING_EXPENSES, OTHER_EXPENSES). Untagged accounts are placed in an "unclassified" bucket. The structured breakdown is only emitted when at least one account carries a `plSubgroup` tag.
- Permission: `accounting.reports.profitAndLoss.view`
- Frontend: `ProfitAndLossPage`

**Inventory Valuation**
- Use cases: `backend/src/application/inventory/use-cases/PeriodSnapshotUseCases.ts` — `GetAsOfValuationUseCase` (snapshot + movement replay to a specific date), `CreatePeriodSnapshotUseCase` (capture current stock levels as a period snapshot).
- Routes: `GET /valuation/as-of`, `GET /valuation`, `POST /snapshots`
- The as-of valuation loads the nearest preceding period snapshot and replays subsequent stock movements (weighted-average cost) up to the requested date.

---

## Known limitations / follow-ups

**(a) N+1 payment lookups in Customer Ledger and Statement.**
`GetCustomerLedgerUseCase._buildRawEvents` iterates all of the customer's posted invoices and calls `paymentHistoryRepo.getBySource(...)` once per invoice. At pre-alpha scale (tens of invoices per customer) this is acceptable. When customer invoice counts grow to hundreds, a batch-by-customer payment query should replace the per-invoice lookup.

**(b) Reports are not paginated.**
All six report endpoints return the full result set in a single response. Large tenants with many customers or items will see growing response payloads. Pagination or server-side cursor streaming should be added before production scale.

**(c) No server-side caching.**
Reports are recomputed on every request. A short TTL cache (e.g. 60–300 seconds) keyed on `(companyId, reportType, params)` would reduce Firestore reads significantly for frequently-viewed reports.

**(d) `openInvoices` in Customer Statement is not period-bounded.**
The open-invoice list in `GetCustomerStatementUseCase` reflects the customer's currently open invoices (as of query time), not those that were open as of `toDate`. A true historical snapshot of open invoices at `toDate` would require replaying payment events up to that date — a follow-up for when audit-quality statements are required.

**(e) Sales by Salesperson excludes tax breakdown.**
Unlike Sales by Customer, the salesperson aggregation does not expose `totalTaxBase` per row. This was intentional (tax is not a salesperson performance metric) but can be added if reporting requirements demand it.

---

## See also

- [`docs/architecture/sales.md`](./sales.md) — Sales module overview and transaction workflows
- [`docs/architecture/commissions.md`](./commissions.md) — Salesperson commission ledger (related to salesperson master data)
