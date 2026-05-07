"use strict";
/**
 * GetTopSuppliersTool - AI Tool for read-only Top Suppliers report
 *
 * Returns the top suppliers by spend for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via purchases.invoices.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetTopSuppliersTool = void 0;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetTopSuppliersTool {
    constructor(purchaseInvoiceRepo, partyRepo, permissionChecker) {
        this.name = 'purchase.getTopSuppliers';
        this.description = 'Get top suppliers by spend for the company. Returns vendor name, invoice count, and total spend. Optionally accepts limit, fromDate, and toDate parameters. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'purchases.invoices.view';
        this.module = 'purchase';
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
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
            const invoices = await this.purchaseInvoiceRepo.list(context.companyId);
            // Filter by date range
            const filtered = invoices.filter((inv) => {
                const date = inv.invoiceDate || inv.date;
                if (!date)
                    return true;
                const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
                return dateStr >= fromDate && dateStr <= toDate;
            });
            // Aggregate by vendor
            const vendorMap = new Map();
            for (const inv of filtered) {
                const spend = inv.grandTotalBase || inv.grandTotalDoc || 0;
                const vendorId = inv.vendorId || '';
                if (vendorId) {
                    const existing = vendorMap.get(vendorId) || { vendorName: inv.vendorName || 'Unknown', invoiceCount: 0, totalSpend: 0 };
                    existing.invoiceCount++;
                    existing.totalSpend += Number(spend) || 0;
                    vendorMap.set(vendorId, existing);
                }
            }
            // Enrich vendor names from party repository
            try {
                const parties = await this.partyRepo.list(context.companyId, { role: 'VENDOR' });
                const partyMap = new Map(parties.map((p) => [p.id, p]));
                for (const [vendorId, data] of vendorMap.entries()) {
                    const party = partyMap.get(vendorId);
                    if (party) {
                        data.vendorName = party.displayName || party.legalName || data.vendorName;
                    }
                }
            }
            catch (_a) {
                // Vendor names from invoices are acceptable fallback
            }
            // Sort by spend and limit
            const suppliers = Array.from(vendorMap.entries())
                .map(([vendorId, data]) => ({
                vendorId,
                vendorName: data.vendorName,
                invoiceCount: data.invoiceCount,
                totalSpend: round2(data.totalSpend),
            }))
                .sort((a, b) => b.totalSpend - a.totalSpend)
                .slice(0, limit);
            const summary = {
                suppliers,
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
                error: `Failed to retrieve top suppliers: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetTopSuppliersTool = GetTopSuppliersTool;
//# sourceMappingURL=GetTopSuppliersTool.js.map