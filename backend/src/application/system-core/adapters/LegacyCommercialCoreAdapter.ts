import {
  calculateSalesInvoiceLineAmounts,
} from '../../sales/services/SalesInvoiceCalculationService';
import {
  DiscountCalculationContext,
  ICommercialCore,
  ResolvePriceContext,
} from '../contracts/ICommercialCore';

export type ResolvePriceDelegate = (context: ResolvePriceContext) => Promise<number | null>;

export class LegacyCommercialCoreAdapter implements ICommercialCore {
  constructor(private readonly resolvePriceDelegate?: ResolvePriceDelegate) {}

  async resolvePrice(context: ResolvePriceContext): Promise<number | null> {
    if (this.resolvePriceDelegate) return this.resolvePriceDelegate(context);
    throw new Error('CommercialCore.resolvePrice has no Phase 0 legacy delegate');
  }

  calcDiscount(context: DiscountCalculationContext): number {
    return calculateSalesInvoiceLineAmounts({
      invoicedQty: context.quantity,
      unitPriceDoc: context.unitPrice,
      exchangeRate: 1,
      taxRate: 0,
      discountType: context.discountType,
      discountValue: context.discountValue,
      discountAmountDoc: context.discountAmount,
    }).discountAmountDoc;
  }
}

