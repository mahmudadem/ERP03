/**
 * GetTrialBalanceSummaryTool - AI Tool for read-only trial balance summaries
 *
 * This tool gives the AI Assistant access to trial balance summaries for
 * advisory purposes ONLY. It returns a sanitized summary DTO — never
 * raw database entities or full chart of account details.
 *
 * READ-ONLY ENFORCEMENT:
 * - This tool calls GetTrialBalanceUseCase which is a READ use case
 * - GetTrialBalanceUseCase already enforces permission checks internally
 * - This tool adds an additional permission layer (ai-assistant.tools.accounting.trial-balance)
 * - The result is summarized and sanitized before returning to the AI
 *
 * Company isolation is enforced through companyId scoping.
 * The AI receives only summary data it can use to advise the user.
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetTrialBalanceUseCase } from '../../accounting/use-cases/LedgerUseCases';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

/**
 * Sanitized summary DTO returned to the AI.
 * This is a REDUCED view — not the full trial balance line detail.
 */
interface TrialBalanceSummaryDTO {
  asOfDate: string;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  accountCount: number;
  topAccounts: Array<{
    code: string;
    name: string;
    classification: string;
    closingDebit: number;
    closingCredit: number;
    netBalance: number;
  }>;
}

export class GetTrialBalanceSummaryTool implements AiTool {
  readonly name = 'accounting.getTrialBalanceSummary';
  readonly description = 'Get a summary of the trial balance for the company. Returns total debits, credits, balance status, and top accounts. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.trialBalance.view';
  readonly module = 'accounting';

  private trialBalanceUseCase: GetTrialBalanceUseCase;

  constructor(
    ledgerRepo: ILedgerRepository,
    accountRepo: IAccountRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.trialBalanceUseCase = new GetTrialBalanceUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
    );
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      // Extract params with defaults
      const asOfDate = (params?.asOfDate as string) || new Date().toISOString().split('T')[0];
      const includeZeroBalance = (params?.includeZeroBalance as boolean) ?? false;

      // Call the existing use case with company and user context
      const result = await this.trialBalanceUseCase.execute(
        context.companyId,
        context.userId,
        asOfDate,
        includeZeroBalance,
        false, // excludeSpecialPeriods — always false for AI summary
      );

      // Sanitize and summarize: limit to top 20 accounts by closing balance
      const sortedAccounts = [...result.data]
        .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
        .slice(0, 20);

      const summary: TrialBalanceSummaryDTO = {
        asOfDate,
        isBalanced: result.meta.isBalanced,
        totalDebit: result.meta.totalClosingDebit,
        totalCredit: result.meta.totalClosingCredit,
        difference: result.meta.difference,
        accountCount: result.data.length,
        topAccounts: sortedAccounts.map(line => ({
          code: line.code,
          name: line.name,
          classification: line.classification,
          closingDebit: line.closingDebit,
          closingCredit: line.closingCredit,
          netBalance: line.netBalance,
        })),
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve trial balance summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}