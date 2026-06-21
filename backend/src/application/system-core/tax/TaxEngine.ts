import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { roundMoney } from '../money/roundMoney';
import {
  CalculatedTaxChargeAmounts,
  CalculatedTaxLineAmounts,
  InvoiceDiscountAllocationInput,
  InvoiceDiscountAllocationResult,
  ITaxEngine,
  RecoverableTaxResult,
  TaxChargeInput,
  TaxLineInput,
} from '../contracts/ITaxEngine';

const numeric = (value: unknown, fallback = 0): number => {
  const resolved = Number(value);
  return Number.isNaN(resolved) ? fallback : resolved;
};

export const calculateTaxLineAmounts = (input: TaxLineInput): CalculatedTaxLineAmounts => {
  const currency = input.currency || 'USD';
  const quantity = numeric(input.quantity);
  const unitPriceDoc = numeric(input.unitPriceDoc);
  const exchangeRate = numeric(input.exchangeRate, 1);
  const taxRate = numeric(input.taxRate);
  const priceIsInclusive = input.priceIsInclusive === true;
  const divisor = priceIsInclusive ? 1 + taxRate : 1;

  const grossLineTotalDoc = roundMoney(quantity * unitPriceDoc, currency);
  const discountValue = numeric(input.discountValue);
  const explicitDiscountAmountDoc =
    input.discountAmountDoc !== undefined ? numeric(input.discountAmountDoc) : undefined;

  let discountAmountDoc = 0;
  if (explicitDiscountAmountDoc !== undefined && !Number.isNaN(explicitDiscountAmountDoc)) {
    discountAmountDoc = roundMoney(Math.max(0, Math.min(explicitDiscountAmountDoc, grossLineTotalDoc)), currency);
  } else if (input.discountType === 'PERCENT') {
    discountAmountDoc = roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (discountValue / 100))), currency);
  } else if (input.discountType === 'AMOUNT') {
    discountAmountDoc = roundMoney(Math.max(0, Math.min(discountValue, grossLineTotalDoc)), currency);
  }

  const postDiscountDoc = roundMoney(grossLineTotalDoc - discountAmountDoc, currency);
  const lineTotalDoc = roundMoney(postDiscountDoc / divisor, currency);

  const unitPriceBase = roundMoney(unitPriceDoc * exchangeRate, currency);
  const grossLineTotalBase = roundMoney(grossLineTotalDoc * exchangeRate, currency);
  const discountAmountBase = roundMoney(discountAmountDoc * exchangeRate, currency);
  const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate, currency);

  const taxAmountDoc = priceIsInclusive
    ? roundMoney(postDiscountDoc - lineTotalDoc, currency)
    : roundMoney(lineTotalDoc * taxRate, currency);
  const taxAmountBase = roundMoney(taxAmountDoc * exchangeRate, currency);

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

export const calculateTaxChargeAmounts = (input: TaxChargeInput): CalculatedTaxChargeAmounts => {
  const currency = input.currency || 'USD';
  const amountDoc = numeric(input.amountDoc);
  const exchangeRate = numeric(input.exchangeRate, 1);
  const amountBase = roundMoney(amountDoc * exchangeRate, currency);
  const effectiveTaxRate = numeric(input.taxRate);
  const taxAmountDoc = roundMoney(
    input.taxAmountDoc !== undefined ? numeric(input.taxAmountDoc) : amountDoc * effectiveTaxRate,
    currency,
  );
  const taxAmountBase = roundMoney(taxAmountDoc * exchangeRate, currency);

  return {
    amountBase,
    taxAmountDoc,
    taxAmountBase,
  };
};

export class TaxEngine implements ITaxEngine {
  calcLine(input: TaxLineInput): CalculatedTaxLineAmounts {
    return calculateTaxLineAmounts(input);
  }

  calcCharge(input: TaxChargeInput): CalculatedTaxChargeAmounts {
    return calculateTaxChargeAmounts(input);
  }

  allocateInvoiceDiscount(input: InvoiceDiscountAllocationInput): InvoiceDiscountAllocationResult {
    const currency = input.currency || 'USD';
    const exchangeRate = numeric(input.exchangeRate, 1);
    const discountAmountDoc = roundMoney(Math.max(0, numeric(input.discountAmountDoc)), currency);
    const eligible = input.lines.filter((line) =>
      line.discountable !== false &&
      line.isGift !== true &&
      line.taxExempt !== true &&
      numeric(line.lineTotalDoc) > 0
    );
    const basisDoc = roundMoney(eligible.reduce((sum, line) => sum + numeric(line.lineTotalDoc), 0), currency);

    if (basisDoc <= 0 || discountAmountDoc <= 0) {
      return {
        lines: input.lines.map((line) => ({
          lineId: line.lineId,
          allocatedDiscountDoc: 0,
          allocatedDiscountBase: 0,
          adjustedLineTotalDoc: roundMoney(numeric(line.lineTotalDoc), currency),
          adjustedLineTotalBase: roundMoney(numeric(line.lineTotalBase, numeric(line.lineTotalDoc) * exchangeRate), currency),
          adjustedTaxAmountDoc: 0,
          adjustedTaxAmountBase: 0,
        })),
        allocatedDiscountDoc: 0,
        allocatedDiscountBase: 0,
      };
    }

    let remainingDiscountDoc = Math.min(discountAmountDoc, basisDoc);
    const lastEligibleIndex = input.lines.reduce((last, line, index) => eligible.includes(line) ? index : last, -1);
    const lines = input.lines.map((line, index) => {
      const originalLineTotalDoc = roundMoney(numeric(line.lineTotalDoc), currency);
      const originalLineTotalBase = roundMoney(numeric(line.lineTotalBase, originalLineTotalDoc * exchangeRate), currency);
      const isEligible = eligible.includes(line);
      const allocatedDiscountDoc = isEligible
        ? (index === lastEligibleIndex
            ? roundMoney(remainingDiscountDoc, currency)
            : roundMoney(Math.min(originalLineTotalDoc, discountAmountDoc * (originalLineTotalDoc / basisDoc)), currency))
        : 0;
      if (isEligible && index !== lastEligibleIndex) {
        remainingDiscountDoc = roundMoney(remainingDiscountDoc - allocatedDiscountDoc, currency);
      }
      const allocatedDiscountBase = roundMoney(allocatedDiscountDoc * exchangeRate, currency);
      const adjustedLineTotalDoc = roundMoney(Math.max(0, originalLineTotalDoc - allocatedDiscountDoc), currency);
      const adjustedLineTotalBase = roundMoney(Math.max(0, originalLineTotalBase - allocatedDiscountBase), currency);
      const taxRate = numeric(line.taxRate);
      const adjustedTaxAmountDoc = roundMoney(adjustedLineTotalDoc * taxRate, currency);
      const adjustedTaxAmountBase = roundMoney(adjustedTaxAmountDoc * exchangeRate, currency);

      return {
        lineId: line.lineId,
        allocatedDiscountDoc,
        allocatedDiscountBase,
        adjustedLineTotalDoc,
        adjustedLineTotalBase,
        adjustedTaxAmountDoc,
        adjustedTaxAmountBase,
      };
    });

    const allocatedDiscountDoc = roundMoney(lines.reduce((sum, line) => sum + line.allocatedDiscountDoc, 0), currency);
    return {
      lines,
      allocatedDiscountDoc,
      allocatedDiscountBase: roundMoney(allocatedDiscountDoc * exchangeRate, currency),
    };
  }

  recoverable(taxCode: TaxCode | null | undefined | { taxType?: string; rate?: number; recoverableRate?: number; nonRecoverable?: boolean }): RecoverableTaxResult {
    const candidate = taxCode as { taxType?: string; rate?: number; recoverableRate?: number; nonRecoverable?: boolean } | null | undefined;
    if (!candidate || candidate.nonRecoverable === true || candidate.taxType === 'EXEMPT' || candidate.taxType === 'ZERO_RATED') {
      return { isRecoverable: false, recoverableRate: 0, nonRecoverableRate: numeric(candidate?.rate) };
    }
    const explicitRecoverableRate = candidate.recoverableRate;
    const recoverableRate = explicitRecoverableRate === undefined
      ? numeric(candidate.rate)
      : Math.max(0, Math.min(numeric(candidate.rate), numeric(explicitRecoverableRate)));
    return {
      isRecoverable: recoverableRate > 0,
      recoverableRate,
      nonRecoverableRate: roundMoney(Math.max(0, numeric(candidate.rate) - recoverableRate)),
    };
  }
}
