import { PromotionRule } from '../../../domain/sales/entities/PromotionRule';

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
    const freeGoods: FreeGoodsSuggestion[] = [];
    const lineDiscounts: LineDiscountSuggestion[] = [];

    // Sort rules by priority ascending (stable sort in V8, so ties keep insertion order)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    // Filter to rules that are active on the evaluation date
    const activeRules = sortedRules.filter((r) => r.isActiveOn(asOfDate));

    for (const line of lines) {
      let bxgyApplied = false;    // track whether a BUY_X_GET_Y already fired for this line
      let discountApplied = false; // track whether a THRESHOLD_DISCOUNT already fired

      for (const rule of activeRules) {
        if (!rule.appliesToItem(line.itemId, line.categoryId)) continue;

        // ----- BUY_X_GET_Y -----
        if (rule.type === 'BUY_X_GET_Y' && !bxgyApplied) {
          const cfg = rule.buyXGetY!;
          if (line.qty >= cfg.buyQty) {
            const freeQty = Math.floor(line.qty / cfg.buyQty) * cfg.getQty;
            freeGoods.push({
              sourceLineId: line.lineId,
              ruleId: rule.id,
              ruleName: rule.name,
              itemId: cfg.getItemId ?? line.itemId,
              qty: freeQty,
            });
            bxgyApplied = true;
          }
        }

        // ----- THRESHOLD_DISCOUNT -----
        if (rule.type === 'THRESHOLD_DISCOUNT' && !discountApplied) {
          // Hard rule: manual discount always takes precedence
          if (line.hasManualDiscount) continue;

          const cfg = rule.thresholdDiscount!;
          const thresholdMet =
            cfg.thresholdBasis === 'QTY'
              ? line.qty >= cfg.thresholdValue
              : line.lineAmountDoc >= cfg.thresholdValue;

          if (thresholdMet) {
            lineDiscounts.push({
              lineId: line.lineId,
              ruleId: rule.id,
              ruleName: rule.name,
              discountPct: cfg.discountPct,
            });
            discountApplied = true;
          }
        }

        // Short-circuit: if both mechanics are decided we can move to the next line
        if (bxgyApplied && discountApplied) break;
      }
    }

    return { freeGoods, lineDiscounts };
  }
}
