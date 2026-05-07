"use strict";
/**
 * GetSalesSummaryTool - AI Tool for read-only Sales summaries
 *
 * Returns a sanitized summary of sales invoices for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via sales.invoices.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSalesSummaryTool = void 0;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetSalesSummaryTool {
    constructor(salesInvoiceRepo, partyRepo, permissionChecker) {
        this.name = 'sales.getSalesSummary';
        this.description = 'Get a sales summary for the company. Returns total revenue, invoice count, average invoice value, breakdown by status, and top customers. Optionally accepts fromDate and toDate. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'sales.invoices.view';
        this.module = 'sales';
        this.salesInvoiceRepo = salesInvoiceRepo;
        this.partyRepo = partyRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(context, params) {
        try {
            await this.permissionChecker.assertOrThrow(context.userId, context.companyId, this.requiredPermission);
            const now = new Date();
            const fromDate = (params === null || params === void 0 ? void 0 : params.fromDate) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const toDate = (params === null || params === void 0 ? void 0 : params.toDate) || now.toISOString().split('T')[0];
            const invoices = await this.salesInvoiceRepo.list(context.companyId);
            // Filter by date range
            const filtered = invoices.filter((inv) => {
                const date = inv.invoiceDate || inv.date;
                if (!date)
                    return true; // include if no date
                const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
                return dateStr >= fromDate && dateStr <= toDate;
            });
            // Aggregate metrics
            let totalRevenue = 0;
            const byStatus = { DRAFT: 0, POSTED: 0, CANCELLED: 0 };
            const customerMap = new Map();
            for (const inv of filtered) {
                const revenue = inv.grandTotalBase || inv.grandTotalDoc || 0;
                totalRevenue += Number(revenue) || 0;
                const status = String(inv.status || 'DRAFT').toUpperCase();
                if (status in byStatus) {
                    byStatus[status]++;
                }
                const customerId = inv.customerId || '';
                if (customerId) {
                    const existing = customerMap.get(customerId) || { customerName: inv.customerName || 'Unknown', invoiceCount: 0, totalRevenue: 0 };
                    existing.invoiceCount++;
                    existing.totalRevenue += Number(revenue) || 0;
                    customerMap.set(customerId, existing);
                }
            }
            // Enrich customer names from party repository
            try {
                const parties = await this.partyRepo.list(context.companyId, { role: 'CUSTOMER' });
                const partyMap = new Map(parties.map((p) => [p.id, p]));
                for (const [customerId, data] of customerMap.entries()) {
                    const party = partyMap.get(customerId);
                    if (party) {
                        data.customerName = party.displayName || party.legalName || data.customerName;
                    }
                }
            }
            catch (_a) {
                // Party names from invoices are acceptable fallback
            }
            // Top 10 customers by revenue
            const topCustomers = Array.from(customerMap.entries())
                .map(([customerId, data]) => ({
                customerId,
                customerName: data.customerName,
                invoiceCount: data.invoiceCount,
                totalRevenue: round2(data.totalRevenue),
            }))
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, 10);
            const invoiceCount = filtered.length;
            const averageInvoiceValue = invoiceCount > 0 ? round2(totalRevenue / invoiceCount) : 0;
            const summary = {
                period: { from: fromDate, to: toDate },
                totalRevenue: round2(totalRevenue),
                invoiceCount,
                averageInvoiceValue,
                byStatus,
                topCustomers,
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
                error: `Failed to retrieve sales summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetSalesSummaryTool = GetSalesSummaryTool;
//# sourceMappingURL=GetSalesSummaryTool.js.map