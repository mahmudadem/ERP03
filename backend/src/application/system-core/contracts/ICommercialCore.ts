import { CalculatedTaxLineAmounts } from './ITaxEngine';

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

export interface ICommercialCore {
  resolvePrice(context: ResolvePriceContext): Promise<number | null>;
  calcDiscount(context: DiscountCalculationContext): number;
  calcLine(context: CommercialLineCalculationContext): CalculatedTaxLineAmounts;
}
