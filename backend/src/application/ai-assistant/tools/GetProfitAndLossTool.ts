/**
 * GetProfitAndLossTool - AI Tool for read-only P&L (Income Statement) summaries
 *
 * Returns a sanitized summary of the Profit & Loss report for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.profitAndLoss.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetProfitAndLossUseCase } from '../../reporting/use-cases/GetProfitAndLossUseCase';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { PermissionChecker } from '../../rbac/PermissionChecker';

/**
 * Sanitized summary DTO returned to the AI.
 * Reduced view — not the full P&L line detail.
 */
interface ProfitAndLossSummaryDTO {
  period: { from: string; to: string };
  revenue: number;
  expenses: number;
  netProfit: number;
  revenueBreakdown: Array<{ accountName: string; amount: number }>;
  expensesBreakdown: Array<{ accountName: string; amount: number }>;
  structured?: {
    netSales: number;
    costOfSales: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingProfit: number;
    otherRevenue: number;
    otherExpenses: number;
  };
}

export class GetProfitAndLossTool implements AiTool {
  readonly name = 'accounting.getProfitAndLoss';
  readonly description = 'Get a Profit & Loss (Income Statement) summary for the company. Returns revenue, expenses, net profit, and breakdowns by account. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.profitAndLoss.view';
  readonly module = 'accounting';

  private plUseCase: GetProfitAndLossUseCase;

  constructor(
    ledgerRepo: ILedgerRepository,
    accountRepo: IAccountRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.plUseCase = new GetProfitAndLossUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
    );
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      // Default to current month if no dates provided
      const now = new Date();
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const result = await this.plUseCase.execute({
        companyId: context.companyId,
        userId: context.userId,
        fromDate,
        toDate,
      });

      // Sanitize: top 10 revenue accounts + top 10 expense accounts by absolute amount
      const topRevenue = result.revenueByAccount
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 10);

      const topExpenses = result.expensesByAccount
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 10);

      const summary: ProfitAndLossSummaryDTO = {
        period: result.period,
        revenue: result.revenue,
        expenses: result.expenses,
        netProfit: result.netProfit,
        revenueBreakdown: topRevenue.map(a => ({ accountName: a.accountName, amount: a.amount })),
        expensesBreakdown: topExpenses.map(a => ({ accountName: a.accountName, amount: a.amount })),
      };

      // Include structured view if available
      if (result.structured) {
        summary.structured = {
          netSales: result.structured.netSales,
          costOfSales: result.structured.costOfSales,
          grossProfit: result.structured.grossProfit,
          operatingExpenses: result.structured.operatingExpenses,
          operatingProfit: result.structured.operatingProfit,
          otherRevenue: result.structured.otherRevenue,
          otherExpenses: result.structured.otherExpenses,
        };
      }

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve P&L summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}