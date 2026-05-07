"use strict";
/**
 * GetTopCustomersTool - AI Tool for read-only Top Customers report
 *
 * Returns the top customers by revenue for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via sales.invoices.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetTopCustomersTool = void 0;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetTopCustomersTool {
    constructor(salesInvoiceRepo, partyRepo, permissionChecker) {
        this.name = 'sales.getTopCustomers';
        this.description = 'Get top customers by revenue for the company. Returns customer name, invoice count, and total revenue. Optionally accepts limit, fromDate, and toDate parameters. Read-only — cannot create, modify, or post anything.';
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
            const limit = (params === null || params === void 0 ? void 0 : params.limit) || 10;
            const invoices = await this.salesInvoiceRepo.list(context.companyId);
            // Filter by date range
            const filtered = invoices.filter((inv) => {
                const date = inv.invoiceDate || inv.date;
                if (!date)
                    return true;
                const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
                return dateStr >= fromDate && dateStr <= toDate;
            });
            // Aggregate by customer
            const customerMap = new Map();
            for (const inv of filtered) {
                const revenue = inv.grandTotalBase || inv.grandTotalDoc || 0;
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
            // Sort by revenue and limit
            const customers = Array.from(customerMap.entries())
                .map(([customerId, data]) => ({
                customerId,
                customerName: data.customerName,
                invoiceCount: data.invoiceCount,
                totalRevenue: round2(data.totalRevenue),
            }))
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, limit);
            const summary = {
                customers,
                period: { from: fromDate, to: toDate },
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
                error: `Failed to retrieve top customers: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetTopCustomersTool = GetTopCustomersTool;
//# sourceMappingURL=GetTopCustomersTool.js.map