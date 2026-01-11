/**
 * Currency Precision Helpers
 * 
 * Provides utility functions for currency-aware monetary calculations.
 * These helpers ensure correct decimal precision is applied based on currency.
 */

import { roundMoney, MONEY_DECIMALS } from './VoucherLineEntity';
import { getDecimalPlaces } from '../../../../prisma/seeds/currencySeedData';

/**
 * Round an amount according to the currency's decimal precision.
 * 
 * @param amount The amount to round
 * @param currencyCode ISO 4217 currency code
 * @returns Rounded amount
 */
export function roundByCurrency(amount: number, currencyCode: string): number {
  const decimals = getDecimalPlaces(currencyCode);
  return roundMoney(amount, decimals);
}

/**
 * Calculate base amount from FX amount and exchange rate.
 * Uses the base currency's precision for rounding.
 * 
 * @param fxAmount Amount in foreign currency
 * @param exchangeRate Rate from foreign currency to base currency
 * @param baseCurrencyCode ISO 4217 code of the base currency
 * @returns Base amount properly rounded to base currency precision
 */
export function calculateBaseAmount(
  fxAmount: number,
  exchangeRate: number,
  baseCurrencyCode: string
): number {
  const decimals = getDecimalPlaces(baseCurrencyCode);
  const rawBase = fxAmount * exchangeRate;
  return roundMoney(rawBase, decimals);
}

/**
 * Validate that an amount is properly rounded for its currency.
 * 
 * @param amount The amount to validate
 * @param currencyCode ISO 4217 currency code
 * @returns True if amount is properly rounded
 */
export function isProperlyRounded(amount: number, currencyCode: string): boolean {
  const decimals = getDecimalPlaces(currencyCode);
  const rounded = roundMoney(amount, decimals);
  return amount === rounded;
}

/**
 * Format an amount for display according to currency precision.
 * 
 * @param amount The amount to format
 * @param currencyCode ISO 4217 currency code
 * @returns Formatted string with correct decimal places
 */
export function formatByCurrency(amount: number, currencyCode: string): string {
  const decimals = getDecimalPlaces(currencyCode);
  return amount.toFixed(decimals);
}

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
export function getMoneyEpsilon(currencyCode: string): number {
  const decimals = getDecimalPlaces(currencyCode);
  return Math.pow(10, -decimals);
}

/**
 * Compare two money values for equality using currency-appropriate epsilon.
 * 
 * @param a First amount
 * @param b Second amount
 * @param currencyCode ISO 4217 currency code
 * @returns True if amounts are equal within currency precision
 */
export function moneyEqualsByCurrency(
  a: number,
  b: number,
  currencyCode: string
): boolean {
  const epsilon = getMoneyEpsilon(currencyCode);
  return Math.abs(a - b) <= epsilon;
}
