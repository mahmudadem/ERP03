import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLine } from '../../entities/VoucherLine';
import { randomUUID } from 'crypto';

export class FxVoucherStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLine[]> {
    // Expected header: { buyAccountId, sellAccountId, buyAmount, sellAmount, buyCurrency, sellCurrency, exchangeRate, description }
    
    const lines: VoucherLine[] = [];
    const buyAmount = Number(header.buyAmount) || 0;
    const sellAmount = Number(header.sellAmount) || 0;
    
    // Note: Base amount calculation depends on which currency is base. 
    // Assuming simplified logic where exchangeRate is provided relative to base or handled by caller.
    // For this strategy, we'll assume the header provides the base equivalents or we use a simplified assumption.
    // Let's assume the header provides 'buyAmountBase' and 'sellAmountBase' or we calculate if one is base.
    
    const buyAmountBase = Number(header.buyAmountBase) || buyAmount; // Fallback
    const sellAmountBase = Number(header.sellAmountBase) || sellAmount; // Fallback

    // Line 1: Debit Buy Account (Asset/Expense)
    const buyLine = new VoucherLine(
      randomUUID(),
      '',
      header.buyAccountId,
      header.description || 'FX Buy'
    );
    buyLine.debitFx = buyAmount;
    buyLine.creditFx = 0;
    buyLine.debitBase = buyAmountBase;
    buyLine.creditBase = 0;
    buyLine.lineCurrency = header.buyCurrency;
    buyLine.exchangeRate = header.buyExchangeRate || 1;
    lines.push(buyLine);

    // Line 2: Credit Sell Account (Asset/Liability)
    const sellLine = new VoucherLine(
      randomUUID(),
      '',
      header.sellAccountId,
      header.description || 'FX Sell'
    );
    sellLine.debitFx = 0;
    sellLine.creditFx = sellAmount;
    sellLine.debitBase = 0;
    sellLine.creditBase = sellAmountBase;
    sellLine.lineCurrency = header.sellCurrency;
    sellLine.exchangeRate = header.sellExchangeRate || 1;
    lines.push(sellLine);

    return lines;
  }
}
