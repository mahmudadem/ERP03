# Task 279 — Derived Balance and Card-State Cache

**Status:** Future task — documented only, not implemented
**Lane:** Production architecture follow-up
**Estimated effort:** 3–6 days for first production-safe slice; 1–2 weeks for full cross-module coverage
**Owner decision captured:** 2026-07-01

## Goal

Create a shared caching/snapshot mechanism for derived financial and operational state so high-traffic screens can show current balances and card summaries without recalculating from the full transaction history on every page load.

This applies to:

- GL accounts / Chart of Accounts balances.
- Customer and vendor party cards: AR/AP exposure, open balance, last activity.
- Item cards: stock by warehouse, stock by unit, available/reserved quantities, last movement.
- Any future entity whose visible “current state” is derived from immutable business movements.

## Accounting and ERP rule

The cache is **not the source of truth**.

Source-of-truth records remain:

- Posted ledger entries for accounting balances.
- Party subledger documents/payments/settlements for receivables/payables detail.
- Stock movements and cost layers for inventory quantities/value.

The derived cache exists for fast reads only. It must be rebuildable from source transactions.

## Why this is needed

Opening a screen with 1,000 accounts, parties, or items must not trigger 1,000 independent aggregate calculations.

Examples:

- Chart of Accounts should display balances quickly.
- A customer card should show “what they owe” without opening a full statement.
- An item card should show quantity by warehouse/UOM without scanning all movements.

## Proposed architecture

### 1. Shared derived-state engine

Add a System Core service, tentatively:

- `IDerivedStateCache`
- `DerivedStateCacheService`

Responsibilities:

- Update affected summaries during posting/movement workflows.
- Mark affected summaries dirty for backdated or reversal transactions.
- Rebuild a summary for one entity on demand.
- Rebuild a company/module/date range as an admin maintenance operation.
- Expose freshness metadata to the UI.

### 2. Summary stores

Candidate stores:

- `account_balance_summaries`
- `party_balance_summaries`
- `item_stock_summaries`

Each summary should include:

- `companyId`
- entity id (`accountId`, `partyId`, `itemId`)
- dimensions as needed:
  - currency
  - warehouse
  - UOM
  - fiscal period / as-of date
- totals:
  - debit/credit/balance for accounts and parties
  - onHand/reserved/available/value for items
- freshness:
  - `calculatedAt`
  - `lastSourceEntryId` or source version marker
  - `dirty`
  - `dirtyFromDate`

### 3. Update policy

For normal current-date posting:

- Update only affected summaries inside the same transaction/unit of work where practical.

For backdated posting, reversal, deletion of draft-derived movements, or correction:

- Do not silently trust existing summaries.
- Mark affected entity/date range dirty.
- Recalculate the affected entity or range before official display/report use.

### 4. Read policy

Operational overview screens may read summaries.

Official financial reports must either:

- calculate from source ledger/movement data, or
- use summaries only when freshness is verified and a rebuild path exists.

### 5. UI behavior

Cards and trees can show:

- cached balance/quantity,
- `last calculated` timestamp,
- dirty/stale warning if applicable,
- “Refresh balance/state” action for the selected account/party/item.

Refresh levels:

- single account/party/item,
- selected branch/header rollup,
- whole company/module maintenance rebuild.

## First implementation slice

Recommended first slice: GL account balances for Chart of Accounts.

1. Add backend summary model/repository.
2. Add recalculation use case for one account and for all accounts as of a date.
3. Add endpoint:
   - `GET /tenant/accounting/accounts/balances?asOf=YYYY-MM-DD`
   - `POST /tenant/accounting/accounts/:id/balance-summary/rebuild`
4. Show balances in the account tree from the summary endpoint.
5. Header accounts roll up child balances.
6. Add dirty/freshness metadata in the side panel.

## Acceptance criteria

- No account, party, or item master record stores an editable/current balance as source truth.
- All cached values can be rebuilt from source transactions.
- Updates are tenant-scoped and transactionally safe.
- Backdated postings and reversals do not leave silently wrong summaries.
- UI clearly distinguishes cached operational state from official reports.

## Risks

- Incorrect cache invalidation can show wrong operational balances.
- Updating summaries in too many modules can duplicate logic unless owned by System Core.
- Multi-currency and UOM conversions must be dimensioned explicitly; no silent conversion.
- Header/parent rollups must be derived from children, not independently edited.

## Non-goals

- Do not add editable balance fields to accounts, parties, or items.
- Do not replace official accounting reports with unchecked cache reads.
- Do not implement this as page-local frontend aggregation.
