import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLine } from '../../entities/VoucherLine';
import { randomUUID } from 'crypto';

/**
 * PaymentVoucherStrategy
 * 
 * ONE-TO-MANY Structure:
 * - ONE source (payFromAccountId) - the account money comes from
 * - MANY destinations (lines with payToAccountId) - allocations to different accounts
 * 
 * Example: Pay 300 USD from Bank to multiple suppliers
 * Input:
 * {
 *   payFromAccountId: "acc_bank",
 *   currency: "USD",
 *   exchangeRate: 1,
 *   lines: [
 *     { payToAccountId: "acc_supplier_a", amount: 200, notes: "Inv#001" },
 *     { payToAccountId: "acc_supplier_b", amount: 100, notes: "Inv#002" }
 *   ]
 * }
 * 
 * Output GL Entries:
 * DR Supplier A    200
 * DR Supplier B    100
 * CR Bank          300
 */
export class PaymentVoucherStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLine[]> {
    const lines: VoucherLine[] = [];
    
    // Extract posting fields
    const payFromAccountId = header.payFromAccountId;
    const currency = header.currency || 'USD';
    const exchangeRate = Number(header.exchangeRate) || 1;
    const allocations = header.lines || [];
    
    if (!payFromAccountId) {
      throw new Error('Payment requires payFromAccountId (Pay From account)');
    }
    
    if (!allocations || allocations.length === 0) {
      throw new Error('Payment requires at least one allocation line');
    }
    
    // Calculate total from allocations
    let totalFx = 0;
    
    // Generate DEBIT lines for each allocation (destinations)
    for (const allocation of allocations) {
      const amountFx = Number(allocation.amount) || 0;
      const amountBase = amountFx / exchangeRate;
      totalFx += amountFx;
      
      if (!allocation.payToAccountId) {
        throw new Error('Each allocation must have payToAccountId (Pay To account)');
      }
      
      const debitLine = new VoucherLine(
        randomUUID(),
        '', // voucherId set later
        allocation.payToAccountId,
        allocation.notes || allocation.description || 'Payment allocation'
      );
      
      debitLine.debitFx = amountFx;
      debitLine.creditFx = 0;
      debitLine.debitBase = amountBase;
      debitLine.creditBase = 0;
      debitLine.lineCurrency = currency;
      debitLine.exchangeRate = exchangeRate;
      debitLine.fxAmount = amountFx;
      debitLine.baseAmount = amountBase;
      
      lines.push(debitLine);
    }
    
    // Generate single CREDIT line for source account
    const totalBase = totalFx / exchangeRate;
    
    const creditLine = new VoucherLine(
      randomUUID(),
      '',
      payFromAccountId,
      header.description || 'Payment from account'
    );
    
    creditLine.debitFx = 0;
    creditLine.creditFx = totalFx;
    creditLine.debitBase = 0;
    creditLine.creditBase = totalBase;
    creditLine.lineCurrency = currency;
    creditLine.exchangeRate = exchangeRate;
    creditLine.fxAmount = -totalFx;
    creditLine.baseAmount = -totalBase;
    
    lines.push(creditLine);
    
    return lines;
  }
}
