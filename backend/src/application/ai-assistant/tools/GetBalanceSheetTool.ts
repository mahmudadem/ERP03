/**
 * GetBalanceSheetTool - AI Tool for read-only Balance Sheet summaries
 *
 * Returns a sanitized summary of the Balance Sheet for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.balanceSheet.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetBalanceSheetUseCase } from '../../accounting/use-cases/LedgerUseCases';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

/**
 * Sanitized summary DTO returned to the AI.
 * Reduced view — not the full hierarchical detail.
 */
interface BalanceSheetSummaryDTO {
  asOfDate: string;
  baseCurrency: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  retainedEarnings: number;
  isBalanced: boolean;
  difference: number;
  topAssets: Array<{ code: string; name: string; balance: number }>;
  topLiabilities: Array<{ code: string; name: string; balance: number }>;
  topEquity: Array<{ code: string; name: string; balance: number }>;
}

export class GetBalanceSheetTool implements AiTool {
  readonly name = 'accounting.getBalanceSheet';
  readonly description = 'Get a Balance Sheet summary for the company. Returns assets, liabilities, equity totals, and top accounts. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.balanceSheet.view';
  readonly module = 'accounting';

  private balanceSheetUseCase: GetBalanceSheetUseCase;

  constructor(
    ledgerRepo: ILedgerRepository,
    accountRepo: IAccountRepository,
    permissionChecker: PermissionChecker,
    companyRepo?: ICompanyRepository,
  ) {
    this.balanceSheetUseCase = new GetBalanceSheetUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
      companyRepo,
    );
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      const asOfDate = (params?.asOfDate as string) || new Date().toISOString().split('T')[0];

      const result = await this.balanceSheetUseCase.execute(
        context.companyId,
        context.userId,
        asOfDate,
        false, // excludeSpecialPeriods
      );

      // Sanitize: top 10 accounts per section by absolute balance
      const topAssets = result.assets.accounts
        .filter(a => !a.isParent)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, 10)
        .map(a => ({ code: a.code, name: a.name, balance: a.balance }));

      const topLiabilities = result.liabilities.accounts
        .filter(a => !a.isParent)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, 10)
        .map(a => ({ code: a.code, name: a.name, balance: a.balance }));

      const topEquity = result.equity.accounts
        .filter(a => !a.isParent)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, 10)
        .map(a => ({ code: a.code, name: a.name, balance: a.balance }));

      const summary: BalanceSheetSummaryDTO = {
        asOfDate: result.asOfDate,
        baseCurrency: result.baseCurrency,
        totalAssets: result.totalAssets,
        totalLiabilities: result.liabilities.total,
        totalEquity: result.equity.total,
        totalLiabilitiesAndEquity: result.totalLiabilitiesAndEquity,
        retainedEarnings: result.retainedEarnings,
        isBalanced: result.isBalanced,
        difference: Math.round((result.totalAssets - result.totalLiabilitiesAndEquity) * 100) / 100,
        topAssets,
        topLiabilities,
        topEquity,
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve balance sheet summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}