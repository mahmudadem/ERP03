/**
 * GetAccountBalanceTool - AI Tool for read-only Account Balance lookups
 *
 * Returns the current balance of a specific account from the Trial Balance.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetTrialBalanceUseCase } from '../../accounting/use-cases/LedgerUseCases';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 */
interface AccountBalanceDTO {
  accountCode: string;
  accountName: string;
  classification: string;
  balance: number;
  debit: number;
  credit: number;
}

// No truncation: returns the balance of a SINGLE account. Not a list —
// truncation signals are not applicable.
export class GetAccountBalanceTool implements AiTool {
  readonly name = 'accounting.getAccountBalance';
  readonly description = 'Get the balance of a specific account. Requires accountCode parameter. Optionally accepts asOfDate. Returns account code, name, classification, balance, debit, and credit. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.generalLedger.view';
  readonly module = 'accounting';

  private trialBalanceUseCase: GetTrialBalanceUseCase;
  private accountRepo: IAccountRepository;

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
    this.accountRepo = accountRepo;
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      const accountCode = params?.accountCode as string;
      if (!accountCode) {
        return {
          success: false,
          data: null,
          error: 'accountCode is required for account balance lookup',
          errorCode: 'MISSING_PARAMETER',
        };
      }

      const asOfDate = (params?.asOfDate as string) || new Date().toISOString().split('T')[0];

      // Find account by code
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

      const result = await this.trialBalanceUseCase.execute(
        context.companyId,
        context.userId,
        asOfDate,
        true, // includeZeroBalance
        false, // excludeSpecialPeriods
      );

      // Find the specific account in the trial balance
      const tbLine = result.data.find((line: any) => line.accountId === account.id);

      const classification = account.classification || 'EXPENSE';

      // Compute balance: positive-by-nature
      let balance: number;
      let debit: number;
      let credit: number;

      if (tbLine) {
        debit = tbLine.closingDebit;
        credit = tbLine.closingCredit;
        if (['ASSET', 'EXPENSE'].includes(classification)) {
          balance = debit - credit;
        } else {
          balance = credit - debit;
        }
      } else {
        debit = 0;
        credit = 0;
        balance = 0;
      }

      const summary: AccountBalanceDTO = {
        accountCode: account.userCode || (account as any).code || accountCode,
        accountName: account.name || 'Unknown',
        classification,
        balance: round2(balance),
        debit: round2(debit),
        credit: round2(credit),
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve account balance: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}