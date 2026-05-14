/**
 * GetFiscalYearStatusTool - AI Tool for read-only Fiscal Year status
 *
 * Returns the current fiscal year status and period information.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { IFiscalYearRepository } from '../../../repository/interfaces/accounting/IFiscalYearRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

/**
 * Sanitized summary DTO returned to the AI.
 */
interface FiscalYearStatusDTO {
  hasActiveFiscalYear: boolean;
  fiscalYearName: string | null;
  startDate: string | null;
  endDate: string | null;
  currentPeriod: string | null;
  totalPeriods: number;
  daysRemaining: number | null;
  isPeriodClosed: boolean | null;
}

// No truncation: returns a single fiscal-year status object, not a list.
// Truncation signals (truncated, totalCount, displayedCount) are not applicable
// because this tool never returns an array of items that could grow unbounded.
export class GetFiscalYearStatusTool implements AiTool {
  readonly name = 'accounting.getAccountingPeriodStatus';
  readonly description = 'Get the current fiscal year status and accounting period information for the company. Returns fiscal year name, dates, current period, and days remaining. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'accounting.reports.view';
  readonly module = 'accounting';

  private fiscalYearRepo: IFiscalYearRepository;
  private permissionChecker: PermissionChecker;

  constructor(
    fiscalYearRepo: IFiscalYearRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.fiscalYearRepo = fiscalYearRepo;
    this.permissionChecker = permissionChecker;
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      await this.permissionChecker.assertOrThrow(context.userId, context.companyId, this.requiredPermission);

      const today = (params?.asOfDate as string) || new Date().toISOString().split('T')[0];

      const fiscalYear = await this.fiscalYearRepo.findActiveForDate(context.companyId, today);

      if (!fiscalYear) {
        const summary: FiscalYearStatusDTO = {
          hasActiveFiscalYear: false,
          fiscalYearName: null,
          startDate: null,
          endDate: null,
          currentPeriod: null,
          totalPeriods: 0,
          daysRemaining: null,
          isPeriodClosed: null,
        };

        return {
          success: true,
          data: summary as unknown as Record<string, unknown>,
        };
      }

      // Find current period
      const currentPeriod = fiscalYear.periods.find((p: any) => {
        const start = p.startDate || p.start;
        const end = p.endDate || p.end;
        return today >= start && today <= end;
      });

      // Calculate days remaining in fiscal year
      const endDate = fiscalYear.endDate;
      const daysRemaining = Math.max(0, Math.ceil(
        (new Date(endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
      ));

      const isPeriodClosed = currentPeriod
        ? (currentPeriod.status === 'CLOSED' as string || String(currentPeriod.status) === 'CLOSED')
        : null;

      const summary: FiscalYearStatusDTO = {
        hasActiveFiscalYear: true,
        fiscalYearName: fiscalYear.name,
        startDate: fiscalYear.startDate,
        endDate: fiscalYear.endDate,
        currentPeriod: currentPeriod ? (currentPeriod.name || `Period ${currentPeriod.periodNo}`) : null,
        totalPeriods: fiscalYear.periods.length,
        daysRemaining,
        isPeriodClosed,
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve fiscal year status: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}