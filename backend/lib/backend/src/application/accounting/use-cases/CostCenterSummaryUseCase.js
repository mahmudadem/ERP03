"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCostCenterSummaryUseCase = void 0;
class GetCostCenterSummaryUseCase {
    constructor(ledgerRepo, accountRepo, costCenterRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.costCenterRepo = costCenterRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        // RBAC
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        // 1. Resolve cost center
        const cc = await this.costCenterRepo.findById(companyId, filters.costCenterId);
        if (!cc) {
            throw new Error(`Cost center not found: ${filters.costCenterId}`);
        }
        // 2. Fetch all ledger entries for this cost center
        const glFilters = {
            costCenterId: filters.costCenterId,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
        };
        const entries = await this.ledgerRepo.getGeneralLedger(companyId, glFilters);
        // 3. Aggregate by accountId
        const aggregates = new Map();
        for (const entry of entries) {
            const existing = aggregates.get(entry.accountId) || { debit: 0, credit: 0 };
            existing.debit += entry.debit || 0;
            existing.credit += entry.credit || 0;
            aggregates.set(entry.accountId, existing);
        }
        // 4. Enrich with account data
        const accounts = this.accountRepo.getAccounts
            ? await this.accountRepo.getAccounts(companyId)
            : await this.accountRepo.list(companyId);
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        // 5. Build rows
        const rows = [];
        let totalDebit = 0;
        let totalCredit = 0;
        for (const [accountId, totals] of aggregates.entries()) {
            const acc = accountMap.get(accountId);
            const row = {
                accountId,
                accountCode: (acc === null || acc === void 0 ? void 0 : acc.code) || (acc === null || acc === void 0 ? void 0 : acc.userCode) || '???',
                accountName: (acc === null || acc === void 0 ? void 0 : acc.name) || 'Unknown Account',
                classification: (acc === null || acc === void 0 ? void 0 : acc.classification) || '',
                totalDebit: totals.debit,
                totalCredit: totals.credit,
                netBalance: totals.debit - totals.credit,
            };
            totalDebit += totals.debit;
            totalCredit += totals.credit;
            rows.push(row);
        }
        // Sort by account code
        rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
        return {
            rows,
            meta: {
                costCenterId: cc.id,
                costCenterCode: cc.code,
                costCenterName: cc.name,
                fromDate: filters.fromDate,
                toDate: filters.toDate,
                totalDebit,
                totalCredit,
                netBalance: totalDebit - totalCredit,
            },
        };
    }
}
exports.GetCostCenterSummaryUseCase = GetCostCenterSummaryUseCase;
//# sourceMappingURL=CostCenterSummaryUseCase.js.map