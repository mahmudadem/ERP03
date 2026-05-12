/**
 * GetChartOfAccountsSummaryTool - AI Tool for read-only Chart of Accounts summaries
 *
 * Returns a sanitized summary of the Chart of Accounts for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.accounts.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type AccountClassification = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

/**
 * Sanitized summary DTO returned to the AI.
 * Reduced view — not the full COA detail.
 */
interface ChartOfAccountsSummaryDTO {
  totalAccounts: number;
  byClassification: Record<string, number>;
  displayedCount: number;
  truncated: boolean;
  truncationNote?: string;
  topAccounts: Array<{
    code: string;
    name: string;
    classification: string;
    balance: number;
  }>;
}

export class GetChartOfAccountsSummaryTool implements AiTool {
  readonly name = 'accounting.getChartOfAccountsSummary';
  readonly description = 'Get a summary of the Chart of Accounts for the company. Returns total accounts, breakdown by classification, and top accounts by balance. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.accounts.view';
  readonly module = 'accounting';

  private accountRepo: IAccountRepository;
  private permissionChecker: PermissionChecker;

  constructor(
    accountRepo: IAccountRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.accountRepo = accountRepo;
    this.permissionChecker = permissionChecker;
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      await this.permissionChecker.assertOrThrow(context.userId, context.companyId, this.requiredPermission);

      const accounts = await this.accountRepo.list(context.companyId);

      // Count by classification
      const byClassification: Record<string, number> = {
        ASSET: 0,
        LIABILITY: 0,
        EQUITY: 0,
        REVENUE: 0,
        EXPENSE: 0,
      };

      for (const account of accounts) {
        const cls = (account.classification || 'EXPENSE') as string;
        if (cls in byClassification) {
          byClassification[cls]++;
        }
      }

      // Top 20 accounts by absolute balance (use netBalance if available)
      const allAccounts = accounts
        .map((a: any) => ({
          code: a.userCode || a.code || '',
          name: a.name || '',
          classification: a.classification || 'EXPENSE',
          balance: round2(a.netBalance ?? a.balance ?? 0),
        }))
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
      const totalCount = allAccounts.length;
      const topAccounts = allAccounts.slice(0, 20);
      const truncated = totalCount > 20;

      const summary: ChartOfAccountsSummaryDTO = {
        totalAccounts: totalCount,
        byClassification,
        displayedCount: topAccounts.length,
        truncated,
        truncationNote: truncated
          ? `Showing top 20 of ${totalCount} accounts by balance. Navigate to the Chart of Accounts for the complete list.`
          : undefined,
        topAccounts,
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve chart of accounts summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}