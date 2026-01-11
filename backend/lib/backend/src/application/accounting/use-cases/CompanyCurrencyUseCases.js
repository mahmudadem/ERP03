"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisableCurrencyForCompanyUseCase = exports.EnableCurrencyForCompanyUseCase = exports.IsCurrencyEnabledUseCase = exports.ListCompanyCurrenciesUseCase = void 0;
const ExchangeRate_1 = require("../../../domain/accounting/entities/ExchangeRate");
const uuid_1 = require("uuid");
/**
 * List currencies enabled for a company.
 */
class ListCompanyCurrenciesUseCase {
    constructor(companyCurrencyRepo) {
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(companyId) {
        return this.companyCurrencyRepo.findEnabledByCompany(companyId);
    }
}
exports.ListCompanyCurrenciesUseCase = ListCompanyCurrenciesUseCase;
/**
 * Check if a currency is enabled for a company.
 */
class IsCurrencyEnabledUseCase {
    constructor(companyCurrencyRepo) {
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(companyId, currencyCode) {
        return this.companyCurrencyRepo.isEnabled(companyId, currencyCode);
    }
}
exports.IsCurrencyEnabledUseCase = IsCurrencyEnabledUseCase;
class EnableCurrencyForCompanyUseCase {
    constructor(currencyRepo, companyCurrencyRepo, exchangeRateRepo) {
        this.currencyRepo = currencyRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.exchangeRateRepo = exchangeRateRepo;
    }
    async execute(input) {
        const { companyId, currencyCode, baseCurrency, initialRate, initialRateDate, userId } = input;
        // 1. Verify the currency exists in the system
        const currency = await this.currencyRepo.findByCode(currencyCode);
        if (!currency) {
            throw new Error(`Currency ${currencyCode} does not exist in the system`);
        }
        // 2. Validate the initial rate
        if (initialRate <= 0) {
            throw new Error('Initial exchange rate must be positive');
        }
        // 3. If enabling base currency, rate must be 1
        if (currencyCode.toUpperCase() === baseCurrency.toUpperCase()) {
            if (initialRate !== 1) {
                throw new Error('Base currency rate must be 1');
            }
        }
        // 4. Store the initial exchange rate in ExchangeRate table
        const exchangeRate = new ExchangeRate_1.ExchangeRate({
            id: (0, uuid_1.v4)(),
            companyId,
            fromCurrency: currencyCode.toUpperCase(),
            toCurrency: baseCurrency.toUpperCase(),
            rate: initialRate,
            date: initialRateDate,
            source: 'REFERENCE',
            createdAt: new Date(),
            createdBy: userId,
        });
        await this.exchangeRateRepo.save(exchangeRate);
        // 5. Enable the currency for the company
        const record = await this.companyCurrencyRepo.enable(companyId, currencyCode);
        return record;
    }
}
exports.EnableCurrencyForCompanyUseCase = EnableCurrencyForCompanyUseCase;
/**
 * Disable a currency for a company.
 */
class DisableCurrencyForCompanyUseCase {
    constructor(companyCurrencyRepo) {
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(companyId, currencyCode) {
        await this.companyCurrencyRepo.disable(companyId, currencyCode);
    }
}
exports.DisableCurrencyForCompanyUseCase = DisableCurrencyForCompanyUseCase;
//# sourceMappingURL=CompanyCurrencyUseCases.js.map