import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';

/**
 * Interface for Exchange Rate access.
 * 
 * Supports:
 * - Company-scoped rates
 * - Multiple rates per (company, pair, date) - NO unique constraint
 * - Historical rate lookup with suggestion logic
 */
export interface IExchangeRateRepository {
  /**
   * Save a new exchange rate record.
   * Multiple rates per (company, pair, date) are allowed.
   */
  save(rate: ExchangeRate): Promise<void>;

  /**
   * Get the latest rate for a currency pair on a specific date.
   * Returns null if no rate exists - caller must handle missing rates.
   * Does NOT return a default value.
   * 
   * @param companyId - Company ID
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param date - Effective date
   * @returns Latest rate for the date, or null if none exists
   */
  getLatestRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate | null>;

  /**
   * Get all rates for a currency pair on a specific date.
   * Returns empty array if no rates exist.
   * 
   * @param companyId - Company ID
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param date - Effective date
   * @returns All rates for the date, ordered by createdAt desc
   */
  getRatesForDate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate[]>;

  /**
   * Get recent rates for deviation detection.
   * Returns the last N rates for a currency pair.
   * 
   * @param companyId - Company ID
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param limit - Number of recent rates to fetch (default 10)
   * @returns Recent rates ordered by createdAt desc
   */
  getRecentRates(
    companyId: string,
    fromCurrency?: string,
    toCurrency?: string,
    limit?: number
  ): Promise<ExchangeRate[]>;

  /**
   * Get the most recent rate for a currency pair (regardless of date).
   * Useful for suggesting a rate when no rate exists for the specific date.
   * Returns null if no rate has ever been stored.
   */
  getMostRecentRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null>;

  // Legacy compatibility - deprecated
  /** @deprecated Use save() instead */
  setRate(rate: ExchangeRate): Promise<void>;
  /** @deprecated Use getLatestRate() instead */
  getRate(fromCurrency: string, toCurrency: string, date: Date): Promise<ExchangeRate | null>;
}
