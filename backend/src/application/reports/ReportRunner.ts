import { ReportDefinition, ReportResult, ReportOutputContext, ReportMoneyContext } from '../../domain/reports/ReportDefinition';
import { ILedgerRepository } from '../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../repository/interfaces/accounting';
import { ICompanyRepository } from '../../repository/interfaces/core/ICompanyRepository';
import { PermissionChecker } from '../rbac/PermissionChecker';
import { GetProfitAndLossUseCase } from '../reporting/use-cases/GetProfitAndLossUseCase';
import { GetTrialBalanceUseCase, GetGeneralLedgerUseCase, GetAccountStatementUseCase, GetBalanceSheetUseCase } from '../accounting/use-cases/LedgerUseCases';
import { GetCashFlowStatementUseCase } from '../accounting/use-cases/CashFlowUseCases';
import { AgingReportUseCase } from '../accounting/use-cases/AgingReportUseCase';
import { normalizeUserCode } from '../../domain/accounting/entities/Account';

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function currentMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export class ReportRunner {
  private plUseCase: GetProfitAndLossUseCase;
  private tbUseCase: GetTrialBalanceUseCase;
  private bsUseCase: GetBalanceSheetUseCase;
  private cfUseCase: GetCashFlowStatementUseCase;
  private glUseCase: GetGeneralLedgerUseCase;
  private asUseCase: GetAccountStatementUseCase;
  private agingUseCase: AgingReportUseCase;

  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private companyRepo: ICompanyRepository,
    private permissionChecker: PermissionChecker,
  ) {
    this.plUseCase = new GetProfitAndLossUseCase(ledgerRepo, accountRepo, permissionChecker);
    this.tbUseCase = new GetTrialBalanceUseCase(ledgerRepo, accountRepo, permissionChecker);
    this.bsUseCase = new GetBalanceSheetUseCase(ledgerRepo, accountRepo, permissionChecker, companyRepo);
    this.cfUseCase = new GetCashFlowStatementUseCase(ledgerRepo, accountRepo, companyRepo, permissionChecker);
    this.glUseCase = new GetGeneralLedgerUseCase(ledgerRepo, permissionChecker);
    this.asUseCase = new GetAccountStatementUseCase(ledgerRepo, permissionChecker, accountRepo, companyRepo);
    this.agingUseCase = new AgingReportUseCase(ledgerRepo, accountRepo, permissionChecker);
  }

  async run(
    definition: ReportDefinition,
    companyId: string,
    userId: string,
    params: Record<string, unknown>,
  ): Promise<ReportResult> {
    const baseCurrency = await this.resolveBaseCurrency(companyId);
    const defaultsApplied: string[] = [];
    const warnings: string[] = [];

    const handler = this.getHandler(definition.id);
    if (!handler) throw new Error(`Unknown report: ${definition.id}`);

    const { data, filters, period, asOfDate } = await handler.call(
      this, companyId, userId, params, definition, defaultsApplied,
    );

    const reportContext: ReportOutputContext = {
      reportId: definition.id,
      reportTitle: definition.title,
      generatedAt: new Date().toISOString(),
      period,
      asOfDate,
      dateBasis: definition.dateBasis,
      filters,
      defaultsApplied,
      warnings,
      truncated: false,
    };

    const moneyContext: ReportMoneyContext = {
      baseCurrency,
      reportCurrency: baseCurrency,
      converted: false,
      conversionPolicy: 'notConverted',
    };

    return { reportContext, moneyContext, data };
  }

  private getHandler(reportId: string) {
    const handlers: Record<string, Function> = {
      'accounting.profitAndLoss': this.runProfitAndLoss,
      'accounting.trialBalance': this.runTrialBalance,
      'accounting.balanceSheet': this.runBalanceSheet,
      'accounting.cashFlow': this.runCashFlow,
      'accounting.generalLedger': this.runGeneralLedger,
      'accounting.accountStatement': this.runAccountStatement,
      'accounting.agingReceivables': this.runAgingReceivables,
      'accounting.agingPayables': this.runAgingPayables,
    };
    return handlers[reportId];
  }

  private async runProfitAndLoss(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    const fromDate = (params.fromDate as string) || (defaultsApplied.push('fromDate: current month start'), currentMonthStart());
    const toDate = (params.toDate as string) || (defaultsApplied.push('toDate: today'), today());

    const result = await this.plUseCase.execute({ companyId, userId, fromDate, toDate });

    const truncateSection = (items: Array<{ accountId: string; accountName: string; amount: number }>) => {
      const sorted = items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      return sorted.slice(0, def.maxRows).map(i => ({
        accountName: i.accountName,
        amount: round2(i.amount),
      }));
    };

    const truncated = result.revenueByAccount.length > def.maxRows || result.expensesByAccount.length > def.maxRows;

    return {
      data: {
        revenue: round2(result.revenue),
        expenses: round2(result.expenses),
        netProfit: round2(result.netProfit),
        revenueAccounts: {
          total: result.revenueByAccount.length,
          displayed: Math.min(result.revenueByAccount.length, def.maxRows),
          items: truncateSection(result.revenueByAccount),
        },
        expenseAccounts: {
          total: result.expensesByAccount.length,
          displayed: Math.min(result.expensesByAccount.length, def.maxRows),
          items: truncateSection(result.expensesByAccount),
        },
        structured: result.structured ? {
          netSales: round2(result.structured.netSales),
          costOfSales: round2(result.structured.costOfSales),
          grossProfit: round2(result.structured.grossProfit),
          operatingExpenses: round2(result.structured.operatingExpenses),
          operatingProfit: round2(result.structured.operatingProfit),
          otherRevenue: round2(result.structured.otherRevenue),
          otherExpenses: round2(result.structured.otherExpenses),
        } : undefined,
        truncated,
        truncationNote: truncated
          ? `Showing top ${def.maxRows} accounts per section. Open the report in ERP for the full list.`
          : undefined,
      } as Record<string, unknown>,
      filters: { fromDate, toDate },
      period: { fromDate, toDate },
      asOfDate: undefined,
    };
  }

  private async runTrialBalance(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    const asOfDate = (params.asOfDate as string) || (defaultsApplied.push('asOfDate: today'), today());
    const includeZeroBalance = (params.includeZeroBalance as boolean) ?? false;

    const result = await this.tbUseCase.execute(companyId, userId, asOfDate, includeZeroBalance);

    const sorted = result.data.sort((a, b) => Math.abs(b.closingDebit + b.closingCredit) - Math.abs(a.closingDebit + a.closingCredit));
    const displayed = sorted.slice(0, def.maxRows);
    const truncated = result.data.length > def.maxRows;

    return {
      data: {
        totalClosingDebit: round2(result.meta.totalClosingDebit),
        totalClosingCredit: round2(result.meta.totalClosingCredit),
        isBalanced: result.meta.isBalanced,
        difference: round2(result.meta.difference),
        accounts: {
          total: result.data.length,
          displayed: displayed.length,
          items: displayed.map(a => ({
            accountCode: a.code,
            accountName: a.name,
            closingDebit: round2(a.closingDebit),
            closingCredit: round2(a.closingCredit),
          })),
        },
        truncated,
        truncationNote: truncated
          ? `Showing top ${def.maxRows} of ${result.data.length} accounts. Open the report in ERP for the full list.`
          : undefined,
      } as Record<string, unknown>,
      filters: { asOfDate, includeZeroBalance },
      period: undefined,
      asOfDate,
    };
  }

  private async runBalanceSheet(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    const asOfDate = (params.asOfDate as string) || (defaultsApplied.push('asOfDate: today'), today());

    const result = await this.bsUseCase.execute(companyId, userId, asOfDate);

    const truncateAccounts = (accounts: any[]) => {
      const leafAccounts = accounts.filter((a: any) => !a.isParent);
      const sorted = leafAccounts.sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance));
      return {
        total: leafAccounts.length,
        displayed: Math.min(leafAccounts.length, def.maxRows),
        items: sorted.slice(0, def.maxRows).map((a: any) => ({
          code: a.code || a.accountCode || '',
          name: a.name || a.accountName || '',
          balance: round2(a.balance),
        })),
      };
    };

    return {
      data: {
        totalAssets: round2(result.totalAssets),
        totalLiabilities: round2(result.liabilities.total),
        totalEquity: round2(result.equity.total),
        totalLiabilitiesAndEquity: round2(result.totalLiabilitiesAndEquity),
        retainedEarnings: round2(result.retainedEarnings),
        isBalanced: result.isBalanced,
        assets: truncateAccounts(result.assets.accounts),
        liabilities: truncateAccounts(result.liabilities.accounts),
        equity: truncateAccounts(result.equity.accounts),
      } as Record<string, unknown>,
      filters: { asOfDate },
      period: undefined,
      asOfDate,
    };
  }

  private async runCashFlow(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    const fromDate = (params.fromDate as string) || (defaultsApplied.push('fromDate: current month start'), currentMonthStart());
    const toDate = (params.toDate as string) || (defaultsApplied.push('toDate: today'), today());

    const result = await this.cfUseCase.execute(companyId, userId, fromDate, toDate);

    return {
      data: {
        baseCurrency: result.baseCurrency,
        netIncome: round2(result.netIncome),
        operating: result.operating,
        investing: result.investing,
        financing: result.financing,
        netCashChange: round2(result.netCashChange),
        openingCashBalance: round2(result.openingCashBalance),
        closingCashBalance: round2(result.closingCashBalance),
      } as Record<string, unknown>,
      filters: { fromDate, toDate },
      period: { fromDate, toDate },
      asOfDate: undefined,
    };
  }

  private async runGeneralLedger(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    const fromDate = (params.fromDate as string) || (defaultsApplied.push('fromDate: current month start'), currentMonthStart());
    const toDate = (params.toDate as string) || (defaultsApplied.push('toDate: today'), today());

    const rawEntries = await this.glUseCase.execute(companyId, userId, { fromDate, toDate }) as any[];

    const accountMap = new Map<string, { accountCode: string; accountName: string; debit: number; credit: number }>();
    for (const entry of rawEntries) {
      const accId = entry.accountId || '';
      const existing = accountMap.get(accId) || { accountCode: entry.accountCode || '', accountName: entry.accountName || '', debit: 0, credit: 0 };
      existing.debit += Number(entry.debit ?? entry.baseDebit ?? 0) || 0;
      existing.credit += Number(entry.credit ?? entry.baseCredit ?? 0) || 0;
      accountMap.set(accId, existing);
    }

    const allAccounts = Array.from(accountMap.entries())
      .map(([accountId, d]) => ({
        accountId,
        accountCode: d.accountCode,
        accountName: d.accountName,
        totalDebit: round2(d.debit),
        totalCredit: round2(d.credit),
        netBalance: round2(d.debit - d.credit),
      }))
      .sort((a, b) => Math.abs(b.totalDebit + b.totalCredit) - Math.abs(a.totalDebit + a.totalCredit));

    const displayed = allAccounts.slice(0, def.maxRows);
    const truncated = allAccounts.length > def.maxRows;
    const totalDebit = Array.from(accountMap.values()).reduce((s, a) => s + a.debit, 0);
    const totalCredit = Array.from(accountMap.values()).reduce((s, a) => s + a.credit, 0);

    return {
      data: {
        totalDebit: round2(totalDebit),
        totalCredit: round2(totalCredit),
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        accounts: {
          total: allAccounts.length,
          displayed: displayed.length,
          items: displayed,
        },
        truncated,
        truncationNote: truncated
          ? `Showing top ${def.maxRows} of ${allAccounts.length} accounts. Open the report in ERP for the full list.`
          : undefined,
      } as Record<string, unknown>,
      filters: { fromDate, toDate },
      period: { fromDate, toDate },
      asOfDate: undefined,
    };
  }

  private async runAccountStatement(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    const accountCode = params.accountCode as string;
    if (!accountCode) throw new Error('accountCode is required. Ask the user which account to show.');

    const fromDate = (params.fromDate as string) || (defaultsApplied.push('fromDate: current month start'), currentMonthStart());
    const toDate = (params.toDate as string) || (defaultsApplied.push('toDate: today'), today());

    const accounts = await this.accountRepo.list(companyId);
    const normalizedCode = normalizeUserCode(accountCode);
    const account = accounts.find((a: any) =>
      normalizeUserCode(a.userCode || (a as any).code || '') === normalizedCode ||
      normalizeUserCode((a as any).systemCode || '') === normalizedCode
    );
    if (!account) throw new Error(`Account "${accountCode}" not found.`);

    const result = await this.asUseCase.execute(
      companyId, userId, (account as any).id,
      fromDate, toDate,
      params.costCenterId ? { costCenterId: params.costCenterId as string } : undefined,
    );

    const entries = Array.isArray(result?.entries) ? result.entries : [];
    const displayed = entries.slice(0, def.maxRows);
    const truncated = entries.length > def.maxRows;

    return {
      data: {
        accountCode: (account as any).userCode || (account as any).code || accountCode,
        accountName: (account as any).name || '',
        openingBalance: round2(result?.openingBalance ?? result?.openingBalanceBase ?? 0),
        totalDebit: round2(result?.totalDebit ?? 0),
        totalCredit: round2(result?.totalCredit ?? 0),
        closingBalance: round2(result?.closingBalance ?? 0),
        entries: {
          total: entries.length,
          displayed: displayed.length,
          items: displayed.map((e: any) => ({
            date: e.date || e.postingDate || '',
            description: e.description || e.memo || '',
            debit: round2(e.debit ?? e.baseDebit ?? 0),
            credit: round2(e.credit ?? e.baseCredit ?? 0),
            runningBalance: round2(e.runningBalance ?? 0),
          })),
        },
        truncated,
        truncationNote: truncated
          ? `Showing ${def.maxRows} of ${entries.length} entries. Open the report in ERP for the full list.`
          : undefined,
      } as Record<string, unknown>,
      filters: { accountCode, fromDate, toDate, costCenterId: params.costCenterId },
      period: { fromDate, toDate },
      asOfDate: undefined,
    };
  }

  private async runAgingReceivables(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    return this.runAging(companyId, userId, params, def, defaultsApplied, 'AR');
  }

  private async runAgingPayables(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[],
  ) {
    return this.runAging(companyId, userId, params, def, defaultsApplied, 'AP');
  }

  private async runAging(
    companyId: string, userId: string, params: Record<string, unknown>,
    def: ReportDefinition, defaultsApplied: string[], type: 'AR' | 'AP',
  ) {
    const asOfDate = (params.asOfDate as string) || (defaultsApplied.push('asOfDate: today'), today());
    const accountId = params.accountId as string | undefined;

    const result = await this.agingUseCase.execute(companyId, userId, type, asOfDate, accountId);

    const sorted = (result.accounts || []).sort((a: any, b: any) =>
      Math.abs(b.total ?? 0) - Math.abs(a.total ?? 0)
    );
    const displayed = sorted.slice(0, def.maxRows);
    const truncated = sorted.length > def.maxRows;

    return {
      data: {
        type: type === 'AR' ? 'Receivables' : 'Payables',
        buckets: result.buckets,
        grandTotal: round2(result.grandTotal ?? 0),
        accounts: {
          total: sorted.length,
          displayed: displayed.length,
          items: displayed.map((a: any) => ({
            accountCode: a.accountCode || '',
            accountName: a.accountName || '',
            total: round2(a.total ?? 0),
            buckets: a.buckets || a.amounts || [],
          })),
        },
        truncated,
        truncationNote: truncated
          ? `Showing top ${def.maxRows} of ${sorted.length} accounts. Open the report in ERP for the full list.`
          : undefined,
      } as Record<string, unknown>,
      filters: { asOfDate, accountId },
      period: undefined,
      asOfDate,
    };
  }

  private async resolveBaseCurrency(companyId: string): Promise<string> {
    const company = await this.companyRepo.findById(companyId);
    return (company as any)?.baseCurrency || 'USD';
  }
}
