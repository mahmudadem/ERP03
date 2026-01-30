import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLineEntity, roundMoney } from '../../entities/VoucherLineEntity';

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
 */
export class PaymentVoucherStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string, baseCurrency: string): Promise<VoucherLineEntity[]> {
    const lines: VoucherLineEntity[] = [];
    
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
    
    let totalFx = 0;
    let totalBaseCalculated = 0;
    
    // 1. Generate DEBIT lines for each allocation
    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const amountFx = Number(allocation.amount) || 0;
        const amountBase = roundMoney(amountFx * exchangeRate);
        
        totalFx = roundMoney(totalFx + amountFx);
        totalBaseCalculated = roundMoney(totalBaseCalculated + amountBase);
        
        if (!allocation.payToAccountId) {
            throw new Error(`Line ${i + 1}: Allocation must have payToAccountId`);
        }
        
        const lineCurrency = currency.toUpperCase();

        const debitLine = new VoucherLineEntity(
            i + 1,
            allocation.payToAccountId,
            'Debit',
            amountBase,        // baseAmount
            baseCurrency,      // baseCurrency
            amountFx,          // amount
            lineCurrency,      // currency
            exchangeRate,


            allocation.notes || allocation.description || 'Payment allocation',
            allocation.costCenterId,
            allocation.metadata || {}
        );
        lines.push(debitLine);
    }
    
    // 2. Generate single CREDIT line for source account
    // We use totalBaseCalculated (sum of rounded lines) instead of totalFx * exchangeRate
    // to ensure the voucher balances perfectly in base currency.
    const creditCurrency = currency.toUpperCase();
    
    const creditLine = new VoucherLineEntity(
        lines.length + 1,
        payFromAccountId,
        'Credit',
        totalBaseCalculated, // baseAmount (SUM OF DEBITS)
        baseCurrency,      // baseCurrency
        totalFx,           // amount
        creditCurrency,    // currency
        exchangeRate,


        header.description || 'Payment from account',
        undefined,
        {}
    );
    lines.push(creditLine);
    
    return lines;
  }
}
