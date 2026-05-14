/**
 * GetFinancialOverviewTool - AI Meta-Tool for combined financial overview
 *
 * Returns a combined summary of P&L, Balance Sheet, Cash Flow, and Aging
 * in a single call for quick financial health assessment.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { GetProfitAndLossUseCase } from '../../reporting/use-cases/GetProfitAndLossUseCase';
import { GetBalanceSheetUseCase } from '../../accounting/use-cases/LedgerUseCases';
import { GetCashFlowStatementUseCase } from '../../accounting/use-cases/CashFlowUseCases';
import { AgingReportUseCase } from '../../accounting/use-cases/AgingReportUseCase';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 */
interface FinancialOverviewDTO {
  pnl: {
    revenue: number;
    expenses: number;
    netProfit: number;
  };
  balanceSheet: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    isBalanced: boolean;
  };
  cash: {
    netCashChange: number;
    openingCashBalance: number;
    closingCashBalance: number;
  };
  aging: {
    totalReceivables: number;
    totalPayables: number;
  };
}

// No truncation: returns aggregated financial totals (P&L, BS, cash, aging),
// not a list of items. Truncation signals are not applicable because this tool
// computes summary numbers from sub-queries and never slices an array.
export class GetFinancialOverviewTool implements AiTool {
  readonly name = 'reports.getFinancialOverview';
  readonly description = 'Get a combined financial overview for the company including P&L summary, Balance Sheet summary, Cash Flow summary, and Aging totals. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.view';
  readonly module = 'reports';

  private plUseCase: GetProfitAndLossUseCase;
  private balanceSheetUseCase: GetBalanceSheetUseCase;
  private cashFlowUseCase: GetCashFlowStatementUseCase;
  private agingUseCase: AgingReportUseCase;

  constructor(
    ledgerRepo: ILedgerRepository,
    accountRepo: IAccountRepository,
    companyRepo: ICompanyRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.plUseCase = new GetProfitAndLossUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
    );
    this.balanceSheetUseCase = new GetBalanceSheetUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
      companyRepo,
    );
    this.cashFlowUseCase = new GetCashFlowStatementUseCase(
      ledgerRepo,
      accountRepo,
      companyRepo,
      permissionChecker,
    );
    this.agingUseCase = new AgingReportUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
    );
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      const now = new Date();
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const asOfDate = toDate; // For BS, Cash, Aging we use toDate as asOfDate

      // Run all four queries in parallel for performance
      const [plResult, bsResult, cashResult, arResult, apResult] = await Promise.all([
        this.plUseCase.execute({
          companyId: context.companyId,
          userId: context.userId,
          fromDate,
          toDate,
        }).catch((err: Error) => ({ __error: err.message })),
        this.balanceSheetUseCase.execute(
          context.companyId,
          context.userId,
          asOfDate,
          false,
        ).catch((err: Error) => ({ __error: err.message })),
        this.cashFlowUseCase.execute(
          context.companyId,
          context.userId,
          fromDate,
          toDate,
          false,
        ).catch((err: Error) => ({ __error: err.message })),
        this.agingUseCase.execute(
          context.companyId,
          context.userId,
          'AR',
          asOfDate,
        ).catch((err: Error) => ({ __error: err.message })),
        this.agingUseCase.execute(
          context.companyId,
          context.userId,
          'AP',
          asOfDate,
        ).catch((err: Error) => ({ __error: err.message })),
      ]);

      const isPlError = (plResult as any).__error !== undefined;
      const isBsError = (bsResult as any).__error !== undefined;
      const isCashError = (cashResult as any).__error !== undefined;
      const isArError = (arResult as any).__error !== undefined;
      const isApError = (apResult as any).__error !== undefined;

      // If all fail, return error
      if (isPlError && isBsError && isCashError && isArError && isApError) {
        return {
          success: false,
          data: null,
          error: `All financial data sources failed. P&L: ${(plResult as any).__error}`,
          errorCode: 'DATA_UNAVAILABLE',
        };
      }

      const summary: FinancialOverviewDTO = {
        pnl: isPlError
          ? { revenue: 0, expenses: 0, netProfit: 0 }
          : {
              revenue: round2((plResult as any).revenue ?? 0),
              expenses: round2((plResult as any).expenses ?? 0),
              netProfit: round2((plResult as any).netProfit ?? 0),
            },
        balanceSheet: isBsError
          ? { totalAssets: 0, totalLiabilities: 0, totalEquity: 0, isBalanced: false }
          : {
              totalAssets: round2((bsResult as any).totalAssets ?? 0),
              totalLiabilities: round2((bsResult as any).liabilities?.total ?? 0),
              totalEquity: round2((bsResult as any).equity?.total ?? 0),
              isBalanced: (bsResult as any).isBalanced ?? false,
            },
        cash: isCashError
          ? { netCashChange: 0, openingCashBalance: 0, closingCashBalance: 0 }
          : {
              netCashChange: round2((cashResult as any).netCashChange ?? 0),
              openingCashBalance: round2((cashResult as any).openingCashBalance ?? 0),
              closingCashBalance: round2((cashResult as any).closingCashBalance ?? 0),
            },
        aging: {
          totalReceivables: isArError ? 0 : round2(Math.abs((arResult as any).grandTotal ?? 0)),
          totalPayables: isApError ? 0 : round2(Math.abs((apResult as any).grandTotal ?? 0)),
        },
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve financial overview: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}