import { CalculatedTaxLineAmounts } from '../contracts/ITaxEngine';
import {
  ApplyPromotionsContext,
  CommercialBelowCostMode,
  CommercialDiscountType,
  CommercialLineCalculationContext,
  CommercialPromotionApplicationResult,
  CommercialPromotionRule,
  CostMarginValidationContext,
  CostMarginValidationResult,
  DiscountCalculationContext,
  ICommercialCore,
  ResolvePriceContext,
} from '../contracts/ICommercialCore';
import { IApprovalEngine } from '../contracts/IApprovalEngine';
import { roundMoney } from '../money/roundMoney';
import { calculateTaxLineAmounts } from '../tax/TaxEngine';

const numeric = (value: unknown, fallback = 0): number => {
  const resolved = Number(value);
  return Number.isNaN(resolved) ? fallback : resolved;
};

/**
 * FUP-1 PRODUCTION GATE — promotions / free-goods are HARD-DISABLED in the
 * production Sales and POS posting paths until the full stacking/cap model lands
 * (maxDiscountAmount/Percent, exclusivePromotion, canStackWith,
 * appliesBeforeTax/After, best-selection, promoted-return handling).
 *
 * The pure evaluator `applyCommercialPromotions` below is intentionally left
 * callable so unit tests and the future stacking/cap work can exercise it; this
 * gate governs ONLY whether production posting code is allowed to APPLY its
 * output. It is the single chokepoint for both apps (POS
 * `PostPosSaleUseCase.applyPromotions` and Sales `CreateSalesInvoiceUseCase`).
 *
 * Default OFF. Flip ON only when the stacking/cap model is implemented and
 * audited — either by setting `ERP_PROMOTIONS_ENABLED=true` or by removing this
 * gate entirely. Tests force the gate via `__setPromotionsEnabledForTest`.
 */
let promotionsEnabledOverride: boolean | null = null;

export const arePromotionsEnabledInProduction = (): boolean => {
  if (promotionsEnabledOverride !== null) return promotionsEnabledOverride;
  return process.env.ERP_PROMOTIONS_ENABLED === 'true';
};

/** Test-only: force the FUP-1 gate on/off. Pass `null` to reset to env-driven default. */
export const __setPromotionsEnabledForTest = (value: boolean | null): void => {
  promotionsEnabledOverride = value;
};

export type CommercialPriceResolver = (context: ResolvePriceContext) => Promise<number | null>;
export type CommercialCostResolver = (context: CostMarginValidationContext) => Promise<number | null>;

/** Resolved shared SellingPolicy snapshot for a company (below-cost rule). */
export interface CommercialSellingPolicySnapshot {
  belowCostMode?: CommercialBelowCostMode;
  minMarginPercent?: number;
  allowManagerOverride?: boolean;
}
export type CommercialSellingPolicyResolver = (
  companyId: string
) => Promise<CommercialSellingPolicySnapshot | null>;

/**
 * FUP-2: canonical line trade-discount resolver. Given an already-computed gross
 * line total, returns the discount amount with the standard clamp rules
 * (explicit ≤ gross; PERCENT of gross; AMOUNT ≤ gross). This is the single
 * implementation that SI/SO/SR/PI/PO/PR all delegate to so the discount decision
 * lives in one place. `currency` defaults to 'USD' (2-decimal) to match the
 * historical document-entity rounding exactly.
 */
export const resolveLineDiscountAmount = (
  grossLineTotalDoc: number,
  options: {
    discountType?: CommercialDiscountType;
    discountValue?: number;
    explicitDiscountAmount?: number;
    currency?: string;
  }
): number => {
  const currency = options.currency || 'USD';
  const explicit = options.explicitDiscountAmount;
  if (explicit !== undefined && !Number.isNaN(explicit)) {
    return roundMoney(Math.max(0, Math.min(explicit, grossLineTotalDoc)), currency);
  }
  if (options.discountType === 'PERCENT') {
    return roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (numeric(options.discountValue) / 100))), currency);
  }
  if (options.discountType === 'AMOUNT') {
    return roundMoney(Math.max(0, Math.min(numeric(options.discountValue), grossLineTotalDoc)), currency);
  }
  return 0;
};

export const calculateCommercialDiscountAmount = (context: DiscountCalculationContext): number => {
  const currency = context.currency || 'USD';
  const gross = roundMoney(numeric(context.quantity) * numeric(context.unitPrice), currency);
  return resolveLineDiscountAmount(gross, {
    discountType: context.discountType,
    discountValue: numeric(context.discountValue),
    explicitDiscountAmount: context.discountAmount !== undefined ? numeric(context.discountAmount) : undefined,
    currency,
  });
};

export const calculateCommercialLineAmounts = (
  context: CommercialLineCalculationContext
): CalculatedTaxLineAmounts => {
  const discountAmountDoc = calculateCommercialDiscountAmount({
    quantity: context.quantity,
    unitPrice: context.unitPriceDoc,
    discountType: context.discountType,
    discountValue: context.discountValue,
    discountAmount: context.discountAmountDoc,
    currency: context.currency,
  });

  return calculateTaxLineAmounts({
    quantity: context.quantity,
    unitPriceDoc: context.unitPriceDoc,
    exchangeRate: context.exchangeRate,
    taxRate: context.taxRate,
    priceIsInclusive: context.priceIsInclusive,
    discountAmountDoc,
    currency: context.currency,
  });
};

const isPromotionActiveOn = (rule: CommercialPromotionRule, date: string): boolean => {
  if (rule.status !== 'ACTIVE') return false;
  if (rule.validFrom && date < rule.validFrom) return false;
  if (rule.validTo && date > rule.validTo) return false;
  return true;
};

const promotionAppliesToItem = (rule: CommercialPromotionRule, itemId: string, categoryId?: string): boolean => {
  if (rule.scope === 'ALL') return true;
  if (rule.scope === 'ITEMS') return (rule.itemIds || []).includes(itemId);
  if (rule.scope === 'CATEGORIES') return categoryId != null && (rule.categoryIds || []).includes(categoryId);
  return false;
};

export const applyCommercialPromotions = (
  context: ApplyPromotionsContext
): CommercialPromotionApplicationResult => {
  const freeGoods: CommercialPromotionApplicationResult['freeGoods'] = [];
  const lineDiscounts: CommercialPromotionApplicationResult['lineDiscounts'] = [];
  const activeRules = [...context.rules]
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .filter((rule) => isPromotionActiveOn(rule, context.asOfDate));

  for (const line of context.lines) {
    let bxgyApplied = false;
    let discountApplied = false;

    for (const rule of activeRules) {
      if (!promotionAppliesToItem(rule, line.itemId, line.categoryId)) continue;

      if (rule.type === 'BUY_X_GET_Y' && !bxgyApplied && rule.buyXGetY) {
        if (line.qty >= rule.buyXGetY.buyQty) {
          freeGoods.push({
            sourceLineId: line.lineId,
            ruleId: rule.id,
            ruleName: rule.name,
            itemId: rule.buyXGetY.getItemId ?? line.itemId,
            qty: Math.floor(line.qty / rule.buyXGetY.buyQty) * rule.buyXGetY.getQty,
          });
          bxgyApplied = true;
        }
      }

      if (rule.type === 'THRESHOLD_DISCOUNT' && !discountApplied && rule.thresholdDiscount) {
        if (line.hasManualDiscount) continue;
        const thresholdMet = rule.thresholdDiscount.thresholdBasis === 'QTY'
          ? line.qty >= rule.thresholdDiscount.thresholdValue
          : line.lineAmountDoc >= rule.thresholdDiscount.thresholdValue;
        if (thresholdMet) {
          lineDiscounts.push({
            lineId: line.lineId,
            ruleId: rule.id,
            ruleName: rule.name,
            discountPct: rule.thresholdDiscount.discountPct,
          });
          discountApplied = true;
        }
      }

      if (bxgyApplied && discountApplied) break;
    }
  }

  return { freeGoods, lineDiscounts };
};

export class CommercialCore implements ICommercialCore {
  constructor(
    private readonly resolvePriceDelegate?: CommercialPriceResolver,
    private readonly resolveCostDelegate?: CommercialCostResolver,
    private readonly approvalEngine?: IApprovalEngine,
    private readonly resolveSellingPolicyDelegate?: CommercialSellingPolicyResolver
  ) {}

  async resolvePrice(context: ResolvePriceContext): Promise<number | null> {
    if (!this.resolvePriceDelegate) return null;
    return this.resolvePriceDelegate(context);
  }

  calcDiscount(context: DiscountCalculationContext): number {
    return calculateCommercialDiscountAmount(context);
  }

  calcLine(context: CommercialLineCalculationContext): CalculatedTaxLineAmounts {
    return calculateCommercialLineAmounts(context);
  }

  applyPromotions(context: ApplyPromotionsContext): CommercialPromotionApplicationResult {
    return applyCommercialPromotions(context);
  }

  async validateCostMargin(context: CostMarginValidationContext): Promise<CostMarginValidationResult> {
    const unitPriceBase = numeric(context.unitPriceBase);
    const resolvedCost = context.unitCostBase !== undefined
      ? numeric(context.unitCostBase)
      : numeric(await this.resolveCostDelegate?.(context), Number.NaN);

    if (!(resolvedCost > 0)) {
      return { allowed: true, requiresApproval: false, reason: 'NO_COST' };
    }

    // Resolve the shared SellingPolicy (company-wide), unless the caller pinned
    // values explicitly in the context. Default mode preserves the protective
    // pre-policy behaviour (below-cost requires approval).
    const policy = await this.resolveSellingPolicy(context);
    const mode: CommercialBelowCostMode = policy.belowCostMode;
    const minimumMarginPct = context.minimumMarginPct ?? policy.minMarginPercent;
    const allowManagerOverride = policy.allowManagerOverride !== false;

    const marginPct = unitPriceBase === 0
      ? -100
      : roundMoney(((unitPriceBase - resolvedCost) / unitPriceBase) * 100);
    const belowCost = unitPriceBase < resolvedCost;
    const belowMinimum = minimumMarginPct !== undefined && marginPct < numeric(minimumMarginPct);
    if (!belowCost && !belowMinimum) {
      return {
        allowed: true,
        requiresApproval: false,
        reason: 'OK',
        unitCostBase: resolvedCost,
        marginPct,
      };
    }

    const reason = belowCost ? 'BELOW_COST' : 'BELOW_MIN_MARGIN';

    // ALLOW: cost/margin is never enforced.
    if (mode === 'ALLOW') {
      return { allowed: true, requiresApproval: false, reason, unitCostBase: resolvedCost, marginPct };
    }

    // An approved manager override clears the violation, unless the policy makes
    // the control absolute (allowManagerOverride === false).
    if (context.approvedOverride === true && allowManagerOverride) {
      return {
        allowed: true,
        requiresApproval: false,
        reason,
        unitCostBase: resolvedCost,
        marginPct,
      };
    }

    // BLOCK: hard refusal — do not route to the approval engine.
    if (mode === 'BLOCK') {
      return { allowed: false, requiresApproval: false, reason, unitCostBase: resolvedCost, marginPct };
    }

    // REQUIRE_APPROVAL (default): route through the Approval Engine.
    const approval = await this.approvalEngine?.evaluate({
      type: 'below_cost_sale',
      id: `${context.source || 'commercial'}:${context.itemId}`,
      payload: {
        requiresApproval: true,
        itemId: context.itemId,
        unitPriceBase,
        unitCostBase: resolvedCost,
        marginPct,
        reason,
      },
    }, {
      companyId: context.companyId,
      actorUserId: context.actorUserId,
      source: context.source,
    });

    const allowed = approval?.decision === 'APPROVED';
    return {
      allowed,
      requiresApproval: !allowed,
      reason,
      unitCostBase: resolvedCost,
      marginPct,
      approval,
    };
  }

  /**
   * Resolve the effective below-cost rule: explicit context values win, then the
   * shared company SellingPolicy (via delegate), then the protective default.
   */
  private async resolveSellingPolicy(
    context: CostMarginValidationContext
  ): Promise<{ belowCostMode: CommercialBelowCostMode; minMarginPercent?: number; allowManagerOverride?: boolean }> {
    let belowCostMode = context.belowCostMode;
    let minMarginPercent = context.minimumMarginPct;
    let allowManagerOverride = context.allowManagerOverride;

    const needsPolicy = belowCostMode === undefined || allowManagerOverride === undefined || minMarginPercent === undefined;
    if (needsPolicy && this.resolveSellingPolicyDelegate && context.companyId) {
      const snapshot = await this.resolveSellingPolicyDelegate(context.companyId);
      if (snapshot) {
        belowCostMode = belowCostMode ?? snapshot.belowCostMode;
        minMarginPercent = minMarginPercent ?? snapshot.minMarginPercent;
        allowManagerOverride = allowManagerOverride ?? snapshot.allowManagerOverride;
      }
    }

    return {
      belowCostMode: belowCostMode ?? 'REQUIRE_APPROVAL',
      minMarginPercent,
      allowManagerOverride,
    };
  }
}
