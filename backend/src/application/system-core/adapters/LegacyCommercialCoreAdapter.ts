import {
  DiscountCalculationContext,
  ICommercialCore,
  CommercialLineCalculationContext,
  ResolvePriceContext,
} from '../contracts/ICommercialCore';
import { CalculatedTaxLineAmounts } from '../contracts/ITaxEngine';
import { CommercialCore, CommercialPriceResolver } from '../commercial/CommercialCore';

export type ResolvePriceDelegate = CommercialPriceResolver;

export class LegacyCommercialCoreAdapter implements ICommercialCore {
  private readonly core: CommercialCore;

  constructor(resolvePriceDelegate?: ResolvePriceDelegate) {
    this.core = new CommercialCore(resolvePriceDelegate);
  }

  async resolvePrice(context: ResolvePriceContext): Promise<number | null> {
    return this.core.resolvePrice(context);
  }

  calcDiscount(context: DiscountCalculationContext): number {
    return this.core.calcDiscount(context);
  }

  calcLine(context: CommercialLineCalculationContext): CalculatedTaxLineAmounts {
    return this.core.calcLine(context);
  }
}
