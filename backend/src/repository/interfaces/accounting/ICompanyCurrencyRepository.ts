/**
 * Company Currency interface - represents a currency enabled for a specific company.
 */
export interface CompanyCurrencyRecord {
  id: string;
  companyId: string;
  currencyCode: string;
  isEnabled: boolean;
  isBase?: boolean;
  enabledAt: Date;
  disabledAt?: Date | null;
}

/**
 * Repository interface for Company Currency management.
 * Handles enable/disable state per company - rate history is in IExchangeRateRepository.
 */
export interface ICompanyCurrencyRepository {
  /**
   * Get all currencies enabled for a company
   */
  findEnabledByCompany(companyId: string): Promise<CompanyCurrencyRecord[]>;

  /**
   * Get all currencies (enabled and disabled) for a company
   */
  findAllByCompany(companyId: string): Promise<CompanyCurrencyRecord[]>;

  /**
   * Check if a currency is enabled for a company
   */
  isEnabled(companyId: string, currencyCode: string): Promise<boolean>;

  /**
   * Enable a currency for a company
   * Note: Initial exchange rate must be stored via IExchangeRateRepository separately
   */
  enable(companyId: string, currencyCode: string): Promise<CompanyCurrencyRecord>;

  /**
   * Disable a currency for a company (soft delete - sets isEnabled=false)
   */
  disable(companyId: string, currencyCode: string): Promise<void>;

  /**
   * Set a currency as the base currency for the company
   */
  setBaseCurrency(companyId: string, currencyCode: string): Promise<void>;

  /**
   * Get the base currency code for a company
   */
  getBaseCurrency(companyId: string): Promise<string | null>;
}
