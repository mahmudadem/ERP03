import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLine } from '../../entities/VoucherLine';
import { randomUUID } from 'crypto';

export class PaymentVoucherStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLine[]> {
    // Expected header: { vendorAccountId, cashAccountId, amount, currency, exchangeRate, description }
    
    const lines: VoucherLine[] = [];
    const amount = Number(header.amount) || 0;
    const exchangeRate = Number(header.exchangeRate) || 1;
    const baseAmount = amount * exchangeRate;

    // Line 1: Debit Vendor (Payable)
    const vendorLine = new VoucherLine(
      randomUUID(),
      '', // voucherId will be set by UseCase
      header.vendorAccountId,
      header.description || 'Payment to Vendor'
    );
    vendorLine.debitFx = amount;
    vendorLine.creditFx = 0;
    vendorLine.debitBase = baseAmount;
    vendorLine.creditBase = 0;
    vendorLine.exchangeRate = exchangeRate;
    vendorLine.lineCurrency = header.currency;
    lines.push(vendorLine);

    // Line 2: Credit Cash/Bank
    const cashLine = new VoucherLine(
      randomUUID(),
      '',
      header.cashAccountId,
      header.description || 'Payment from Cash/Bank'
    );
    cashLine.debitFx = 0;
    cashLine.creditFx = amount;
    cashLine.debitBase = 0;
    cashLine.creditBase = baseAmount;
    cashLine.exchangeRate = exchangeRate;
    cashLine.lineCurrency = header.currency;
    lines.push(cashLine);

    return lines;
  }
}
