/**
 * GetCashFlowTool - AI Tool for read-only Cash Flow Statement summaries
 *
 * Returns a sanitized summary of the Cash Flow Statement for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.cashFlow.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetCashFlowStatementUseCase } from '../../accounting/use-cases/CashFlowUseCases';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 * Reduced view — not the full cash flow line detail.
 */
interface CashFlowSummaryDTO {
  period: { from: string; to: string };
  baseCurrency: string;
  netIncome: number;
  operating: {
    total: number;
    totalItems: number;
    displayedCount: number;
    items: Array<{ name: string; amount: number }>;
  };
  investing: {
    total: number;
    totalItems: number;
    displayedCount: number;
    items: Array<{ name: string; amount: number }>;
  };
  financing: {
    total: number;
    totalItems: number;
    displayedCount: number;
    items: Array<{ name: string; amount: number }>;
  };
  truncated: boolean;
  truncationNote?: string;
  netCashChange: number;
  openingCashBalance: number;
  closingCashBalance: number;
}

export class GetCashFlowTool implements AiTool {
  readonly name = 'accounting.getCashFlowSummary';
  readonly description = 'Get a Cash Flow Statement summary for the company. Returns operating, investing, and financing cash flows. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.cashFlow.view';
  readonly module = 'accounting';

  private cashFlowUseCase: GetCashFlowStatementUseCase;

  constructor(
    ledgerRepo: ILedgerRepository,
    accountRepo: IAccountRepository,
    companyRepo: ICompanyRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.cashFlowUseCase = new GetCashFlowStatementUseCase(
      ledgerRepo,
      accountRepo,
      companyRepo,
      permissionChecker,
    );
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      const now = new Date();
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const result = await this.cashFlowUseCase.execute(
        context.companyId,
        context.userId,
        fromDate,
        toDate,
        false, // excludeSpecialPeriods
      );

      // Sanitize: limit items to top 10 per section by absolute amount
      const sortedOperating = result.operating.items
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      const sortedInvesting = result.investing.items
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      const sortedFinancing = result.financing.items
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      const totalOperatingItems = sortedOperating.length;
      const totalInvestingItems = sortedInvesting.length;
      const totalFinancingItems = sortedFinancing.length;
      const operatingItems = sortedOperating.slice(0, 10).map(i => ({ name: i.name, amount: round2(i.amount) }));
      const investingItems = sortedInvesting.slice(0, 10).map(i => ({ name: i.name, amount: round2(i.amount) }));
      const financingItems = sortedFinancing.slice(0, 10).map(i => ({ name: i.name, amount: round2(i.amount) }));
      const truncated = totalOperatingItems > 10 || totalInvestingItems > 10 || totalFinancingItems > 10;

      const summary: CashFlowSummaryDTO = {
        period: result.period,
        baseCurrency: result.baseCurrency,
        netIncome: round2(result.netIncome),
        operating: {
          total: round2(result.operating.total),
          totalItems: totalOperatingItems,
          displayedCount: operatingItems.length,
          items: operatingItems,
        },
        investing: {
          total: round2(result.investing.total),
          totalItems: totalInvestingItems,
          displayedCount: investingItems.length,
          items: investingItems,
        },
        financing: {
          total: round2(result.financing.total),
          totalItems: totalFinancingItems,
          displayedCount: financingItems.length,
          items: financingItems,
        },
        truncated,
        truncationNote: truncated
          ? `Showing top 10 items per section. Navigate to the Cash Flow Statement for the complete list.`
          : undefined,
        netCashChange: round2(result.netCashChange),
        openingCashBalance: round2(result.openingCashBalance),
        closingCashBalance: round2(result.closingCashBalance),
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve cash flow summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}