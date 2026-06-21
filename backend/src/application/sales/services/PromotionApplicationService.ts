import { PromotionRule } from '../../../domain/sales/entities/PromotionRule';
import { applyCommercialPromotions } from '../../system-core/commercial/CommercialCore';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export interface PromotionEvalLine {
  lineId: string;
  itemId: string;
  categoryId?: string;
  qty: number;
  unitPriceDoc: number;
  /** qty * unitPrice (pre-discount) */
  lineAmountDoc: number;
  /** true if the user already set a discount on this line — manual wins */
  hasManualDiscount: boolean;
}

export interface FreeGoodsSuggestion {
  /** The line that triggered the promotion */
  sourceLineId: string;
  ruleId: string;
  ruleName: string;
  /** The free item (may differ from the purchased item when getItemId is set) */
  itemId: string;
  qty: number;
}

export interface LineDiscountSuggestion {
  lineId: string;
  ruleId: string;
  ruleName: string;
  discountPct: number;
}

export interface PromotionEvaluationResult {
  freeGoods: FreeGoodsSuggestion[];
  lineDiscounts: LineDiscountSuggestion[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Pure evaluation service — no I/O. The caller is responsible for loading
 * the relevant PromotionRule objects and passing them in.
 *
 * Rules should be pre-filtered to ACTIVE status by the caller; this service
 * still re-checks `isActiveOn(asOfDate)` as a safety net.
 */
export class PromotionApplicationService {
  /**
   * Evaluate a set of order/invoice lines against the provided promotion rules.
   *
   * Evaluation contract:
   * - Rules are sorted by priority (ascending — lower number = first).
   * - BUY_X_GET_Y: at most ONE free-goods suggestion per line (first matching rule wins).
   * - THRESHOLD_DISCOUNT: at most ONE discount suggestion per line (first matching rule wins).
   *   Manual discounts take precedence — a line with hasManualDiscount=true never receives
   *   an auto discount suggestion.
   * - A line may receive both a free-goods suggestion and a discount suggestion
   *   (they are independent mechanics).
   */
  evaluate(
    lines: PromotionEvalLine[],
    rules: PromotionRule[],
    asOfDate: string
  ): PromotionEvaluationResult {
    return applyCommercialPromotions({ lines, rules, asOfDate, source: 'sales' });
  }
}
