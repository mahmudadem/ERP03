"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetProfitAndLossUseCase = void 0;
class GetProfitAndLossUseCase {
    constructor(voucherRepository, permissionChecker) {
        this.voucherRepository = voucherRepository;
        this.permissionChecker = permissionChecker;
    }
    async execute(input) {
        var _a;
        // Check permission
        await this.permissionChecker.assertOrThrow(input.userId, input.companyId, 'accounting.reports.profitAndLoss.view');
        // Fetch vouchers in the date range (V2 interface uses ISO date strings)
        const fromDateStr = input.fromDate.toISOString().split('T')[0];
        const toDateStr = input.toDate.toISOString().split('T')[0];
        const vouchers = await this.voucherRepository.findByDateRange(input.companyId, fromDateStr, toDateStr);
        console.log(`📊 Fetched ${vouchers.length} vouchers from repository`);
        // V1: Filter only vouchers with financial effect (isPosted = true means postedAt exists)
        const postedVouchers = vouchers.filter(v => v.isPosted);
        console.log(`🔒 Found ${postedVouchers.length} posted vouchers (filtered from ${vouchers.length} total)`);
        // Calculate revenue and expenses
        const revenueMap = new Map();
        const expenseMap = new Map();
        let totalRevenue = 0;
        let totalExpenses = 0;
        for (const voucher of postedVouchers) {
            console.log(`  Processing ${voucher.voucherNo || voucher.id}: ${((_a = voucher.lines) === null || _a === void 0 ? void 0 : _a.length) || 0} lines`);
            for (const line of voucher.lines || []) {
                const accountId = line.accountId;
                // Revenue accounts typically start with 4 (e.g., 4000-4999)
                // Expenses typically start with 5 or 6 (e.g., 5000-6999)
                const isRevenueAccount = accountId.startsWith('4');
                const isExpenseAccount = accountId.startsWith('5') || accountId.startsWith('6');
                if (isRevenueAccount) {
                    // Revenue increases with credits (V2 uses creditAmount getter)
                    const amount = line.creditAmount || 0;
                    console.log(`    Revenue: ${accountId} = ${amount}`);
                    totalRevenue += amount;
                    const existing = revenueMap.get(accountId) || { accountName: accountId, amount: 0 };
                    existing.amount += amount;
                    revenueMap.set(accountId, existing);
                }
                if (isExpenseAccount) {
                    // Expenses increase with debits (V2 uses debitAmount getter)
                    const amount = line.debitAmount || 0;
                    console.log(`    Expense: ${accountId} = ${amount}`);
                    totalExpenses += amount;
                    const existing = expenseMap.get(accountId) || { accountName: accountId, amount: 0 };
                    existing.amount += amount;
                    expenseMap.set(accountId, existing);
                }
            }
        }
        return {
            revenue: totalRevenue,
            expenses: totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            revenueByAccount: Array.from(revenueMap.entries()).map(([accountId, data]) => ({
                accountId,
                accountName: data.accountName,
                amount: data.amount
            })),
            expensesByAccount: Array.from(expenseMap.entries()).map(([accountId, data]) => ({
                accountId,
                accountName: data.accountName,
                amount: data.amount
            })),
            period: {
                from: input.fromDate,
                to: input.toDate
            }
        };
    }
}
exports.GetProfitAndLossUseCase = GetProfitAndLossUseCase;
//# sourceMappingURL=GetProfitAndLossUseCase.js.map