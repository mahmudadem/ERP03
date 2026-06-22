import { IExchangeRateRepository } from '../../../repository/interfaces/core/IExchangeRateRepository';
import { ExchangeRate } from '../../../domain/core/entities/ExchangeRate';
import {
  GetSuggestedRateUseCase,
  DetectRateDeviationService,
  SaveReferenceRateUseCase,
  RateDeviationWarning,
  SaveReferenceRateInput,
} from '../../core/services/ExchangeRateService';
import { FxRateResolution, IFxEngine } from '../contracts/IFxEngine';

/**
 * LegacyFxAdapter — wraps the already-centralized `application/core` exchange-rate use-cases
 * behind the `IFxEngine` seam. Pure delegation: behaviour is byte-identical to the existing
 * Currency controllers' direct use of `GetSuggestedRateUseCase` / `DetectRateDeviationService` /
 * `SaveReferenceRateUseCase`. No rate, source, or warning changes.
 */
export class LegacyFxAdapter implements IFxEngine {
  private readonly getSuggestedRate: GetSuggestedRateUseCase;
  private readonly detectRateDeviation: DetectRateDeviationService;
  private readonly saveReferenceRateUseCase: SaveReferenceRateUseCase;

  constructor(private readonly exchangeRateRepo: IExchangeRateRepository) {
    this.getSuggestedRate = new GetSuggestedRateUseCase(exchangeRateRepo);
    this.detectRateDeviation = new DetectRateDeviationService(exchangeRateRepo);
    this.saveReferenceRateUseCase = new SaveReferenceRateUseCase(exchangeRateRepo);
  }

  resolveRate(companyId: string, fromCurrency: string, toCurrency: string, date: Date): Promise<FxRateResolution> {
    return this.getSuggestedRate.execute(companyId, fromCurrency, toCurrency, date);
  }

  detectDeviations(companyId: string, fromCurrency: string, toCurrency: string, proposedRate: number): Promise<RateDeviationWarning[]> {
    return this.detectRateDeviation.detectDeviations(companyId, fromCurrency, toCurrency, proposedRate);
  }

  saveReferenceRate(input: SaveReferenceRateInput): Promise<ExchangeRate> {
    return this.saveReferenceRateUseCase.execute(input);
  }
}
