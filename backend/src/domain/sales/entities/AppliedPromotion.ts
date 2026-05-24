/**
 * Tracks which promotion rules were applied to a Sales Order or Sales Invoice.
 */
export interface AppliedPromotionInfo {
  ruleId: string;
  ruleName: string;
  type: 'BUY_X_GET_Y' | 'THRESHOLD_DISCOUNT';
  discountPct?: number;
  freeQty?: number;
  sourceLineId?: string;
  freeItemId?: string;
}