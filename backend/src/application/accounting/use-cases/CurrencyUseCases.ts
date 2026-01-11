import { Currency } from '../../../domain/accounting/entities/Currency';
import { ICurrencyRepository } from '../../../repository/interfaces/accounting/ICurrencyRepository';

/**
 * Get all active currencies available in the system.
 */
export class ListCurrenciesUseCase {
  constructor(private currencyRepo: ICurrencyRepository) {}

  async execute(): Promise<Currency[]> {
    return this.currencyRepo.findActive();
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
