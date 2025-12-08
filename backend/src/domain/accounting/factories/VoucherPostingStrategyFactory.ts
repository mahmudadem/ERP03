import { IVoucherPostingStrategy } from '../strategies/IVoucherPostingStrategy';
import { PaymentVoucherStrategy } from '../strategies/implementations/PaymentVoucherStrategy';
import { ReceiptVoucherStrategy } from '../strategies/implementations/ReceiptVoucherStrategy';
import { FxVoucherStrategy } from '../strategies/implementations/FxVoucherStrategy';
import { TransferVoucherStrategy } from '../strategies/implementations/TransferVoucherStrategy';

export class VoucherPostingStrategyFactory {
  static getStrategy(typeCode: string): IVoucherPostingStrategy | null {
    switch (typeCode) {
      case 'PAYMENT':
        return new PaymentVoucherStrategy();
      case 'RECEIPT':
        return new ReceiptVoucherStrategy();
      case 'FX':
        return new FxVoucherStrategy();
      case 'TRANSFER':
        return new TransferVoucherStrategy();
      default:
        return null; // For manual journals or unknown types
    }
  }
}
