"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FXRevaluationController = void 0;
const CalculateFXRevaluationUseCase_1 = require("../../../application/accounting/use-cases/CalculateFXRevaluationUseCase");
const GenerateFXRevaluationVoucherUseCase_1 = require("../../../application/accounting/use-cases/GenerateFXRevaluationVoucherUseCase");
const ExchangeRateService_1 = require("../../../application/accounting/services/ExchangeRateService");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
/**
 * FXRevaluationController
 *
 * Exposes endpoints for:
 * 1. Calculating FX revaluation deltas (preview, no DB writes)
 * 2. Generating a DRAFT voucher from the calculation
 * 3. Detecting currencies requiring revaluation
 */
class FXRevaluationController {
    /**
     * POST /fx-revaluation/calculate
     * Body: { asOfDate, targetAccountIds?, exchangeRates }
     * Returns: Calculation preview with per-account deltas
     */
    static async calculate(req, res, next) {
        var _a;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const { asOfDate, targetAccountIds, exchangeRates } = req.body;
            if (!asOfDate) {
                return res.status(400).json({ success: false, error: 'asOfDate is required' });
            }
            if (!exchangeRates || Object.keys(exchangeRates).length === 0) {
                return res.status(400).json({ success: false, error: 'exchangeRates map is required' });
            }
            const useCase = new CalculateFXRevaluationUseCase_1.CalculateFXRevaluationUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute({
                companyId,
                asOfDate: new Date(asOfDate),
                targetAccountIds,
                exchangeRates
            });
            res.status(200).json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /fx-revaluation/detect-currencies
     * Body: { asOfDate, targetAccountIds? }
     * Returns: List of foreign currencies found in selected accounts
     */
    static async detectCurrencies(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const { asOfDate, targetAccountIds } = req.body;
            if (!asOfDate) {
                return res.status(400).json({ success: false, error: 'asOfDate is required' });
            }
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            if (!company) {
                return res.status(404).json({ success: false, error: 'Company not found' });
            }
            // Fetch foreign balances to detect which currencies need revaluation
            const foreignBalances = await bindRepositories_1.diContainer.ledgerRepository.getForeignBalances(companyId, new Date(asOfDate), targetAccountIds);
            const currencies = Array.from(new Set(foreignBalances.map(b => b.currency)));
            // Fetch suggested rates (latest rates from ExchangeRateRepository)
            const suggestedRates = {};
            const suggestedRateUseCase = new ExchangeRateService_1.GetSuggestedRateUseCase(bindRepositories_1.diContainer.exchangeRateRepository);
            for (const curr of currencies) {
                const result = await suggestedRateUseCase.execute(companyId, curr, company.baseCurrency, new Date(asOfDate));
                suggestedRates[curr] = ((_b = result.rate) === null || _b === void 0 ? void 0 : _b.rate) || 1.0;
            }
            res.status(200).json({
                success: true,
                data: {
                    baseCurrency: company.baseCurrency,
                    currencies,
                    suggestedRates
                }
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /fx-revaluation/generate-voucher
     * Body: { calculationResult, targetGainLossAccountId }
     * Returns: Created draft voucher info
     */
    static async generateVoucher(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { calculationResult, targetGainLossAccountId } = req.body;
            if (!calculationResult || !targetGainLossAccountId) {
                return res.status(400).json({
                    success: false,
                    error: 'calculationResult and targetGainLossAccountId are required'
                });
            }
            const useCase = new GenerateFXRevaluationVoucherUseCase_1.GenerateFXRevaluationVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute(companyId, userId, Object.assign(Object.assign({}, calculationResult), { asOfDate: new Date(calculationResult.asOfDate) }), targetGainLossAccountId);
            res.status(201).json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.FXRevaluationController = FXRevaluationController;
//# sourceMappingURL=FXRevaluationController.js.map