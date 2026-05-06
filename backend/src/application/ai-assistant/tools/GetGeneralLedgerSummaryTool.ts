/**
 * GetGeneralLedgerSummaryTool - AI Tool for read-only General Ledger summaries
 *
 * Returns a sanitized summary of the General Ledger for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetGeneralLedgerUseCase } from '../../accounting/use-cases/LedgerUseCases';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 * Reduced view — not the full GL line detail.
 */
interface GeneralLedgerSummaryDTO {
  period: { from: string; to: string };
  accounts: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    side: string;
    amount: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export class GetGeneralLedgerSummaryTool implements AiTool {
  readonly name = 'accounting.getGeneralLedgerSummary';
  readonly description = 'Get a General Ledger summary for the company. Returns journal entries grouped by account for a given period. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.generalLedger.view';
  readonly module = 'accounting';

  private generalLedgerUseCase: GetGeneralLedgerUseCase;

  constructor(
    ledgerRepo: ILedgerRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.generalLedgerUseCase = new GetGeneralLedgerUseCase(
      ledgerRepo,
      permissionChecker,
    );
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      const now = new Date();
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const result = await this.generalLedgerUseCase.execute(
        context.companyId,
        context.userId,
        { fromDate, toDate },
      );

      // Aggregate by account
      const accountMap = new Map<string, { accountCode: string; accountName: string; debit: number; credit: number }>();

      for (const entry of result as any[]) {
        const accId = entry.accountId || '';
        const existing = accountMap.get(accId) || { accountCode: entry.accountCode || '', accountName: entry.accountName || '', debit: 0, credit: 0 };
        existing.debit += Number(entry.debit ?? entry.baseDebit ?? 0) || 0;
        existing.credit += Number(entry.credit ?? entry.baseCredit ?? 0) || 0;
        accountMap.set(accId, existing);
      }

      // Sanitize: top 30 accounts by total absolute movement
      const accounts = Array.from(accountMap.entries())
        .map(([accountId, data]) => ({
          accountId,
          accountCode: data.accountCode,
          accountName: data.accountName,
          side: data.debit >= data.credit ? 'Debit' : 'Credit',
          amount: round2(Math.abs(data.debit - data.credit)),
        }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 30);

      const totalDebit = Array.from(accountMap.values()).reduce((sum, a) => sum + a.debit, 0);
      const totalCredit = Array.from(accountMap.values()).reduce((sum, a) => sum + a.credit, 0);

      const summary: GeneralLedgerSummaryDTO = {
        period: { from: fromDate, to: toDate },
        accounts,
        totalDebit: round2(totalDebit),
        totalCredit: round2(totalCredit),
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve general ledger summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}