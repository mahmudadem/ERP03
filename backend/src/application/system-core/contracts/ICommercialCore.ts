import { CalculatedTaxLineAmounts } from './ITaxEngine';
import { ApprovalEngineResult } from './IApprovalEngine';

export type CommercialDiscountType = 'PERCENT' | 'AMOUNT';

export interface ResolvePriceContext {
  companyId: string;
  itemId: string;
  partyId?: string;
  currency?: string;
  uomId?: string;
  [key: string]: unknown;
}

export interface DiscountCalculationContext {
  quantity: number;
  unitPrice: number;
  discountType?: CommercialDiscountType;
  discountValue?: number;
  discountAmount?: number;
  currency?: string;
}

export interface CommercialLineCalculationContext {
  quantity: number;
  unitPriceDoc: number;
  exchangeRate: number;
  taxRate: number;
  priceIsInclusive?: boolean;
  discountType?: CommercialDiscountType;
  discountValue?: number;
  discountAmountDoc?: number;
  currency?: string;
}

export interface CostMarginValidationContext {
  companyId: string;
  itemId: string;
  unitPriceBase: number;
  quantity?: number;
  unitCostBase?: number;
  minimumMarginPct?: number;
  actorUserId?: string;
  approvedOverride?: boolean;
  source?: string;
}

export interface CostMarginValidationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason: 'OK' | 'NO_COST' | 'BELOW_COST' | 'BELOW_MIN_MARGIN';
  unitCostBase?: number;
  marginPct?: number;
  approval?: ApprovalEngineResult;
}

export interface ICommercialCore {
  resolvePrice(context: ResolvePriceContext): Promise<number | null>;
  calcDiscount(context: DiscountCalculationContext): number;
  calcLine(context: CommercialLineCalculationContext): CalculatedTaxLineAmounts;
  validateCostMargin(context: CostMarginValidationContext): Promise<CostMarginValidationResult>;
}
