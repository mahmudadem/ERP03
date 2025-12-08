import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLine } from '../../entities/VoucherLine';
import { randomUUID } from 'crypto';

export class TransferVoucherStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLine[]> {
    // Expected header: { fromAccountId, toAccountId, amount, currency, exchangeRate, description }
    
    const lines: VoucherLine[] = [];
    const amount = Number(header.amount) || 0;
    const exchangeRate = Number(header.exchangeRate) || 1;
    const baseAmount = amount * exchangeRate;

    // Line 1: Debit To Account (Receiving)
    const toLine = new VoucherLine(
      randomUUID(),
      '',
      header.toAccountId,
      header.description || 'Transfer In'
    );
    toLine.debitFx = amount;
    toLine.creditFx = 0;
    toLine.debitBase = baseAmount;
    toLine.creditBase = 0;
    toLine.exchangeRate = exchangeRate;
    toLine.lineCurrency = header.currency;
    lines.push(toLine);

    // Line 2: Credit From Account (Sending)
    const fromLine = new VoucherLine(
      randomUUID(),
      '',
      header.fromAccountId,
      header.description || 'Transfer Out'
    );
    fromLine.debitFx = 0;
    fromLine.creditFx = amount;
    fromLine.debitBase = 0;
    fromLine.creditBase = baseAmount;
    fromLine.exchangeRate = exchangeRate;
    fromLine.lineCurrency = header.currency;
    lines.push(fromLine);

    return lines;
  }
}
