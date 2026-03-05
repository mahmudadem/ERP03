# FUTURE: Trading Account Report

## Scope
Trading Account is a gross-profit view:

- Net Sales
- Cost of Goods Sold (COGS)
- Gross Profit = Net Sales - COGS

This is intentionally **not implemented** in Phase 4.

## Why This Is Deferred
Current COA/reporting model supports broad `classification` groups (`REVENUE`, `EXPENSE`) but does not yet provide a stable, enforceable split between:

- Sales revenue accounts
- COGS / Cost of Sales accounts

Without that split, Trading Account totals are ambiguous.

## Required COA Additions
One of the following must be adopted as a single source of truth:

- Revenue/expense sub-classification enum (recommended)
- Controlled account tags (`SALES`, `COGS`)
- Template-based COA mapping rules by account range

Whichever approach is chosen, it must be persisted in account data and validated on account creation/update.

## Proposed Use Case Signature
```ts
export interface TradingAccountInput {
  companyId: string;
  userId: string;
  fromDate: string;
  toDate: string;
  excludeSpecialPeriods?: boolean;
}

export interface TradingAccountOutput {
  netSales: number;
  cogs: number;
  grossProfit: number;
  salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  period: { from: string; to: string };
}

export class GetTradingAccountUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker
  ) {}
}
```

## Data Source / Reconciliation
- Use ledger trial-balance delta (same approach as P&L) for period movement.
- Reconcile gross profit against P&L gross-profit section once COGS classification is formalized.

## Controller Pattern
If reports continue using a report-container style (`AccountingReportsController` / reporting endpoints), Trading Account should be added there with the same query/permission conventions.

