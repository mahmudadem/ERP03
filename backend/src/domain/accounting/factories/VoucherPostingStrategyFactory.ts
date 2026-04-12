import { IVoucherPostingStrategy } from '../strategies/IVoucherPostingStrategy';
import { PaymentVoucherStrategy } from '../strategies/implementations/PaymentVoucherStrategy';
import { ReceiptVoucherStrategy } from '../strategies/implementations/ReceiptVoucherStrategy';
import { JournalEntryStrategy } from '../strategies/implementations/JournalEntryStrategy';
import { OpeningBalanceStrategy } from '../strategies/implementations/OpeningBalanceStrategy';
import { FXRevaluationStrategy } from '../strategies/implementations/FXRevaluationStrategy';
import { PurchaseInvoiceStrategy } from '../strategies/implementations/PurchaseInvoiceStrategy';
import { PurchaseReturnStrategy } from '../strategies/implementations/PurchaseReturnStrategy';
import { SalesInvoiceStrategy } from '../strategies/implementations/SalesInvoiceStrategy';
import { SalesReturnStrategy } from '../strategies/implementations/SalesReturnStrategy';

/**
 * VoucherPostingStrategyFactory
 * 
 * Maps VoucherType enum values to their corresponding posting strategies.
 * Each of the 4 canonical voucher types has exactly one strategy.
 * 
 * Contract:
 * - Input: lowercase enum value from VoucherType (e.g., 'payment', 'receipt')
 * - Output: IVoucherPostingStrategy (never null)
 * - Throws error for unknown types
 */
export class VoucherPostingStrategyFactory {
  static getStrategy(typeCode: string): IVoucherPostingStrategy {
    switch (typeCode) {
      case 'purchase_invoice':
        return new PurchaseInvoiceStrategy();
      case 'purchase_return':
        return new PurchaseReturnStrategy();
      case 'sales_invoice':
        return new SalesInvoiceStrategy();
      case 'sales_return':
        return new SalesReturnStrategy();
      case 'payment':
        return new PaymentVoucherStrategy();
      case 'receipt':
        return new ReceiptVoucherStrategy();
      case 'journal_entry':
        return new JournalEntryStrategy();
      case 'opening_balance':
        return new OpeningBalanceStrategy();
      case 'fx_revaluation':
        return new FXRevaluationStrategy();
      default:
        throw new Error(
          `Unknown voucher type: ${typeCode}. Valid types: purchase_invoice, purchase_return, sales_invoice, sales_return, payment, receipt, journal_entry, opening_balance, fx_revaluation`
        );
    }
  }
}
