import { TaxCode } from '../../../domain/shared/entities/TaxCode';

export type TaxDiscountType = 'PERCENT' | 'AMOUNT';

export interface TaxLineInput {
  quantity: number;
  unitPriceDoc: number;
  exchangeRate: number;
  taxRate: number;
  priceIsInclusive?: boolean;
  discountType?: TaxDiscountType;
  discountValue?: number;
  discountAmountDoc?: number;
  currency?: string;
}

export interface CalculatedTaxLineAmounts {
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

export interface TaxChargeInput {
  amountDoc: number;
  exchangeRate: number;
  taxRate?: number;
  taxAmountDoc?: number;
  currency?: string;
}

export interface CalculatedTaxChargeAmounts {
  amountBase: number;
  taxAmountDoc: number;
  taxAmountBase: number;
}

export interface InvoiceDiscountAllocationInput {
  lines: Array<{
    lineId?: string;
    lineTotalDoc: number;
    lineTotalBase?: number;
    taxRate?: number;
    priceIsInclusive?: boolean;
    taxExempt?: boolean;
    discountable?: boolean;
    isGift?: boolean;
  }>;
  discountAmountDoc: number;
  exchangeRate: number;
  currency?: string;
}

export interface InvoiceDiscountAllocationLine {
  lineId?: string;
  allocatedDiscountDoc: number;
  allocatedDiscountBase: number;
  adjustedLineTotalDoc: number;
  adjustedLineTotalBase: number;
  adjustedTaxAmountDoc: number;
  adjustedTaxAmountBase: number;
}

export interface InvoiceDiscountAllocationResult {
  lines: InvoiceDiscountAllocationLine[];
  allocatedDiscountDoc: number;
  allocatedDiscountBase: number;
}

export interface RecoverableTaxResult {
  isRecoverable: boolean;
  recoverableRate: number;
  nonRecoverableRate: number;
}

export interface ITaxEngine {
  calcLine(input: TaxLineInput): CalculatedTaxLineAmounts;
  calcCharge(input: TaxChargeInput): CalculatedTaxChargeAmounts;
  allocateInvoiceDiscount(input: InvoiceDiscountAllocationInput): InvoiceDiscountAllocationResult;
  recoverable(taxCode: TaxCode | null | undefined | { taxType?: string; rate?: number; recoverableRate?: number; nonRecoverable?: boolean }): RecoverableTaxResult;
}
