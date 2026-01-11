"use strict";
/**
 * Currency Precision Helpers
 *
 * Provides utility functions for currency-aware monetary calculations.
 * These helpers ensure correct decimal precision is applied based on currency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.moneyEqualsByCurrency = exports.getMoneyEpsilon = exports.formatByCurrency = exports.isProperlyRounded = exports.calculateBaseAmount = exports.roundByCurrency = void 0;
const VoucherLineEntity_1 = require("./VoucherLineEntity");
const currencySeedData_1 = require("../../../../prisma/seeds/currencySeedData");
/**
 * Round an amount according to the currency's decimal precision.
 *
 * @param amount The amount to round
 * @param currencyCode ISO 4217 currency code
 * @returns Rounded amount
 */
function roundByCurrency(amount, currencyCode) {
    const decimals = (0, currencySeedData_1.getDecimalPlaces)(currencyCode);
    return (0, VoucherLineEntity_1.roundMoney)(amount, decimals);
}
exports.roundByCurrency = roundByCurrency;
/**
 * Calculate base amount from FX amount and exchange rate.
 * Uses the base currency's precision for rounding.
 *
 * @param fxAmount Amount in foreign currency
 * @param exchangeRate Rate from foreign currency to base currency
 * @param baseCurrencyCode ISO 4217 code of the base currency
 * @returns Base amount properly rounded to base currency precision
 */
function calculateBaseAmount(fxAmount, exchangeRate, baseCurrencyCode) {
    const decimals = (0, currencySeedData_1.getDecimalPlaces)(baseCurrencyCode);
    const rawBase = fxAmount * exchangeRate;
    return (0, VoucherLineEntity_1.roundMoney)(rawBase, decimals);
}
exports.calculateBaseAmount = calculateBaseAmount;
/**
 * Validate that an amount is properly rounded for its currency.
 *
 * @param amount The amount to validate
 * @param currencyCode ISO 4217 currency code
 * @returns True if amount is properly rounded
 */
function isProperlyRounded(amount, currencyCode) {
    const decimals = (0, currencySeedData_1.getDecimalPlaces)(currencyCode);
    const rounded = (0, VoucherLineEntity_1.roundMoney)(amount, decimals);
    return amount === rounded;
}
exports.isProperlyRounded = isProperlyRounded;
/**
 * Format an amount for display according to currency precision.
 *
 * @param amount The amount to format
 * @param currencyCode ISO 4217 currency code
 * @returns Formatted string with correct decimal places
 */
function formatByCurrency(amount, currencyCode) {
    const decimals = (0, currencySeedData_1.getDecimalPlaces)(currencyCode);
    return amount.toFixed(decimals);
}
exports.formatByCurrency = formatByCurrency;
/**
 * Get the appropriate epsilon for money comparisons for a currency.
 *
 * For currencies with 0 decimal places (JPY, KRW), epsilon should be 1.
 * For currencies with 2 decimal places, epsilon is 0.01.
 * For currencies with 3 decimal places (BHD, KWD), epsilon is 0.001.
 *
 * @param currencyCode ISO 4217 currency code
 * @returns Appropriate epsilon for comparisons
 */
function getMoneyEpsilon(currencyCode) {
    const decimals = (0, currencySeedData_1.getDecimalPlaces)(currencyCode);
    return Math.pow(10, -decimals);
}
exports.getMoneyEpsilon = getMoneyEpsilon;
/**
 * Compare two money values for equality using currency-appropriate epsilon.
 *
 * @param a First amount
 * @param b Second amount
 * @param currencyCode ISO 4217 currency code
 * @returns True if amounts are equal within currency precision
 */
function moneyEqualsByCurrency(a, b, currencyCode) {
    const epsilon = getMoneyEpsilon(currencyCode);
    return Math.abs(a - b) <= epsilon;
}
exports.moneyEqualsByCurrency = moneyEqualsByCurrency;
//# sourceMappingURL=CurrencyPrecisionHelpers.js.map