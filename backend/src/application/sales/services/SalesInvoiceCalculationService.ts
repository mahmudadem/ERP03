import {
  SalesDiscountType,
  SalesInvoiceCharge,
  SalesInvoiceLine,
} from '../../../domain/sales/entities/SalesInvoice';

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

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

export interface CalculatedSalesInvoiceLineAmounts {
  grossLineTotalDoc: number;
  discountAmountDoc: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  grossLineTotalBase: number;
  discountAmountBase: number;
  lineTotalBase: number;
  taxAmountDoc: number;
  taxAmountBase: number;
}

export interface CalculatedSalesInvoiceChargeAmounts {
  amountBase: number;
  taxAmountDoc: number;
  taxAmountBase: number;
}

export const calculateSalesInvoiceLineAmounts = (
  input: SalesInvoiceLineCalculationInput
): CalculatedSalesInvoiceLineAmounts => {
  const priceIsInclusive = input.priceIsInclusive === true;
  const divisor = priceIsInclusive ? 1 + input.taxRate : 1;

  // grossLineTotalDoc is the pre-discount line amount in the price's own
  // frame: inclusive when priceIsInclusive, exclusive otherwise.
  const grossLineTotalDoc = roundMoney(input.invoicedQty * input.unitPriceDoc);
  const discountValue = Number.isNaN(Number(input.discountValue)) ? 0 : Number(input.discountValue);
  const explicitDiscountAmountDoc = input.discountAmountDoc !== undefined ? Number(input.discountAmountDoc) : undefined;

  let discountAmountDoc = 0;
  if (explicitDiscountAmountDoc !== undefined && !Number.isNaN(explicitDiscountAmountDoc)) {
    discountAmountDoc = roundMoney(Math.max(0, Math.min(explicitDiscountAmountDoc, grossLineTotalDoc)));
  } else if (input.discountType === 'PERCENT') {
    discountAmountDoc = roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (discountValue / 100))));
  } else if (input.discountType === 'AMOUNT') {
    discountAmountDoc = roundMoney(Math.max(0, Math.min(discountValue, grossLineTotalDoc)));
  }

  // Post-discount amount still in the price's frame (inc or exc).
  const postDiscountDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);

  // lineTotalDoc is always the net (ex-tax) amount — the subtotal basis.
  const lineTotalDoc = roundMoney(postDiscountDoc / divisor);

  const unitPriceBase = roundMoney(input.unitPriceDoc * input.exchangeRate);
  const grossLineTotalBase = roundMoney(grossLineTotalDoc * input.exchangeRate);
  const discountAmountBase = roundMoney(discountAmountDoc * input.exchangeRate);
  const lineTotalBase = roundMoney(lineTotalDoc * input.exchangeRate);

  // taxAmountDoc: for exclusive, tax on net; for inclusive, back-calculated.
  const taxAmountDoc = priceIsInclusive
    ? roundMoney(postDiscountDoc - lineTotalDoc)
    : roundMoney(lineTotalDoc * input.taxRate);
  const taxAmountBase = roundMoney(lineTotalBase * input.taxRate);

  return {
    grossLineTotalDoc,
    discountAmountDoc,
    lineTotalDoc,
    unitPriceBase,
    grossLineTotalBase,
    discountAmountBase,
    lineTotalBase,
    taxAmountDoc,
    taxAmountBase,
  };
};

export const calculateSalesInvoiceChargeAmounts = (
  input: SalesInvoiceChargeCalculationInput
): CalculatedSalesInvoiceChargeAmounts => {
  const amountBase = roundMoney(input.amountDoc * input.exchangeRate);
  const effectiveTaxRate = Number.isNaN(Number(input.taxRate)) ? 0 : Number(input.taxRate);
  const taxAmountDoc = roundMoney(
    input.taxAmountDoc !== undefined ? Number(input.taxAmountDoc) : input.amountDoc * effectiveTaxRate
  );
  const taxAmountBase = roundMoney(amountBase * effectiveTaxRate);

  return {
    amountBase,
    taxAmountDoc,
    taxAmountBase,
  };
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
