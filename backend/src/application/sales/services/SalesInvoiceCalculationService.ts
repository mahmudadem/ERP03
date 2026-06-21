import { roundMoney } from '../../system-core/money/roundMoney';
import {
  CalculatedTaxChargeAmounts,
  CalculatedTaxLineAmounts,
} from '../../system-core/contracts/ITaxEngine';
import {
  calculateTaxChargeAmounts,
} from '../../system-core/tax/TaxEngine';
import { calculateCommercialLineAmounts } from '../../system-core/commercial/CommercialCore';
import {
  SalesDiscountType,
  SalesInvoiceCharge,
  SalesInvoiceLine,
} from '../../../domain/sales/entities/SalesInvoice';


export interface SalesInvoiceLineCalculationInput {
  invoicedQty: number;
  unitPriceDoc: number;
  exchangeRate: number;
  taxRate: number;
  /** When true, unitPriceDoc is treated as a tax-inclusive price.
   *  The service back-calculates the net (ex-tax) amount.
   *  Discounts are applied to the inclusive amount before back-calculation.
   *  Defaults to false (tax-exclusive). */
  priceIsInclusive?: boolean;
  discountType?: SalesDiscountType;
  discountValue?: number;
  discountAmountDoc?: number;
}

export interface SalesInvoiceChargeCalculationInput {
  amountDoc: number;
  exchangeRate: number;
  taxRate?: number;
  taxAmountDoc?: number;
}

export interface SalesInvoiceTotals {
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
}

export type CalculatedSalesInvoiceLineAmounts = CalculatedTaxLineAmounts;
export type CalculatedSalesInvoiceChargeAmounts = CalculatedTaxChargeAmounts;

export const calculateSalesInvoiceLineAmounts = (
  input: SalesInvoiceLineCalculationInput
): CalculatedSalesInvoiceLineAmounts => {
  return calculateCommercialLineAmounts({
    quantity: input.invoicedQty,
    unitPriceDoc: input.unitPriceDoc,
    exchangeRate: input.exchangeRate,
    taxRate: input.taxRate,
    priceIsInclusive: input.priceIsInclusive,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountAmountDoc: input.discountAmountDoc,
  });
};

export const calculateSalesInvoiceChargeAmounts = (
  input: SalesInvoiceChargeCalculationInput
): CalculatedSalesInvoiceChargeAmounts => {
  return calculateTaxChargeAmounts(input);
};

export const calculateSalesInvoiceTotals = (
  lines: Pick<SalesInvoiceLine, 'lineTotalDoc' | 'lineTotalBase' | 'taxAmountDoc' | 'taxAmountBase'>[],
  charges: Pick<SalesInvoiceCharge, 'kind' | 'amountDoc' | 'amountBase' | 'taxAmountDoc' | 'taxAmountBase'>[] = []
): SalesInvoiceTotals => {
  // A DISCOUNT-kind adjustment subtracts from the subtotal; a CHARGE adds. Discounts
  // carry no tax, so the tax reduces below are unaffected by them.
  const subtotalDoc = roundMoney(
    lines.reduce((sum, line) => sum + line.lineTotalDoc, 0)
    + charges.reduce((sum, charge) => sum + (charge.kind === 'DISCOUNT' ? -charge.amountDoc : charge.amountDoc), 0)
  );
  const taxTotalDoc = roundMoney(
    lines.reduce((sum, line) => sum + line.taxAmountDoc, 0)
    + charges.reduce((sum, charge) => sum + (charge.taxAmountDoc || 0), 0)
  );
  const subtotalBase = roundMoney(
    lines.reduce((sum, line) => sum + line.lineTotalBase, 0)
    + charges.reduce((sum, charge) => sum + (charge.kind === 'DISCOUNT' ? -(charge.amountBase || 0) : (charge.amountBase || 0)), 0)
  );
  const taxTotalBase = roundMoney(
    lines.reduce((sum, line) => sum + line.taxAmountBase, 0)
    + charges.reduce((sum, charge) => sum + (charge.taxAmountBase || 0), 0)
  );

  return {
    subtotalDoc,
    taxTotalDoc,
    grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc),
    subtotalBase,
    taxTotalBase,
    grandTotalBase: roundMoney(subtotalBase + taxTotalBase),
  };
};
