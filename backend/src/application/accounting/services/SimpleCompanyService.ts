import { ICompanyService } from '../use-cases/SavePaymentVoucherUseCase';

/**
 * Simple Company Service
 * 
 * Provides company information needed for voucher processing.
 * This is a simplified version - production should use CompanyRepository.
 */
export class SimpleCompanyService implements ICompanyService {
  // Default base currency (for testing/demo)
  private readonly DEFAULT_BASE_CURRENCY = '';

  // In-memory storage (for testing)
  private companyCurrencies: Map<string, string> = new Map();

  /**
   * Get company's base currency
   */
  async getBaseCurrency(companyId: string): Promise<string> {
    // Return stored currency or default
    return this.companyCurrencies.get(companyId) || this.DEFAULT_BASE_CURRENCY;
  }

  /**
   * Set company's base currency (for testing)
   */
  setBaseCurrency(companyId: string, currency: string): void {
    this.companyCurrencies.set(companyId, currency);
  }

  /**
   * Reset (for testing)
   */
  reset(): void {
    this.companyCurrencies.clear();
  }
}
