"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetTrialBalanceUseCase = void 0;
class GetTrialBalanceUseCase {
    constructor(accountRepo, voucherRepo, permissionChecker) {
        this.accountRepo = accountRepo;
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId) {
        // RBAC: Check permission
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.trialBalance.view');
        // 1. Fetch all accounts to map names and codes
        const accounts = this.accountRepo.getAccounts
            ? await this.accountRepo.getAccounts(companyId)
            : await this.accountRepo.list(companyId);
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        // 2. Fetch all vouchers and filter by status (V1: use isApproved and isPosted)
        const allVouchers = await this.voucherRepo.findByCompany(companyId) || [];
        // V1: Include APPROVED vouchers (which may or may not be posted) and any posted vouchers
        const validVouchers = allVouchers.filter(v => v.isApproved || v.isPosted);
        // 3. Aggregate Balances
        const balances = {};
        accounts.forEach(acc => {
            balances[acc.id] = { debit: 0, credit: 0 };
        });
        for (const voucher of validVouchers) {
            if (!voucher.lines)
                continue;
            for (const line of voucher.lines) {
                if (!balances[line.accountId]) {
                    balances[line.accountId] = { debit: 0, credit: 0 };
                }
                // V2 VoucherLineEntity uses debitAmount/creditAmount getters
                balances[line.accountId].debit += line.debitAmount || 0;
                balances[line.accountId].credit += line.creditAmount || 0;
            }
        }
        // 4. Transform to Result
        const report = Object.keys(balances).map(accId => {
            const b = balances[accId];
            const acc = accountMap.get(accId);
            const code = (acc === null || acc === void 0 ? void 0 : acc.code) || '???';
            const name = (acc === null || acc === void 0 ? void 0 : acc.name) || `Unknown Account (${accId})`;
            const type = (acc === null || acc === void 0 ? void 0 : acc.type) || 'EXPENSE';
            let net = 0;
            if (['ASSET', 'EXPENSE'].includes(type)) {
                net = b.debit - b.credit;
            }
            else {
                net = b.credit - b.debit;
            }
            return {
                accountId: accId,
                code: code,
                name: name,
                type: type,
                totalDebit: b.debit,
                totalCredit: b.credit,
                netBalance: net
            };
        });
        // Sort by Account Code
        return report.sort((a, b) => a.code.localeCompare(b.code));
    }
}
exports.GetTrialBalanceUseCase = GetTrialBalanceUseCase;
//# sourceMappingURL=ReportingUseCases.js.map