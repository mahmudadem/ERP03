import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { InventoryValuationService } from '../../inventory/services/InventoryValuationService';

export interface TradingAccountInput {
  companyId: string;
  userId: string;
  fromDate: string;
  toDate: string;
}

export interface TradingAccountOutput {
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  grossProfitMargin: number;
  salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  period: { from: string; to: string };
  hasData: boolean;
  periodicComputation?: {
    pricingPolicy: 'AVERAGE';
    openingInventory: number;
    netPurchases: number;
    closingInventory: number;
    purchaseBreakdown: Array<{ accountId: string; accountName: string; amount: number }>;
  };
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeDateInput = (value: string): string => {
  if (DATE_ONLY_RE.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed.toISOString().slice(0, 10);
};

const accountLabel = (account: any, fallbackId: string): string => {
  const code = String(account?.userCode || account?.systemCode || '').trim();
  const name = String(account?.name || '').trim();
  if (code && name) return `${code} - ${name}`;
  if (name) return name;
  return fallbackId;
};

const toSortedAmounts = (map: Map<string, { accountName: string; amount: number }>) =>
  Array.from(map.entries())
    .map(([accountId, data]) => ({
      accountId,
      accountName: data.accountName,
      amount: round2(data.amount),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

export class GetTradingAccountUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepository: IAccountRepository,
    private permissionChecker: PermissionChecker,
    private inventorySettingsRepo?: IInventorySettingsRepository,
    private inventoryValuationService?: InventoryValuationService
  ) {}

  async execute(input: TradingAccountInput): Promise<TradingAccountOutput> {
    await this.permissionChecker.assertOrThrow(
      input.userId,
      input.companyId,
      'accounting.reports.tradingAccount.view'
    );

    const fromDate = normalizeDateInput(input.fromDate);
    const toDate = normalizeDateInput(input.toDate);

    const dayBefore = (() => {
      const d = new Date(fromDate);
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    const [openingTB, closingTB, accounts] = await Promise.all([
      this.ledgerRepo.getTrialBalance(input.companyId, dayBefore),
      this.ledgerRepo.getTrialBalance(input.companyId, toDate),
      this.accountRepository.list(input.companyId),
    ]);
    const inventorySettings = await this.inventorySettingsRepo?.getSettings(input.companyId).catch(() => null);

    const taggedSalesAccounts = accounts.filter(
      (account: any) => String(account?.classification || '').toUpperCase() === 'REVENUE' && account?.plSubgroup === 'SALES'
    );
    const taggedCogsAccounts = accounts.filter(
      (account: any) => String(account?.classification || '').toUpperCase() === 'EXPENSE' && account?.plSubgroup === 'COST_OF_SALES'
    );
    const hasData = taggedSalesAccounts.length > 0 || taggedCogsAccounts.length > 0;

    if (!hasData) {
      return {
        netSales: 0,
        costOfSales: 0,
        grossProfit: 0,
        grossProfitMargin: 0,
        salesByAccount: [],
        cogsByAccount: [],
        period: { from: fromDate, to: toDate },
        hasData: false,
      };
    }

    const openMap = new Map(
      openingTB.map((row) => [row.accountId, { debit: row.debit || 0, credit: row.credit || 0 }])
    );
    const closeMap = new Map(
      closingTB.map((row) => [row.accountId, { debit: row.debit || 0, credit: row.credit || 0 }])
    );

    const salesMap = new Map<string, { accountName: string; amount: number }>();
    const costBucketMap = new Map<string, { accountName: string; amount: number }>();
    let netSales = 0;
    let netPurchases = 0;

    for (const account of taggedSalesAccounts) {
      const openBal = openMap.get(account.id) || { debit: 0, credit: 0 };
      const closeBal = closeMap.get(account.id) || { debit: 0, credit: 0 };
      const periodDebit = closeBal.debit - openBal.debit;
      const periodCredit = closeBal.credit - openBal.credit;
      const amount = periodCredit - periodDebit;

      if (Math.abs(amount) >= 0.005) {
        netSales += amount;
        salesMap.set(account.id, {
          accountName: accountLabel(account, account.id),
          amount,
        });
      }
    }

    for (const account of taggedCogsAccounts) {
      const openBal = openMap.get(account.id) || { debit: 0, credit: 0 };
      const closeBal = closeMap.get(account.id) || { debit: 0, credit: 0 };
      const periodDebit = closeBal.debit - openBal.debit;
      const periodCredit = closeBal.credit - openBal.credit;
      const amount = periodDebit - periodCredit;

      if (Math.abs(amount) >= 0.005) {
        netPurchases += amount;
        costBucketMap.set(account.id, {
          accountName: accountLabel(account, account.id),
          amount,
        });
      }
    }

    if (
      inventorySettings?.accountingMode === 'PERIODIC' &&
      this.inventoryValuationService
    ) {
      // Financial statements (Trading / P&L / Balance Sheet) are always valued at
      // AVERAGE — the costing method of record — so they agree with each other.
      // The standalone Inventory Valuation report is where a user can explore
      // alternative policies (e.g. LAST_PURCHASE) for analysis only.
      const [openingInventory, closingInventory] = await Promise.all([
        this.inventoryValuationService.value(input.companyId, dayBefore, 'AVERAGE'),
        this.inventoryValuationService.value(input.companyId, toDate, 'AVERAGE'),
      ]);
      const costOfSales = openingInventory.totalValueBase + netPurchases - closingInventory.totalValueBase;
      const grossProfit = netSales - costOfSales;
      const grossProfitMargin = netSales === 0 ? 0 : (grossProfit / netSales) * 100;

      return {
        netSales: round2(netSales),
        costOfSales: round2(costOfSales),
        grossProfit: round2(grossProfit),
        grossProfitMargin: round2(grossProfitMargin),
        salesByAccount: toSortedAmounts(salesMap),
        cogsByAccount: toSortedAmounts(costBucketMap),
        period: { from: fromDate, to: toDate },
        hasData: true,
        periodicComputation: {
          pricingPolicy: 'AVERAGE',
          openingInventory: round2(openingInventory.totalValueBase),
          netPurchases: round2(netPurchases),
          closingInventory: round2(closingInventory.totalValueBase),
          purchaseBreakdown: toSortedAmounts(costBucketMap),
        },
      };
    }

    const costOfSales = netPurchases;
    const grossProfit = netSales - costOfSales;
    const grossProfitMargin = netSales === 0 ? 0 : (grossProfit / netSales) * 100;

    return {
      netSales: round2(netSales),
      costOfSales: round2(costOfSales),
      grossProfit: round2(grossProfit),
      grossProfitMargin: round2(grossProfitMargin),
      salesByAccount: toSortedAmounts(salesMap),
      cogsByAccount: toSortedAmounts(costBucketMap),
      period: { from: fromDate, to: toDate },
      hasData: true,
    };
  }
}
