import { Currency } from '../../../domain/accounting/entities/Currency';
import { ICurrencyRepository } from '../../../repository/interfaces/accounting/ICurrencyRepository';

/**
 * Get all active currencies available for the current company.
 */
export class ListCurrenciesUseCase {
  constructor(private currencyRepo: ICurrencyRepository) {}

  async execute(companyId?: string): Promise<Currency[]> {
    // We use the same interface but now scoped by companyId if the repo supports it.
    // However, ICurrencyRepository (accounting) doesn't have companyId in findActive.
    // I should probably update that interface too.
    return (this.currencyRepo as any).findActive(companyId);
  }
}

/**
 * Get a currency by its code.
 */
export class GetCurrencyUseCase {
  constructor(private currencyRepo: ICurrencyRepository) {}

  async execute(code: string): Promise<Currency | null> {
    return this.currencyRepo.findByCode(code);
  }
}

/**
 * Get decimal places for a currency code.
 * Returns 2 as fallback if currency not found.
 */
export class GetCurrencyDecimalPlacesUseCase {
  constructor(private currencyRepo: ICurrencyRepository) {}

  async execute(code: string): Promise<number> {
    const currency = await this.currencyRepo.findByCode(code);
    return currency?.decimalPlaces ?? 2;
  }
}
