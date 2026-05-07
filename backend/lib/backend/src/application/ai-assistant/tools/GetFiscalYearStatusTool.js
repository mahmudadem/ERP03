"use strict";
/**
 * GetFiscalYearStatusTool - AI Tool for read-only Fiscal Year status
 *
 * Returns the current fiscal year status and period information.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetFiscalYearStatusTool = void 0;
class GetFiscalYearStatusTool {
    constructor(fiscalYearRepo, permissionChecker) {
        this.name = 'accounting.getAccountingPeriodStatus';
        this.description = 'Get the current fiscal year status and accounting period information for the company. Returns fiscal year name, dates, current period, and days remaining. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.view';
        this.module = 'accounting';
        this.fiscalYearRepo = fiscalYearRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(context, params) {
        try {
            await this.permissionChecker.assertOrThrow(context.userId, context.companyId, this.requiredPermission);
            const today = (params === null || params === void 0 ? void 0 : params.asOfDate) || new Date().toISOString().split('T')[0];
            const fiscalYear = await this.fiscalYearRepo.findActiveForDate(context.companyId, today);
            if (!fiscalYear) {
                const summary = {
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
                    data: summary,
                };
            }
            // Find current period
            const currentPeriod = fiscalYear.periods.find((p) => {
                const start = p.startDate || p.start;
                const end = p.endDate || p.end;
                return today >= start && today <= end;
            });
            // Calculate days remaining in fiscal year
            const endDate = fiscalYear.endDate;
            const daysRemaining = Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)));
            const isPeriodClosed = currentPeriod
                ? (currentPeriod.status === 'CLOSED' || String(currentPeriod.status) === 'CLOSED')
                : null;
            const summary = {
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
                data: summary,
            };
        }
        catch (error) {
            return {
                success: false,
                data: null,
                error: `Failed to retrieve fiscal year status: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetFiscalYearStatusTool = GetFiscalYearStatusTool;
//# sourceMappingURL=GetFiscalYearStatusTool.js.map