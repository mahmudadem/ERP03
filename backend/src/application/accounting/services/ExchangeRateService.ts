import { IExchangeRateRepository } from '../../../repository/interfaces/accounting/IExchangeRateRepository';
import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';

/**
 * Rate deviation warning result.
 * Warnings are explicit but do NOT block posting.
 */
export interface RateDeviationWarning {
  type: 'PERCENTAGE_DEVIATION' | 'DECIMAL_SHIFT' | 'FIRST_RATE';
  message: string;
  suggestedRate?: number;
  percentageDeviation?: number;
}

/**
 * Detect rate deviations for warning purposes.
 * 
 * Checks:
 * 1. Percentage-based deviation from recent average
 * 2. Decimal-shift heuristic (x10 / ÷10 patterns like 3.32 vs 33.2)
 * 
 * Warnings are advisory only - they do NOT block posting.
 */
export class DetectRateDeviationService {
  private readonly PERCENTAGE_THRESHOLD = 0.20; // 20% deviation
  private readonly DECIMAL_SHIFT_TOLERANCE = 0.15; // 15% tolerance when checking for x10/÷10

  constructor(private exchangeRateRepo: IExchangeRateRepository) {}

  async detectDeviations(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    proposedRate: number
  ): Promise<RateDeviationWarning[]> {
    const warnings: RateDeviationWarning[] = [];

    // Get recent rates for comparison
    const recentRates = await this.exchangeRateRepo.getRecentRates(
      companyId,
      fromCurrency,
      toCurrency,
      10
    );

    if (recentRates.length === 0) {
      // First rate for this pair - just inform
      warnings.push({
        type: 'FIRST_RATE',
        message: `This is the first exchange rate for ${fromCurrency}/${toCurrency}. No historical comparison available.`,
      });
      return warnings;
    }

    // Calculate average of recent rates
    const avgRate = recentRates.reduce((sum, r) => sum + r.rate, 0) / recentRates.length;
    const mostRecentRate = recentRates[0].rate;

    // 1. Check percentage deviation from average
    const percentageDeviation = Math.abs(proposedRate - avgRate) / avgRate;
    if (percentageDeviation > this.PERCENTAGE_THRESHOLD) {
      warnings.push({
        type: 'PERCENTAGE_DEVIATION',
        message: `Rate ${proposedRate} deviates ${(percentageDeviation * 100).toFixed(1)}% from recent average (${avgRate.toFixed(4)})`,
        suggestedRate: avgRate,
        percentageDeviation: percentageDeviation,
      });
    }

    // 2. Check for decimal-shift patterns (x10 / ÷10)
    const decimalShiftWarning = this.checkDecimalShift(proposedRate, mostRecentRate);
    if (decimalShiftWarning) {
      warnings.push(decimalShiftWarning);
    }

    return warnings;
  }

  /**
   * Check if the proposed rate appears to be a decimal shift error.
   * Examples: 3.32 vs 33.2, or 33.2 vs 3.32
   */
  private checkDecimalShift(
    proposedRate: number,
    recentRate: number
  ): RateDeviationWarning | null {
    // Check if proposed is ~10x recent
    const ratio10x = proposedRate / recentRate;
    if (Math.abs(ratio10x - 10) < this.DECIMAL_SHIFT_TOLERANCE * 10) {
      return {
        type: 'DECIMAL_SHIFT',
        message: `Rate ${proposedRate} appears to be 10x the recent rate (${recentRate}). Possible decimal error?`,
        suggestedRate: recentRate,
      };
    }

    // Check if proposed is ~0.1x recent
    if (Math.abs(ratio10x - 0.1) < this.DECIMAL_SHIFT_TOLERANCE) {
      return {
        type: 'DECIMAL_SHIFT',
        message: `Rate ${proposedRate} appears to be 1/10 of the recent rate (${recentRate}). Possible decimal error?`,
        suggestedRate: recentRate,
      };
    }

    // Check x100 / ÷100 patterns
    if (Math.abs(ratio10x - 100) < this.DECIMAL_SHIFT_TOLERANCE * 100) {
      return {
        type: 'DECIMAL_SHIFT',
        message: `Rate ${proposedRate} appears to be 100x the recent rate (${recentRate}). Possible decimal error?`,
        suggestedRate: recentRate,
      };
    }

    if (Math.abs(ratio10x - 0.01) < this.DECIMAL_SHIFT_TOLERANCE / 10) {
      return {
        type: 'DECIMAL_SHIFT',
        message: `Rate ${proposedRate} appears to be 1/100 of the recent rate (${recentRate}). Possible decimal error?`,
        suggestedRate: recentRate,
      };
    }

    return null;
  }
}

/**
 * Get suggested rate for a currency pair.
 * Returns null if no rate exists - caller MUST handle missing rates.
 * Does NOT return a default value of 1.0.
 */
export class GetSuggestedRateUseCase {
  constructor(private exchangeRateRepo: IExchangeRateRepository) {}

  async execute(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<{ rate: ExchangeRate | null; source: 'EXACT_DATE' | 'MOST_RECENT' | 'NONE' }> {
    // Same currency = rate of 1
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return {
        rate: null, // Caller handles same-currency case
        source: 'NONE',
      };
    }

    // Try exact date first
    const exactRate = await this.exchangeRateRepo.getLatestRate(
      companyId,
      fromCurrency,
      toCurrency,
      date
    );

    if (exactRate) {
      return { rate: exactRate, source: 'EXACT_DATE' };
    }

    // Fall back to most recent rate (from any date)
    const mostRecent = await this.exchangeRateRepo.getMostRecentRate(
      companyId,
      fromCurrency,
      toCurrency
    );

    if (mostRecent) {
      return { rate: mostRecent, source: 'MOST_RECENT' };
    }

    // No rate exists - caller must prompt user for manual entry
    return { rate: null, source: 'NONE' };
  }
}

/**
 * Save a manually entered rate as a reference for future use.
 */
export interface SaveReferenceRateInput {
  companyId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: Date;
  userId: string;
}

export class SaveReferenceRateUseCase {
  constructor(private exchangeRateRepo: IExchangeRateRepository) {}

  async execute(input: SaveReferenceRateInput): Promise<ExchangeRate> {
    const { companyId, fromCurrency, toCurrency, rate, date, userId } = input;

    if (rate <= 0) {
      throw new Error('Exchange rate must be positive');
    }

    const exchangeRate = new ExchangeRate({
      id: `er_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId,
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      rate,
      date,
      source: 'REFERENCE',
      createdAt: new Date(),
      createdBy: userId,
    });

    await this.exchangeRateRepo.save(exchangeRate);

    return exchangeRate;
  }
}
