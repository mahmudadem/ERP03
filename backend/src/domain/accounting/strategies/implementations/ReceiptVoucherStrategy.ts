import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLine } from '../../entities/VoucherLine';
import { randomUUID } from 'crypto';

export class ReceiptVoucherStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLine[]> {
    // Expected header: { customerAccountId, cashAccountId, amount, currency, exchangeRate, description }
    
    const lines: VoucherLine[] = [];
    const amount = Number(header.amount) || 0;
    const exchangeRate = Number(header.exchangeRate) || 1;
    const baseAmount = amount * exchangeRate;

    // Line 1: Debit Cash/Bank
    const cashLine = new VoucherLine(
      randomUUID(),
      '', // voucherId will be set by UseCase
      header.cashAccountId,
      header.description || 'Receipt into Cash/Bank'
    );
    cashLine.debitFx = amount;
    cashLine.creditFx = 0;
    cashLine.debitBase = baseAmount;
    cashLine.creditBase = 0;
    cashLine.exchangeRate = exchangeRate;
    cashLine.lineCurrency = header.currency;
    lines.push(cashLine);

    // Line 2: Credit Customer (Receivable)
    const customerLine = new VoucherLine(
      randomUUID(),
      '',
      header.customerAccountId,
      header.description || 'Receipt from Customer'
    );
    customerLine.debitFx = 0;
    customerLine.creditFx = amount;
    customerLine.debitBase = 0;
    customerLine.creditBase = baseAmount;
    customerLine.exchangeRate = exchangeRate;
    customerLine.lineCurrency = header.currency;
    lines.push(customerLine);

    return lines;
  }
}
