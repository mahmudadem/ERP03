/**
 * GetMonthlyComparisonTool - AI Tool for read-only Monthly P&L Comparison
 *
 * Returns P&L metrics broken down by month for the given period,
 * enabling trend analysis and period-over-period comparison.
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

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 */
interface MonthlyComparisonDTO {
  months: Array<{
    month: string;
    revenue: number;
    expenses: number;
    netProfit: number;
  }>;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  totalCount: number;
  displayedCount: number;
  truncated: boolean;
  truncationNote?: string;
}

export class GetMonthlyComparisonTool implements AiTool {
  readonly name = 'reports.getMonthlyPerformanceSummary';
  readonly description = 'Get a monthly P&L performance comparison for the company. Returns revenue, expenses, and net profit broken down by month. Optionally accepts fromDate and toDate. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.profitAndLoss.view';
  readonly module = 'reports';

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
      const now = new Date();
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];

      // Generate list of months between fromDate and toDate
      const months: Array<{ year: number; month: number; label: string; start: string; end: string }> = [];
      const start = new Date(fromDate + 'T00:00:00');
      const end = new Date(toDate + 'T00:00:00');
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

      while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth(); // 0-indexed
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0); // last day of month
        const label = `${year}-${String(month + 1).padStart(2, '0')}`;
        months.push({
          year,
          month,
          label,
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0],
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }

      // Run P&L for each month
      const results = await Promise.all(
        months.map(async (m) => {
          try {
            const result = await this.plUseCase.execute({
              companyId: context.companyId,
              userId: context.userId,
              fromDate: m.start,
              toDate: m.end,
            });
            return {
              month: m.label,
              revenue: round2(result.revenue),
              expenses: round2(result.expenses),
              netProfit: round2(result.netProfit),
            };
          } catch {
            return {
              month: m.label,
              revenue: 0,
              expenses: 0,
              netProfit: 0,
            };
          }
        })
      );

      const totalRevenue = round2(results.reduce((sum, r) => sum + r.revenue, 0));
      const totalExpenses = round2(results.reduce((sum, r) => sum + r.expenses, 0));
      const totalProfit = round2(results.reduce((sum, r) => sum + r.netProfit, 0));

      // Truncate months to prevent oversized AI context
      const MONTHLY_COMPARISON_LIMIT = 24;
      const totalCount = results.length;
      const displayedMonths = results.slice(0, MONTHLY_COMPARISON_LIMIT);
      const truncated = totalCount > MONTHLY_COMPARISON_LIMIT;

      const summary: MonthlyComparisonDTO = {
        months: displayedMonths,
        totalRevenue,
        totalExpenses,
        totalProfit,
        totalCount,
        displayedCount: displayedMonths.length,
        truncated,
        truncationNote: truncated
          ? `Showing ${displayedMonths.length} of ${totalCount} months. Narrow the date range or navigate to the P&L report for the complete comparison.`
          : undefined,
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve monthly comparison: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}