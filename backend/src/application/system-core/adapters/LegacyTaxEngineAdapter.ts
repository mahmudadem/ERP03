import {
  calculateSalesInvoiceChargeAmounts,
  calculateSalesInvoiceLineAmounts,
} from '../../sales/services/SalesInvoiceCalculationService';
import {
  InvoiceDiscountAllocationInput,
  ITaxEngine,
  TaxChargeInput,
  TaxLineInput,
} from '../contracts/ITaxEngine';

export class LegacyTaxEngineAdapter implements ITaxEngine {
  calcLine(input: TaxLineInput) {
    return calculateSalesInvoiceLineAmounts(input);
  }

  calcCharge(input: TaxChargeInput) {
    return calculateSalesInvoiceChargeAmounts(input);
  }

  allocateInvoiceDiscount(_input: InvoiceDiscountAllocationInput): never {
    throw new Error('TaxEngine.allocateInvoiceDiscount is not implemented in the Phase 0 legacy adapter');
  }

  recoverable(_taxCode: unknown): never {
    throw new Error('TaxEngine.recoverable is not implemented in the Phase 0 legacy adapter');
  }
}

