"use strict";
/**
 * Legacy Exchange Rate Use Cases
 *
 * @deprecated These use cases are being replaced by the new company-scoped
 * services in ExchangeRateService.ts. They are kept for backward compatibility
 * but should be migrated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetExchangeRateUseCase = exports.SetExchangeRateUseCase = void 0;
const ExchangeRate_1 = require("../../../domain/accounting/entities/ExchangeRate");
/**
 * @deprecated Use SaveReferenceRateUseCase instead
 */
class SetExchangeRateUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(companyId, from, to, rate, date, userId) {
        const exRate = new ExchangeRate_1.ExchangeRate({
            id: `er_${Date.now()}`,
            companyId,
            fromCurrency: from,
            toCurrency: to,
            rate,
            date,
            source: 'MANUAL',
            createdAt: new Date(),
            createdBy: userId,
        });
        await this.repo.save(exRate);
    }
}
exports.SetExchangeRateUseCase = SetExchangeRateUseCase;
/**
 * @deprecated Use GetSuggestedRateUseCase instead
 *
 * CRITICAL: This method now returns null instead of 1.0 when rate is not found.
 * Callers MUST handle the null case and prompt the user for manual entry.
 */
class GetExchangeRateUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(companyId, from, to, date) {
        // Same currency = rate of 1
        if (from.toUpperCase() === to.toUpperCase()) {
            return 1.0;
        }
        const rateEntity = await this.repo.getLatestRate(companyId, from, to, date);
        // IMPORTANT: Return null instead of silent 1.0 default
        // Caller must handle missing rates explicitly
        return rateEntity ? rateEntity.rate : null;
    }
}
exports.GetExchangeRateUseCase = GetExchangeRateUseCase;
//# sourceMappingURL=ExchangeRateUseCases.js.map