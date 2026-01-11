"use strict";
/**
 * CurrencyController
 *
 * API endpoints for currency and exchange rate management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const CurrencyUseCases_1 = require("../../../application/accounting/use-cases/CurrencyUseCases");
const CompanyCurrencyUseCases_1 = require("../../../application/accounting/use-cases/CompanyCurrencyUseCases");
const ExchangeRateService_1 = require("../../../application/accounting/services/ExchangeRateService");
class CurrencyController {
    /**
     * GET /currencies
     * List all active currencies in the system
     */
    static async listCurrencies(req, res) {
        try {
            const useCase = new CurrencyUseCases_1.ListCurrenciesUseCase(bindRepositories_1.diContainer.accountingCurrencyRepository);
            const currencies = await useCase.execute();
            res.json({ currencies: currencies.map(c => c.toJSON()) });
        }
        catch (error) {
            console.error('Error listing currencies:', error);
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /currencies/:code
     * Get a specific currency by code
     */
    static async getCurrency(req, res) {
        try {
            const { code } = req.params;
            const useCase = new CurrencyUseCases_1.GetCurrencyUseCase(bindRepositories_1.diContainer.accountingCurrencyRepository);
            const currency = await useCase.execute(code);
            if (!currency) {
                return res.status(404).json({ error: `Currency ${code} not found` });
            }
            res.json({ currency: currency.toJSON() });
        }
        catch (error) {
            console.error('Error getting currency:', error);
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /company/currencies
     * List currencies enabled for the current company
     */
    static async listCompanyCurrencies(req, res) {
        try {
            const companyId = req.companyId;
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            const useCase = new CompanyCurrencyUseCases_1.ListCompanyCurrenciesUseCase(bindRepositories_1.diContainer.companyCurrencyRepository);
            const companyCurrencies = await useCase.execute(companyId);
            res.json({ currencies: companyCurrencies });
        }
        catch (error) {
            console.error('Error listing company currencies:', error);
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * POST /company/currencies
     * Enable a currency for the company (requires initial rate)
     * Body: { currencyCode, initialRate, initialRateDate }
     */
    static async enableCurrency(req, res) {
        try {
            const companyId = req.companyId;
            const userId = req.uid;
            const baseCurrency = req.baseCurrency || 'USD';
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            const { currencyCode, initialRate, initialRateDate } = req.body;
            if (!currencyCode) {
                return res.status(400).json({ error: 'currencyCode is required' });
            }
            if (initialRate === undefined || initialRate <= 0) {
                return res.status(400).json({ error: 'A positive initialRate is required when enabling a currency' });
            }
            const useCase = new CompanyCurrencyUseCases_1.EnableCurrencyForCompanyUseCase(bindRepositories_1.diContainer.accountingCurrencyRepository, bindRepositories_1.diContainer.companyCurrencyRepository, bindRepositories_1.diContainer.exchangeRateRepository);
            const result = await useCase.execute({
                companyId,
                currencyCode,
                baseCurrency,
                initialRate: Number(initialRate),
                initialRateDate: initialRateDate ? new Date(initialRateDate) : new Date(),
                userId,
            });
            res.json({ success: true, companyCurrency: result });
        }
        catch (error) {
            console.error('Error enabling currency:', error);
            res.status(400).json({ error: error.message });
        }
    }
    /**
     * DELETE /company/currencies/:code
     * Disable a currency for the company
     */
    static async disableCurrency(req, res) {
        try {
            const companyId = req.companyId;
            const { code } = req.params;
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            const useCase = new CompanyCurrencyUseCases_1.DisableCurrencyForCompanyUseCase(bindRepositories_1.diContainer.companyCurrencyRepository);
            await useCase.execute(companyId, code);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error disabling currency:', error);
            res.status(400).json({ error: error.message });
        }
    }
    /**
     * GET /exchange-rates/suggested
     * Get suggested exchange rate for a currency pair
     * Query: fromCurrency, toCurrency, date
     */
    static async getSuggestedRate(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            const companyId = req.companyId;
            const { fromCurrency, toCurrency, date } = req.query;
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            if (!fromCurrency || !toCurrency) {
                return res.status(400).json({ error: 'fromCurrency and toCurrency are required' });
            }
            const useCase = new ExchangeRateService_1.GetSuggestedRateUseCase(bindRepositories_1.diContainer.exchangeRateRepository);
            const result = await useCase.execute(companyId, fromCurrency, toCurrency, date ? new Date(date) : new Date());
            // NOTE: Returns null if no rate exists - frontend must handle this
            res.json({
                rate: (_b = (_a = result.rate) === null || _a === void 0 ? void 0 : _a.rate) !== null && _b !== void 0 ? _b : null,
                source: result.source,
                rateDate: (_e = (_d = (_c = result.rate) === null || _c === void 0 ? void 0 : _c.date) === null || _d === void 0 ? void 0 : _d.toISOString()) !== null && _e !== void 0 ? _e : null,
            });
        }
        catch (error) {
            console.error('Error getting suggested rate:', error);
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * POST /exchange-rates
     * Save a reference exchange rate
     * Body: { fromCurrency, toCurrency, rate, date }
     */
    static async saveRate(req, res) {
        try {
            const companyId = req.companyId;
            const userId = req.uid;
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            const { fromCurrency, toCurrency, rate, date } = req.body;
            if (!fromCurrency || !toCurrency) {
                return res.status(400).json({ error: 'fromCurrency and toCurrency are required' });
            }
            if (rate === undefined || rate <= 0) {
                return res.status(400).json({ error: 'A positive rate is required' });
            }
            const useCase = new ExchangeRateService_1.SaveReferenceRateUseCase(bindRepositories_1.diContainer.exchangeRateRepository);
            const savedRate = await useCase.execute({
                companyId,
                fromCurrency,
                toCurrency,
                rate: Number(rate),
                date: date ? new Date(date) : new Date(),
                userId,
            });
            res.json({ success: true, exchangeRate: savedRate.toJSON() });
        }
        catch (error) {
            console.error('Error saving rate:', error);
            res.status(400).json({ error: error.message });
        }
    }
    /**
     * POST /exchange-rates/check-deviation
     * Check if a proposed rate has significant deviation from historical rates
     * Body: { fromCurrency, toCurrency, proposedRate }
     */
    static async checkRateDeviation(req, res) {
        try {
            const companyId = req.companyId;
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            const { fromCurrency, toCurrency, proposedRate } = req.body;
            if (!fromCurrency || !toCurrency || proposedRate === undefined) {
                return res.status(400).json({ error: 'fromCurrency, toCurrency, and proposedRate are required' });
            }
            const service = new ExchangeRateService_1.DetectRateDeviationService(bindRepositories_1.diContainer.exchangeRateRepository);
            const warnings = await service.detectDeviations(companyId, fromCurrency, toCurrency, Number(proposedRate));
            res.json({ warnings, hasWarnings: warnings.length > 0 });
        }
        catch (error) {
            console.error('Error checking rate deviation:', error);
            res.status(500).json({ error: error.message });
        }
    }
}
exports.CurrencyController = CurrencyController;
//# sourceMappingURL=CurrencyController.js.map