import { ICompanyCurrencyRepository, CompanyCurrencyRecord } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ICurrencyRepository } from '../../../repository/interfaces/accounting/ICurrencyRepository';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting/IExchangeRateRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
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
  constructor(
    private companyCurrencyRepo: ICompanyCurrencyRepository,
    private accountRepo: IAccountRepository,
    private voucherRepo: IVoucherRepository,
    private baseCurrency: string // Company base currency
  ) {}

  async execute(companyId: string, currencyCode: string): Promise<void> {
    const upperCode = currencyCode.toUpperCase();

    // 1. Cannot disable base currency
    if (upperCode === this.baseCurrency.toUpperCase()) {
      throw new Error(`Cannot disable the company's base currency (${upperCode})`);
    }

    // 2. Check if used by any accounts
    const accountCount = await this.accountRepo.countByCurrency(companyId, upperCode);
    if (accountCount > 0) {
      throw new Error(`Cannot disable currency ${upperCode}: it is currently linked to ${accountCount} account(s) in the Chart of Accounts.`);
    }

    // 3. Check if used by any vouchers (header or lines)
    const voucherCount = await this.voucherRepo.countByCurrency(companyId, upperCode);
    if (voucherCount > 0) {
      throw new Error(`Cannot disable currency ${upperCode}: it is currently used in ${voucherCount} voucher(s).`);
    }

    // 4. If all checks pass, disable
    await this.companyCurrencyRepo.disable(companyId, upperCode);
  }
}
