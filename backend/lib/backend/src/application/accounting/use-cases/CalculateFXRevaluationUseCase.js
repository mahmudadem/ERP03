"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculateFXRevaluationUseCase = void 0;
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
class CalculateFXRevaluationUseCase {
    constructor(ledgerRepo, accountRepo, companyRepo) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.companyRepo = companyRepo;
    }
    /**
     * Calculates the unrealized gains/losses for foreign currency accounts.
     * Does NOT save anything to the database.
     */
    async execute(input) {
        const { companyId, asOfDate, targetAccountIds, exchangeRates } = input;
        // 1. Get company base currency
        const company = await this.companyRepo.findById(companyId);
        if (!company) {
            throw new Error(`Company not found: ${companyId}`);
        }
        const { baseCurrency } = company;
        // 2. Fetch current foreign balances from Ledger
        const foreignBalances = await this.ledgerRepo.getForeignBalances(companyId, asOfDate, targetAccountIds);
        // 3. Fetch Account details for these balances to enrich the result
        const resultLines = [];
        let totalGain = 0;
        let totalLoss = 0;
        for (const bal of foreignBalances) {
            // Skip if foreign balance is exactly 0
            if ((0, VoucherLineEntity_1.roundMoney)(bal.foreignBalance) === 0) {
                continue;
            }
            const account = await this.accountRepo.getById(companyId, bal.accountId);
            if (!account)
                continue;
            const newRate = exchangeRates[bal.currency];
            if (newRate === undefined || newRate <= 0) {
                throw new Error(`Missing or invalid exchange rate for currency: ${bal.currency}`);
            }
            // Calculate what the base balance SHOULD be at the new rate
            const targetBaseBalanceRaw = bal.foreignBalance * newRate;
            const targetBaseBalance = (0, VoucherLineEntity_1.roundMoney)(targetBaseBalanceRaw);
            const historicalBaseBalance = (0, VoucherLineEntity_1.roundMoney)(bal.baseBalance);
            // Delta = Target - Historical
            // Positive: Debit adjustment (Gain for Asset, Loss for Liability)
            const deltaBase = (0, VoucherLineEntity_1.roundMoney)(targetBaseBalance - historicalBaseBalance);
            if (deltaBase > 0) {
                totalGain += deltaBase;
            }
            else if (deltaBase < 0) {
                totalLoss += Math.abs(deltaBase);
            }
            resultLines.push({
                accountId: bal.accountId,
                accountName: account.name,
                accountSystemCode: account.systemCode,
                currency: bal.currency,
                foreignBalance: (0, VoucherLineEntity_1.roundMoney)(bal.foreignBalance),
                historicalBaseBalance,
                newRate,
                targetBaseBalance,
                deltaBase
            });
        }
        return {
            asOfDate,
            lines: resultLines,
            totalGain: (0, VoucherLineEntity_1.roundMoney)(totalGain),
            totalLoss: (0, VoucherLineEntity_1.roundMoney)(totalLoss),
            netDelta: (0, VoucherLineEntity_1.roundMoney)(totalGain - totalLoss)
        };
    }
}
exports.CalculateFXRevaluationUseCase = CalculateFXRevaluationUseCase;
//# sourceMappingURL=CalculateFXRevaluationUseCase.js.map