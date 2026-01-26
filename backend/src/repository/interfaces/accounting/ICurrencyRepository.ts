import { Currency } from '../../../domain/accounting/entities/Currency';

/**
 * Repository interface for Currency management.
 */
export interface ICurrencyRepository {
  /**
   * Get all currencies (active and inactive)
   */
  findAll(companyId?: string): Promise<Currency[]>;

  /**
   * Get all active currencies
   */
  findActive(companyId?: string): Promise<Currency[]>;

  /**
   * Get a currency by its code
   */
  findByCode(code: string, companyId?: string): Promise<Currency | null>;

  /**
   * Create or update a currency
   */
  save(currency: Currency): Promise<void>;

  /**
   * Seed initial currencies from ISO 4217 data
   */
  seedCurrencies(currencies: Currency[]): Promise<void>;
}
