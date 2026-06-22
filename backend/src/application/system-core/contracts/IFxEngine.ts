import { ExchangeRate } from '../../../domain/core/entities/ExchangeRate';
import { RateDeviationWarning, SaveReferenceRateInput } from '../../core/services/ExchangeRateService';

export type { RateDeviationWarning, SaveReferenceRateInput };

export type FxRateSource = 'EXACT_DATE' | 'MOST_RECENT' | 'INVERSE' | 'NONE';

export interface FxRateResolution {
  rate: ExchangeRate | null;
  source: FxRateSource;
}

/**
 * IFxEngine — the single sanctioned shared seam for currency / FX (Task 255, engines-vs-modules
 * rule). Rate resolution and deviation detection are cross-cutting truth any module needs
 * (settlement, FX revaluation, multi-currency posting), so they belong to one always-on engine
 * rather than being re-derived per module.
 *
 * The implementation (LegacyFxAdapter) wraps the already-centralized `application/core` exchange
 * rate logic — behaviour-preserving. `IMoneyCore` stays a pure money/rounding engine; callers
 * resolve a rate via this engine, then hand it to `IMoneyCore.toBase`.
 */
export interface IFxEngine {
  /** Resolve a usable rate for a currency pair on a date (exact → most-recent → inverse → none). */
  resolveRate(companyId: string, fromCurrency: string, toCurrency: string, date: Date): Promise<FxRateResolution>;

  /** Advisory deviation warnings for a proposed rate (never blocks posting). */
  detectDeviations(companyId: string, fromCurrency: string, toCurrency: string, proposedRate: number): Promise<RateDeviationWarning[]>;

  /** Persist a manually entered reference rate for future resolution. */
  saveReferenceRate(input: SaveReferenceRateInput): Promise<ExchangeRate>;
}
