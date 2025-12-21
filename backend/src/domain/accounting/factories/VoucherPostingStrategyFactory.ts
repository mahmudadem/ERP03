import { IVoucherPostingStrategy } from '../strategies/IVoucherPostingStrategy';
import { PaymentVoucherStrategy } from '../strategies/implementations/PaymentVoucherStrategy';
import { ReceiptVoucherStrategy } from '../strategies/implementations/ReceiptVoucherStrategy';
import { JournalEntryStrategy } from '../strategies/implementations/JournalEntryStrategy';
import { OpeningBalanceStrategy } from '../strategies/implementations/OpeningBalanceStrategy';

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
      case 'payment':
        return new PaymentVoucherStrategy();
      case 'receipt':
        return new ReceiptVoucherStrategy();
      case 'journal_entry':
        return new JournalEntryStrategy();
      case 'opening_balance':
        return new OpeningBalanceStrategy();
      default:
        throw new Error(
          `Unknown voucher type: ${typeCode}. Valid types: payment, receipt, journal_entry, opening_balance`
        );
    }
  }
}
