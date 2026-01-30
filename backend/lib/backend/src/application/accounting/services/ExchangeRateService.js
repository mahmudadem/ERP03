"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveReferenceRateUseCase = exports.GetSuggestedRateUseCase = exports.DetectRateDeviationService = void 0;
const ExchangeRate_1 = require("../../../domain/accounting/entities/ExchangeRate");
/**
 * Detect rate deviations for warning purposes.
 *
 * Checks:
 * 1. Percentage-based deviation from recent average
 * 2. Decimal-shift heuristic (x10 / ÷10 patterns like 3.32 vs 33.2)
 *
 * Warnings are advisory only - they do NOT block posting.
 */
class DetectRateDeviationService {
    constructor(exchangeRateRepo) {
        this.exchangeRateRepo = exchangeRateRepo;
        this.PERCENTAGE_THRESHOLD = 0.20; // 20% deviation
        this.DECIMAL_SHIFT_TOLERANCE = 0.15; // 15% tolerance when checking for x10/÷10
    }
    async detectDeviations(companyId, fromCurrency, toCurrency, proposedRate) {
        const warnings = [];
        // Get recent rates for comparison
        const recentRates = await this.exchangeRateRepo.getRecentRates(companyId, fromCurrency, toCurrency, 10);
        console.log(`[Deviation Check] ${fromCurrency}→${toCurrency}: Proposed=${proposedRate}`);
        console.log(`[Deviation Check] Found ${recentRates.length} recent rates:`, recentRates.map(r => ({ rate: r.rate, date: r.date, createdAt: r.createdAt })));
        if (recentRates.length === 0) {
            // First rate for this pair - just inform
            warnings.push({
                type: 'FIRST_RATE',
                message: `This is the first exchange rate for ${fromCurrency}/${toCurrency}. No historical comparison available.`,
            });
            return warnings;
        }
        // Calculate average of recent rates
        const avgRate = recentRates.reduce((sum, r) => sum + r.rate, 0) / recentRates.length;
        const mostRecentRate = recentRates[0].rate;
        console.log(`[Deviation Check] Most recent rate: ${mostRecentRate}, Average: ${avgRate.toFixed(4)}`);
        // 1. Check percentage deviation from average
        const percentageDeviation = Math.abs(proposedRate - avgRate) / avgRate;
        if (percentageDeviation > this.PERCENTAGE_THRESHOLD) {
            warnings.push({
                type: 'PERCENTAGE_DEVIATION',
                message: `Rate ${proposedRate} deviates ${(percentageDeviation * 100).toFixed(1)}% from recent average (${avgRate.toFixed(4)})`,
                suggestedRate: avgRate,
                percentageDeviation: percentageDeviation,
            });
        }
        // 2. Check for decimal-shift patterns (x10 / ÷10)
        const decimalShiftWarning = this.checkDecimalShift(proposedRate, mostRecentRate);
        if (decimalShiftWarning) {
            warnings.push(decimalShiftWarning);
        }
        return warnings;
    }
    /**
     * Check if the proposed rate appears to be a decimal shift error.
     * Examples: 3.32 vs 33.2, or 33.2 vs 3.32
     */
    checkDecimalShift(proposedRate, recentRate) {
        // Check if proposed is ~10x recent
        const ratio10x = proposedRate / recentRate;
        if (Math.abs(ratio10x - 10) < this.DECIMAL_SHIFT_TOLERANCE * 10) {
            return {
                type: 'DECIMAL_SHIFT',
                message: `Rate ${proposedRate} appears to be 10x the recent rate (${recentRate}). Possible decimal error?`,
                suggestedRate: recentRate,
            };
        }
        // Check if proposed is ~0.1x recent
        if (Math.abs(ratio10x - 0.1) < this.DECIMAL_SHIFT_TOLERANCE) {
            return {
                type: 'DECIMAL_SHIFT',
                message: `Rate ${proposedRate} appears to be 1/10 of the recent rate (${recentRate}). Possible decimal error?`,
                suggestedRate: recentRate,
            };
        }
        // Check x100 / ÷100 patterns
        if (Math.abs(ratio10x - 100) < this.DECIMAL_SHIFT_TOLERANCE * 100) {
            return {
                type: 'DECIMAL_SHIFT',
                message: `Rate ${proposedRate} appears to be 100x the recent rate (${recentRate}). Possible decimal error?`,
                suggestedRate: recentRate,
            };
        }
        if (Math.abs(ratio10x - 0.01) < this.DECIMAL_SHIFT_TOLERANCE / 10) {
            return {
                type: 'DECIMAL_SHIFT',
                message: `Rate ${proposedRate} appears to be 1/100 of the recent rate (${recentRate}). Possible decimal error?`,
                suggestedRate: recentRate,
            };
        }
        return null;
    }
}
exports.DetectRateDeviationService = DetectRateDeviationService;
/**
 * Get suggested rate for a currency pair.
 * Returns null if no rate exists - caller MUST handle missing rates.
 * Does NOT return a default value of 1.0.
 */
class GetSuggestedRateUseCase {
    constructor(exchangeRateRepo) {
        this.exchangeRateRepo = exchangeRateRepo;
    }
    async execute(companyId, fromCurrency, toCurrency, date) {
        // Same currency = rate of 1
        if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
            return {
                rate: null,
                source: 'NONE',
            };
        }
        // Try exact date first
        const exactRate = await this.exchangeRateRepo.getLatestRate(companyId, fromCurrency, toCurrency, date);
        if (exactRate) {
            return { rate: exactRate, source: 'EXACT_DATE' };
        }
        // Fall back to most recent rate (on or before voucher date)
        const mostRecent = await this.exchangeRateRepo.getMostRecentRateBeforeDate(companyId, fromCurrency, toCurrency, date);
        if (mostRecent) {
            return { rate: mostRecent, source: 'MOST_RECENT' };
        }
        // Try inverse rate (e.g., if EUR→USD not found, try USD→EUR on or before date)
        const inverseRate = await this.exchangeRateRepo.getMostRecentRateBeforeDate(companyId, toCurrency, // Swap: look for USD→EUR
        fromCurrency, date);
        if (inverseRate && inverseRate.rate > 0) {
            // Calculate inverse: if USD→EUR = 0.885, then EUR→USD = 1/0.885 = 1.13
            const calculatedRate = new ExchangeRate_1.ExchangeRate({
                id: inverseRate.id + '_inverse',
                companyId: inverseRate.companyId,
                fromCurrency: fromCurrency,
                toCurrency: toCurrency,
                rate: 1 / inverseRate.rate,
                date: inverseRate.date,
                source: inverseRate.source,
                createdAt: inverseRate.createdAt,
                createdBy: inverseRate.createdBy
            });
            return { rate: calculatedRate, source: 'INVERSE' };
        }
        // No rate exists - caller must prompt user for manual entry
        return { rate: null, source: 'NONE' };
    }
}
exports.GetSuggestedRateUseCase = GetSuggestedRateUseCase;
class SaveReferenceRateUseCase {
    constructor(exchangeRateRepo) {
        this.exchangeRateRepo = exchangeRateRepo;
    }
    async execute(input) {
        const { companyId, fromCurrency, toCurrency, rate, date, userId } = input;
        if (rate <= 0) {
            throw new Error('Exchange rate must be positive');
        }
        const exchangeRate = new ExchangeRate_1.ExchangeRate({
            id: `er_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            companyId,
            fromCurrency: fromCurrency.toUpperCase(),
            toCurrency: toCurrency.toUpperCase(),
            rate,
            date,
            source: 'REFERENCE',
            createdAt: new Date(),
            createdBy: userId,
        });
        await this.exchangeRateRepo.save(exchangeRate);
        return exchangeRate;
    }
}
exports.SaveReferenceRateUseCase = SaveReferenceRateUseCase;
//# sourceMappingURL=ExchangeRateService.js.map