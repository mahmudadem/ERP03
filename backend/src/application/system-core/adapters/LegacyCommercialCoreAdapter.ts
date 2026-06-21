import {
  ApplyPromotionsContext,
  CommercialPromotionApplicationResult,
  DiscountCalculationContext,
  ICommercialCore,
  CommercialLineCalculationContext,
  CostMarginValidationContext,
  CostMarginValidationResult,
  ResolvePriceContext,
} from '../contracts/ICommercialCore';
import { CalculatedTaxLineAmounts } from '../contracts/ITaxEngine';
import { IApprovalEngine } from '../contracts/IApprovalEngine';
import { CommercialCore, CommercialCostResolver, CommercialPriceResolver } from '../commercial/CommercialCore';

export type ResolvePriceDelegate = CommercialPriceResolver;

export class LegacyCommercialCoreAdapter implements ICommercialCore {
  private readonly core: CommercialCore;

  constructor(
    resolvePriceDelegate?: ResolvePriceDelegate,
    resolveCostDelegate?: CommercialCostResolver,
    approvalEngine?: IApprovalEngine
  ) {
    this.core = new CommercialCore(resolvePriceDelegate, resolveCostDelegate, approvalEngine);
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

  validateCostMargin(context: CostMarginValidationContext): Promise<CostMarginValidationResult> {
    return this.core.validateCostMargin(context);
  }

  applyPromotions(context: ApplyPromotionsContext): CommercialPromotionApplicationResult {
    return this.core.applyPromotions(context);
  }
}
