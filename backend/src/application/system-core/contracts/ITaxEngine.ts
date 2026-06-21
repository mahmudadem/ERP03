import {
  CalculatedSalesInvoiceChargeAmounts,
  CalculatedSalesInvoiceLineAmounts,
  SalesInvoiceChargeCalculationInput,
  SalesInvoiceLineCalculationInput,
} from '../../sales/services/SalesInvoiceCalculationService';

export type TaxLineInput = SalesInvoiceLineCalculationInput;
export type TaxChargeInput = SalesInvoiceChargeCalculationInput;

export interface InvoiceDiscountAllocationInput {
  lines: unknown[];
  discount: unknown;
}

export interface ITaxEngine {
  calcLine(input: TaxLineInput): CalculatedSalesInvoiceLineAmounts;
  calcCharge(input: TaxChargeInput): CalculatedSalesInvoiceChargeAmounts;
  allocateInvoiceDiscount(input: InvoiceDiscountAllocationInput): never;
  recoverable(taxCode: unknown): never;
}

