
import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';

/**
 * Interface for Exchange Rate access.
 */
export interface IExchangeRateRepository {
  setRate(rate: ExchangeRate): Promise<void>;
  getRate(fromCurrency: string, toCurrency: string, date: Date): Promise<ExchangeRate | null>;
}
