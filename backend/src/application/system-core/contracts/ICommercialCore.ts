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

/**
 * Below-cost / minimum-margin enforcement mode. Sourced from the shared
 * company-level SellingPolicy unless explicitly overridden in the context.
 *  - BLOCK            — refuse the line; no override can let it through.
 *  - REQUIRE_APPROVAL — block pending a manager approval/override (default).
 *  - ALLOW            — never block on cost/margin.
 */
export type CommercialBelowCostMode = 'BLOCK' | 'REQUIRE_APPROVAL' | 'ALLOW';

export interface CostMarginValidationContext {
  companyId: string;
  itemId: string;
  unitPriceBase: number;
  quantity?: number;
  unitCostBase?: number;
  minimumMarginPct?: number;
  /**
   * Explicit mode override. When omitted, the Commercial Core resolves it from
   * the company's shared SellingPolicy (defaulting to REQUIRE_APPROVAL).
   */
  belowCostMode?: CommercialBelowCostMode;
  /** When false, an approved override cannot bypass a violation. Defaults true. */
  allowManagerOverride?: boolean;
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

export type CommercialPromotionType = 'BUY_X_GET_Y' | 'THRESHOLD_DISCOUNT';
export type CommercialPromotionScope = 'ALL' | 'ITEMS' | 'CATEGORIES';

export interface CommercialPromotionRule {
  id: string;
  name: string;
  type: CommercialPromotionType;
  status: 'ACTIVE' | 'INACTIVE';
  priority?: number;
  validFrom?: string;
  validTo?: string;
  scope: CommercialPromotionScope;
  itemIds?: string[];
  categoryIds?: string[];
  buyXGetY?: {
    buyQty: number;
    getQty: number;
    getItemId?: string;
  };
  thresholdDiscount?: {
    thresholdBasis: 'QTY' | 'AMOUNT';
    thresholdValue: number;
    discountPct: number;
  };
}

export interface CommercialPromotionLine {
  lineId: string;
  itemId: string;
  categoryId?: string;
  qty: number;
  unitPriceDoc: number;
  lineAmountDoc: number;
  hasManualDiscount: boolean;
}

export interface ApplyPromotionsContext {
  lines: CommercialPromotionLine[];
  rules: CommercialPromotionRule[];
  asOfDate: string;
  source?: 'sales' | 'pos' | 'purchases' | string;
}

export interface CommercialFreeGoodsSuggestion {
  sourceLineId: string;
  ruleId: string;
  ruleName: string;
  itemId: string;
  qty: number;
}

export interface CommercialLineDiscountSuggestion {
  lineId: string;
  ruleId: string;
  ruleName: string;
  discountPct: number;
}

export interface CommercialPromotionApplicationResult {
  freeGoods: CommercialFreeGoodsSuggestion[];
  lineDiscounts: CommercialLineDiscountSuggestion[];
}

export interface ICommercialCore {
  resolvePrice(context: ResolvePriceContext): Promise<number | null>;
  calcDiscount(context: DiscountCalculationContext): number;
  calcLine(context: CommercialLineCalculationContext): CalculatedTaxLineAmounts;
  validateCostMargin(context: CostMarginValidationContext): Promise<CostMarginValidationResult>;
  applyPromotions(context: ApplyPromotionsContext): CommercialPromotionApplicationResult;
}
