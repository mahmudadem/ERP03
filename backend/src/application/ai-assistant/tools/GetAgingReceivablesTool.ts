/**
 * GetAgingReceivablesTool - AI Tool for read-only Accounts Receivable Aging summaries
 *
 * Returns a sanitized summary of the AR Aging report for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { AgingReportUseCase } from '../../accounting/use-cases/AgingReportUseCase';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 * Reduced view — not the full aging line detail.
 */
interface AgingReceivablesSummaryDTO {
  asOfDate: string;
  type: 'AR';
  buckets: string[];
  totalAccounts: number;
  displayedCount: number;
  truncated: boolean;
  truncationNote?: string;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    bucketAmounts: number[];
    total: number;
  }>;
  totals: number[];
  grandTotal: number;
}

export class GetAgingReceivablesTool implements AiTool {
  readonly name = 'accounting.getAgingReceivables';
  readonly description = 'Get an Accounts Receivable aging summary for the company. Shows receivables broken down by aging buckets (Current, 1-30, 31-60, etc.). Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.generalLedger.view';
  readonly module = 'accounting';

  private agingUseCase: AgingReportUseCase;

  constructor(
    ledgerRepo: ILedgerRepository,
    accountRepo: IAccountRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.agingUseCase = new AgingReportUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
    );
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      const asOfDate = (params?.asOfDate as string) || new Date().toISOString().split('T')[0];

      const result = await this.agingUseCase.execute(
        context.companyId,
        context.userId,
        'AR',
        asOfDate,
      );

      // Sanitize: top 20 accounts by total, strip entries
      const allAccounts = result.accounts
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
      const totalCount = allAccounts.length;
      const topAccounts = allAccounts.slice(0, 20);
      const truncated = totalCount > 20;

      const summary: AgingReceivablesSummaryDTO = {
        asOfDate: result.asOfDate,
        type: 'AR',
        buckets: result.buckets,
        totalAccounts: totalCount,
        displayedCount: topAccounts.length,
        truncated,
        truncationNote: truncated
          ? `Showing top 20 of ${totalCount} accounts by balance. Navigate to the AR Aging report for the complete list.`
          : undefined,
        accounts: topAccounts.map(a => ({
          accountCode: a.accountCode,
          accountName: a.accountName,
          bucketAmounts: a.bucketAmounts.map(round2),
          total: round2(a.total),
        })),
        totals: result.totals.map(round2),
        grandTotal: round2(result.grandTotal),
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve AR aging summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}