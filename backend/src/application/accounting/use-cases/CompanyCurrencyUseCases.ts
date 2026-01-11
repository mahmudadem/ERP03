import { ICompanyCurrencyRepository, CompanyCurrencyRecord } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ICurrencyRepository } from '../../../repository/interfaces/accounting/ICurrencyRepository';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting/IExchangeRateRepository';
import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';
import { v4 as uuidv4 } from 'uuid';

/**
 * List currencies enabled for a company.
 */
export class ListCompanyCurrenciesUseCase {
  constructor(private companyCurrencyRepo: ICompanyCurrencyRepository) {}

  async execute(companyId: string): Promise<CompanyCurrencyRecord[]> {
    return this.companyCurrencyRepo.findEnabledByCompany(companyId);
  }
}

/**
 * Check if a currency is enabled for a company.
 */
export class IsCurrencyEnabledUseCase {
  constructor(private companyCurrencyRepo: ICompanyCurrencyRepository) {}

  async execute(companyId: string, currencyCode: string): Promise<boolean> {
    return this.companyCurrencyRepo.isEnabled(companyId, currencyCode);
  }
}

/**
 * Enable a currency for a company.
 * 
 * IMPORTANT: An initial exchange rate MUST be provided when enabling a new currency.
 * The initial rate is stored in the ExchangeRate table (NOT in CompanyCurrency).
 */
export interface EnableCurrencyInput {
  companyId: string;
  currencyCode: string;
  baseCurrency: string;      // Company's base currency
  initialRate: number;       // Initial exchange rate (currency -> baseCurrency)
  initialRateDate: Date;     // Date for the initial rate
  userId: string;            // User enabling the currency
}

export class EnableCurrencyForCompanyUseCase {
  constructor(
    private currencyRepo: ICurrencyRepository,
    private companyCurrencyRepo: ICompanyCurrencyRepository,
    private exchangeRateRepo: IExchangeRateRepository
  ) {}

  async execute(input: EnableCurrencyInput): Promise<CompanyCurrencyRecord> {
    const { companyId, currencyCode, baseCurrency, initialRate, initialRateDate, userId } = input;

    // 1. Verify the currency exists in the system
    const currency = await this.currencyRepo.findByCode(currencyCode);
    if (!currency) {
      throw new Error(`Currency ${currencyCode} does not exist in the system`);
    }

    // 2. Validate the initial rate
    if (initialRate <= 0) {
      throw new Error('Initial exchange rate must be positive');
    }

    // 3. If enabling base currency, rate must be 1
    if (currencyCode.toUpperCase() === baseCurrency.toUpperCase()) {
      if (initialRate !== 1) {
        throw new Error('Base currency rate must be 1');
      }
    }

    // 4. Store the initial exchange rate in ExchangeRate table
    const exchangeRate = new ExchangeRate({
      id: uuidv4(),
      companyId,
      fromCurrency: currencyCode.toUpperCase(),
      toCurrency: baseCurrency.toUpperCase(),
      rate: initialRate,
      date: initialRateDate,
      source: 'REFERENCE',
      createdAt: new Date(),
      createdBy: userId,
    });
    await this.exchangeRateRepo.save(exchangeRate);

    // 5. Enable the currency for the company
    const record = await this.companyCurrencyRepo.enable(companyId, currencyCode);

    return record;
  }
}

/**
 * Disable a currency for a company.
 */
export class DisableCurrencyForCompanyUseCase {
  constructor(private companyCurrencyRepo: ICompanyCurrencyRepository) {}

  async execute(companyId: string, currencyCode: string): Promise<void> {
    await this.companyCurrencyRepo.disable(companyId, currencyCode);
  }
}
