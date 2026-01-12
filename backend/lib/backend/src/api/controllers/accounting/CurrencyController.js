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
        var _a;
        try {
            const companyId = req.companyId;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            const baseCurrency = (company === null || company === void 0 ? void 0 : company.baseCurrency) || 'USD';
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
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            const baseCurrency = (company === null || company === void 0 ? void 0 : company.baseCurrency) || 'USD';
            const useCase = new CompanyCurrencyUseCases_1.DisableCurrencyForCompanyUseCase(bindRepositories_1.diContainer.companyCurrencyRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.voucherRepository, baseCurrency);
            await useCase.execute(companyId, code);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error disabling currency:', error);
            res.status(400).json({ error: error.message });
        }
    }
    /**
     * GET /exchange-rates/history
     * List recent exchange rates for a context (company, optionally specific pair)
     * Query: fromCurrency, toCurrency, limit
     */
    static async listRateHistory(req, res) {
        try {
            const companyId = req.companyId;
            const { fromCurrency, toCurrency, limit } = req.query;
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }
            const historyLimit = limit ? Number(limit) : 20;
            const rates = await bindRepositories_1.diContainer.exchangeRateRepository.getRecentRates(companyId, fromCurrency || undefined, // Repository handles undefined as "all pairs" if implemented, or we can filter
            toCurrency || undefined, historyLimit);
            res.json({ rates: rates.map(r => r.toJSON()) });
        }
        catch (error) {
            console.error('Error listing rate history:', error);
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /exchange-rates/matrix
     * Get latest rates for all enabled currencies
     */
    static async getLatestRatesMatrix(req, res) {
        try {
            const companyId = req.companyId;
            if (!companyId)
                return res.status(400).json({ error: 'Company ID required' });
            // 1. Get enabled codes
            const companyCurrencies = await bindRepositories_1.diContainer.companyCurrencyRepository.findEnabledByCompany(companyId);
            const enabledCodes = companyCurrencies.filter(c => c.isEnabled).map(c => c.currencyCode);
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            const baseCurrency = (company === null || company === void 0 ? void 0 : company.baseCurrency) || 'USD';
            const allCodes = Array.from(new Set([baseCurrency, ...enabledCodes]));
            // 2. Fetch recent rates (limit 200 to cover many pairs)
            const allRecent = await bindRepositories_1.diContainer.exchangeRateRepository.getRecentRates(companyId, undefined, undefined, 200);
            const matrix = {};
            // Initialize matrix
            allCodes.forEach(from => {
                matrix[from] = {};
                allCodes.forEach(to => {
                    if (from === to)
                        matrix[from][to] = 1.0;
                });
            });
            // Fill with latest stored rates
            // Since they are ordered by createdAt desc, we only take the first occurance for each pair
            allRecent.forEach(rate => {
                const from = rate.fromCurrency.toUpperCase();
                const to = rate.toCurrency.toUpperCase();
                if (allCodes.includes(from) && allCodes.includes(to)) {
                    if (matrix[from][to] === undefined) {
                        matrix[from][to] = rate.rate;
                    }
                }
            });
            // Helper function to round to specified decimal places for precision
            const roundToPrecision = (num, decimals = 8) => {
                return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
            };
            // Track which pairs have manually stored rates (from database)
            const manuallyStored = new Set();
            allRecent.forEach(rate => {
                const from = rate.fromCurrency.toUpperCase();
                const to = rate.toCurrency.toUpperCase();
                if (allCodes.includes(from) && allCodes.includes(to)) {
                    manuallyStored.add(`${from}-${to}`);
                }
            });
            // Calculate inverse rates ONLY for pairs without manually stored rates
            let inversesCalculated = 0;
            allCodes.forEach(from => {
                allCodes.forEach(to => {
                    if (from !== to && matrix[to][from] !== undefined && !manuallyStored.has(`${from}-${to}`)) {
                        // Only calculate inverse if this pair was NOT manually stored
                        const inverseRate = 1 / matrix[to][from];
                        const calculatedInverse = roundToPrecision(inverseRate, 8);
                        matrix[from][to] = calculatedInverse;
                        inversesCalculated++;
                    }
                });
            });
            res.json({ matrix, currencies: allCodes });
        }
        catch (error) {
            console.error('Error getting rates matrix:', error);
            res.status(500).json({ error: error.message });
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
        var _a;
        try {
            const companyId = req.companyId;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
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
            // IMPORTANT: Delete any existing inverse rate (toCurrency→fromCurrency) to prevent conflicts
            // This ensures that when we save EUR→TRY=55, any old TRY→EUR entries are removed
            // so the matrix will calculate TRY→EUR as 1/55 instead of using stale stored values
            try {
                const inverseRates = await bindRepositories_1.diContainer.exchangeRateRepository.getRecentRates(companyId, toCurrency.toUpperCase(), fromCurrency.toUpperCase(), 100 // Get all inverse rates
                );
                if (inverseRates.length > 0) {
                    // Delete each inverse rate
                    for (const inverseRate of inverseRates) {
                        await bindRepositories_1.diContainer.exchangeRateRepository.delete(inverseRate.id);
                    }
                }
            }
            catch (cleanupError) {
                // Continue anyway - cleanup failure is not critical
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