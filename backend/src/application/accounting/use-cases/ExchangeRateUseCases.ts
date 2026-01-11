/**
 * Legacy Exchange Rate Use Cases
 * 
 * @deprecated These use cases are being replaced by the new company-scoped
 * services in ExchangeRateService.ts. They are kept for backward compatibility
 * but should be migrated.
 */

import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting';

/**
 * @deprecated Use SaveReferenceRateUseCase instead
 */
export class SetExchangeRateUseCase {
  constructor(private repo: IExchangeRateRepository) {}

  async execute(
    companyId: string,
    from: string,
    to: string,
    rate: number,
    date: Date,
    userId?: string
  ): Promise<void> {
    const exRate = new ExchangeRate({
      id: `er_${Date.now()}`,
      companyId,
      fromCurrency: from,
      toCurrency: to,
      rate,
      date,
      source: 'MANUAL',
      createdAt: new Date(),
      createdBy: userId,
    });
    await this.repo.save(exRate);
  }
}

/**
 * @deprecated Use GetSuggestedRateUseCase instead
 * 
 * CRITICAL: This method now returns null instead of 1.0 when rate is not found.
 * Callers MUST handle the null case and prompt the user for manual entry.
 */
export class GetExchangeRateUseCase {
  constructor(private repo: IExchangeRateRepository) {}

  async execute(
    companyId: string,
    from: string,
    to: string,
    date: Date
  ): Promise<number | null> {
    // Same currency = rate of 1
    if (from.toUpperCase() === to.toUpperCase()) {
      return 1.0;
    }

    const rateEntity = await this.repo.getLatestRate(companyId, from, to, date);
    
    // IMPORTANT: Return null instead of silent 1.0 default
    // Caller must handle missing rates explicitly
    return rateEntity ? rateEntity.rate : null;
  }
}
