"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleExchangeRateService = void 0;
/**
 * Simple Exchange Rate Service
 *
 * Provides exchange rates for currency conversion.
 * This is a simplified version for testing/demo.
 *
 * Production version should:
 * - Store rates in database
 * - Support rate history
 * - Optically fetch from external providers (ECB, etc.)
 */
class SimpleExchangeRateService {
    constructor() {
        // In-memory rate storage (for testing)
        // Key format: "{from}{to}_{date}"
        this.rates = new Map();
    }
    /**
     * Get exchange rate for a date
     *
     * Returns 1.0 if currencies are the same.
     * Throws error if rate not found.
     */
    async getRate(fromCurrency, toCurrency, date) {
        // Same currency = rate of 1
        if (fromCurrency === toCurrency) {
            return 1.0;
        }
        // Look up rate
        const key = `${fromCurrency}${toCurrency}_${date}`;
        const rate = this.rates.get(key);
        if (rate !== undefined) {
            return rate;
        }
        // Try inverse rate (e.g., if EUR->USD not found, try USD->EUR and invert)
        const inverseKey = `${toCurrency}${fromCurrency}_${date}`;
        const inverseRate = this.rates.get(inverseKey);
        if (inverseRate !== undefined && inverseRate !== 0) {
            return 1 / inverseRate;
        }
        // Rate not found - throw error
        throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency} on ${date}`);
    }
    /**
     * Set exchange rate (for testing)
     */
    setRate(fromCurrency, toCurrency, date, rate) {
        if (rate <= 0) {
            throw new Error('Exchange rate must be positive');
        }
        const key = `${fromCurrency}${toCurrency}_${date}`;
        this.rates.set(key, rate);
    }
    /**
     * Set default rate for all dates (for testing)
     */
    setDefaultRate(fromCurrency, toCurrency, rate) {
        if (rate <= 0) {
            throw new Error('Exchange rate must be positive');
        }
        // Use wildcard date
        const key = `${fromCurrency}${toCurrency}_*`;
        this.rates.set(key, rate);
    }
    /**
     * Reset all rates (for testing)
     */
    reset() {
        this.rates.clear();
    }
}
exports.SimpleExchangeRateService = SimpleExchangeRateService;
//# sourceMappingURL=SimpleExchangeRateService.js.map