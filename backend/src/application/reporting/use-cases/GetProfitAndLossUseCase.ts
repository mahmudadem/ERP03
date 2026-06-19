import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { InventoryValuationService } from '../../inventory/services/InventoryValuationService';

export interface ProfitAndLossInput {
  companyId: string;
  userId: string;
  fromDate: string;
  toDate: string;
}

export interface ProfitAndLossOutput {
  revenue: number;
  expenses: number;
  netProfit: number;
  revenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  expensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  period: { from: string; to: string };
  structured?: {
    netSales: number;
    costOfSales: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingProfit: number;
    otherRevenue: number;
    otherExpenses: number;
    salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    opexByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    otherRevenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    otherExpensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    unclassifiedRevenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    unclassifiedExpensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    periodicTrading?: {
      pricingPolicy: 'AVERAGE';
      openingInventory: number;
      netPurchases: number;
      closingInventory: number;
      purchaseByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    };
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

const classificationOf = (account: any): string => String(account?.classification || '').toUpperCase();

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

export class GetProfitAndLossUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepository: IAccountRepository,
    private permissionChecker: PermissionChecker,
    private inventorySettingsRepo?: IInventorySettingsRepository,
    private inventoryValuationService?: InventoryValuationService
  ) {}

  async execute(input: ProfitAndLossInput): Promise<ProfitAndLossOutput> {
    await this.permissionChecker.assertOrThrow(
      input.userId,
      input.companyId,
      'accounting.reports.profitAndLoss.view'
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
    const openMap = new Map(
      openingTB.map((row) => [row.accountId, { debit: row.debit || 0, credit: row.credit || 0 }])
    );
    const closeMap = new Map(
      closingTB.map((row) => [row.accountId, { debit: row.debit || 0, credit: row.credit || 0 }])
    );

    const revenueMap = new Map<string, { accountName: string; amount: number }>();
    const expenseMap = new Map<string, { accountName: string; amount: number }>();
    const salesMap = new Map<string, { accountName: string; amount: number }>();
    const cogsMap = new Map<string, { accountName: string; amount: number }>();
    const opexMap = new Map<string, { accountName: string; amount: number }>();
    const otherRevenueMap = new Map<string, { accountName: string; amount: number }>();
    const otherExpenseMap = new Map<string, { accountName: string; amount: number }>();
    const unclassifiedRevenueMap = new Map<string, { accountName: string; amount: number }>();
    const unclassifiedExpenseMap = new Map<string, { accountName: string; amount: number }>();

    let totalRevenue = 0;
    let totalExpenses = 0;
    let netSales = 0;
    let costOfSales = 0;
    let operatingExpenses = 0;
    let otherRevenue = 0;
    let otherExpenses = 0;
    let unclassifiedRevenue = 0;
    let unclassifiedExpenses = 0;
    let hasTaggedSubgroup = false;
    const cogsAccountIds = new Set<string>();

    for (const account of accounts) {
      const classification = classificationOf(account);
      if (classification !== 'REVENUE' && classification !== 'EXPENSE') continue;
      const subgroup = account?.plSubgroup ?? null;
      if (subgroup) hasTaggedSubgroup = true;

      const openBal = openMap.get(account.id) || { debit: 0, credit: 0 };
      const closeBal = closeMap.get(account.id) || { debit: 0, credit: 0 };

      const periodDebit = closeBal.debit - openBal.debit;
      const periodCredit = closeBal.credit - openBal.credit;

      if (classification === 'REVENUE') {
        const amount = periodCredit - periodDebit;
        if (Math.abs(amount) >= 0.005) {
          const line = {
            accountName: accountLabel(account, account.id),
            amount,
          };
          totalRevenue += amount;
          revenueMap.set(account.id, line);

          if (subgroup === 'SALES') {
            netSales += amount;
            salesMap.set(account.id, line);
          } else if (subgroup === 'OTHER_REVENUE') {
            otherRevenue += amount;
            otherRevenueMap.set(account.id, line);
          } else {
            unclassifiedRevenue += amount;
            unclassifiedRevenueMap.set(account.id, line);
          }
        }
      }

      if (classification === 'EXPENSE') {
        const amount = periodDebit - periodCredit;
        if (Math.abs(amount) >= 0.005) {
          const line = {
            accountName: accountLabel(account, account.id),
            amount,
          };
          totalExpenses += amount;
          expenseMap.set(account.id, line);

          if (subgroup === 'COST_OF_SALES') {
            costOfSales += amount;
            cogsMap.set(account.id, line);
            cogsAccountIds.add(account.id);
          } else if (subgroup === 'OPERATING_EXPENSES') {
            operatingExpenses += amount;
            opexMap.set(account.id, line);
          } else if (subgroup === 'OTHER_EXPENSES') {
            otherExpenses += amount;
            otherExpenseMap.set(account.id, line);
          } else {
            unclassifiedExpenses += amount;
            unclassifiedExpenseMap.set(account.id, line);
          }
        }
      }
    }

    let reportedExpenses = totalExpenses;
    let reportedNetProfit = totalRevenue - totalExpenses;
    let reportedCostOfSales = costOfSales;
    let periodicTrading:
      | {
          pricingPolicy: 'AVERAGE';
          openingInventory: number;
          netPurchases: number;
          closingInventory: number;
          purchaseByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
        }
      | undefined;

    const reportExpenseMap = new Map(expenseMap);

    if (
      inventorySettings?.accountingMode === 'PERIODIC' &&
      this.inventoryValuationService
    ) {
      // Statements are valued at AVERAGE (costing method of record) so P&L,
      // Trading, and the Balance Sheet all agree. Policy exploration
      // (LAST_PURCHASE) lives on the standalone Inventory Valuation report.
      const [openingInventory, closingInventory] = await Promise.all([
        this.inventoryValuationService.value(input.companyId, dayBefore, 'AVERAGE'),
        this.inventoryValuationService.value(input.companyId, toDate, 'AVERAGE'),
      ]);

      reportedCostOfSales = openingInventory.totalValueBase + costOfSales - closingInventory.totalValueBase;
      reportedExpenses = (totalExpenses - costOfSales) + reportedCostOfSales;
      reportedNetProfit = totalRevenue - reportedExpenses;

      cogsAccountIds.forEach((accountId) => reportExpenseMap.delete(accountId));
      reportExpenseMap.set('periodic-cost-of-sales', {
        accountName: 'Periodic Cost of Sales',
        amount: reportedCostOfSales,
      });

      periodicTrading = {
        pricingPolicy: 'AVERAGE',
        openingInventory: round2(openingInventory.totalValueBase),
        netPurchases: round2(costOfSales),
        closingInventory: round2(closingInventory.totalValueBase),
        purchaseByAccount: toSortedAmounts(cogsMap),
      };
    }

    const output: ProfitAndLossOutput = {
      revenue: round2(totalRevenue),
      expenses: round2(reportedExpenses),
      netProfit: round2(reportedNetProfit),
      revenueByAccount: toSortedAmounts(revenueMap),
      expensesByAccount: toSortedAmounts(reportExpenseMap),
      period: {
        from: fromDate,
        to: toDate,
      },
    };

    if (hasTaggedSubgroup) {
      const grossProfit = netSales - reportedCostOfSales;
      const operatingProfit = grossProfit - operatingExpenses;
      output.structured = {
        netSales: round2(netSales),
        costOfSales: round2(reportedCostOfSales),
        grossProfit: round2(grossProfit),
        operatingExpenses: round2(operatingExpenses),
        operatingProfit: round2(operatingProfit),
        otherRevenue: round2(otherRevenue),
        otherExpenses: round2(otherExpenses),
        salesByAccount: toSortedAmounts(salesMap),
        cogsByAccount: toSortedAmounts(cogsMap),
        opexByAccount: toSortedAmounts(opexMap),
        otherRevenueByAccount: toSortedAmounts(otherRevenueMap),
        otherExpensesByAccount: toSortedAmounts(otherExpenseMap),
        unclassifiedRevenueByAccount: toSortedAmounts(unclassifiedRevenueMap),
        unclassifiedExpensesByAccount: toSortedAmounts(unclassifiedExpenseMap),
        periodicTrading,
      };
    }

    return output;
  }
}
