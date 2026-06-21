import { CalculatedTaxLineAmounts } from '../contracts/ITaxEngine';
import {
  CommercialLineCalculationContext,
  DiscountCalculationContext,
  ICommercialCore,
  ResolvePriceContext,
} from '../contracts/ICommercialCore';
import { roundMoney } from '../money/roundMoney';
import { calculateTaxLineAmounts } from '../tax/TaxEngine';

const numeric = (value: unknown, fallback = 0): number => {
  const resolved = Number(value);
  return Number.isNaN(resolved) ? fallback : resolved;
};

export type CommercialPriceResolver = (context: ResolvePriceContext) => Promise<number | null>;

export const calculateCommercialDiscountAmount = (context: DiscountCalculationContext): number => {
  const currency = context.currency || 'USD';
  const gross = roundMoney(numeric(context.quantity) * numeric(context.unitPrice), currency);
  const explicit = context.discountAmount !== undefined ? numeric(context.discountAmount) : undefined;

  if (explicit !== undefined && !Number.isNaN(explicit)) {
    return roundMoney(Math.max(0, Math.min(explicit, gross)), currency);
  }
  if (context.discountType === 'PERCENT') {
    return roundMoney(Math.max(0, Math.min(gross, gross * (numeric(context.discountValue) / 100))), currency);
  }
  if (context.discountType === 'AMOUNT') {
    return roundMoney(Math.max(0, Math.min(numeric(context.discountValue), gross)), currency);
  }
  return 0;
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

export class CommercialCore implements ICommercialCore {
  constructor(private readonly resolvePriceDelegate?: CommercialPriceResolver) {}

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
}
