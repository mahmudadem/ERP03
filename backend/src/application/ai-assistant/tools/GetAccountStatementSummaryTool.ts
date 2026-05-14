/**
 * GetAccountStatementSummaryTool - AI Tool for read-only Account Statement summaries
 *
 * Returns a sanitized summary of a single account statement for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetAccountStatementUseCase } from '../../accounting/use-cases/LedgerUseCases';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 * Reduced view — not the full statement line detail.
 */
interface AccountStatementSummaryDTO {
  accountCode: string;
  accountName: string;
  period: { from: string; to: string };
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

// No truncation: returns a single account statement summary (opening/closing balance,
// totals) for ONE account. Not a list — truncation signals are not applicable.
export class GetAccountStatementSummaryTool implements AiTool {
  readonly name = 'accounting.getAccountStatementSummary';
  readonly description = 'Get an Account Statement summary for a specific account. Returns opening balance, total debit/credit, and closing balance for the period. Requires accountCode parameter. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.generalLedger.view';
  readonly module = 'accounting';

  private accountStatementUseCase: GetAccountStatementUseCase;
  private accountRepo: IAccountRepository;

  constructor(
    ledgerRepo: ILedgerRepository,
    accountRepo: IAccountRepository,
    companyRepo: ICompanyRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.accountStatementUseCase = new GetAccountStatementUseCase(
      ledgerRepo,
      permissionChecker,
      accountRepo,
      companyRepo,
    );
    this.accountRepo = accountRepo;
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      const accountCode = params?.accountCode as string;
      if (!accountCode) {
        return {
          success: false,
          data: null,
          error: 'accountCode is required for account statement summary',
          errorCode: 'MISSING_PARAMETER',
        };
      }

      const now = new Date();
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];

      // Resolve accountCode to accountId using the account repository
      const accounts = await this.accountRepo.list(context.companyId);
      const account = accounts.find((a: any) =>
        a.userCode === accountCode || (a as any).code === accountCode || (a as any).systemCode === accountCode
      );

      if (!account) {
        return {
          success: false,
          data: null,
          error: `Account not found with code: ${accountCode}`,
          errorCode: 'DATA_UNAVAILABLE',
        };
      }

      const accountId = account.id;

      const result = await this.accountStatementUseCase.execute(
        context.companyId,
        context.userId,
        accountId,
        fromDate,
        toDate,
      );

      const summary: AccountStatementSummaryDTO = {
        accountCode: (result as any).accountCode || accountCode,
        accountName: (result as any).accountName || account.name || 'Unknown',
        period: {
          from: (result as any).fromDate || fromDate,
          to: (result as any).toDate || toDate,
        },
        openingBalance: round2((result as any).openingBalance ?? (result as any).openingBalanceBase ?? 0),
        totalDebit: round2((result as any).totalDebit ?? (result as any).totalBaseDebit ?? 0),
        totalCredit: round2((result as any).totalCredit ?? (result as any).totalBaseCredit ?? 0),
        closingBalance: round2((result as any).closingBalance ?? (result as any).closingBalanceBase ?? 0),
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve account statement summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}