import { SalesDiscountType } from '../../../domain/sales/entities/SalesInvoice';

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
  discountType?: SalesDiscountType;
  discountValue?: number;
  discountAmount?: number;
}

export interface ICommercialCore {
  resolvePrice(context: ResolvePriceContext): Promise<number | null>;
  calcDiscount(context: DiscountCalculationContext): number;
}

