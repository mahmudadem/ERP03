import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLineEntity } from '../../entities/VoucherLineEntity';

/**
 * OpeningBalanceStrategy
 * 
 * Handles initial account balances when starting the system.
 * Establishes starting financial position.
 * Validates that total debit balances equal total credit balances.
 */
export class OpeningBalanceStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLineEntity[]> {
    // Expected header: { balances: Array<{accountId, debitBalance, creditBalance, currency, exchangeRate}> }
    
    if (!header.balances || !Array.isArray(header.balances) || header.balances.length === 0) {
      throw new Error('Opening balances required');
    }

    const lines: VoucherLineEntity[] = [];
    let totalDebitBase = 0;
    let totalCreditBase = 0;

    header.balances.forEach((balance: any, idx: number) => {
      if (!balance.accountId) {
        throw new Error(`Line ${idx + 1}: Account ID required`);
      }

      const debitFx = Number(balance.debitBalance) || 0;
      const creditFx = Number(balance.creditBalance) || 0;
      const exchangeRate = Number(balance.exchangeRate) || 1;
      const currency = balance.currency || 'USD';
      const baseCurrency = header.baseCurrency || 'USD';

      if (debitFx > 0 && creditFx > 0) {
        throw new Error(`Line ${idx + 1}: Account cannot have both debit and credit balance`);
      }

      if (debitFx <= 0 && creditFx <= 0) {
        throw new Error(`Line ${idx + 1}: Account must have either debit or credit balance`);
      }

      const side = debitFx > 0 ? 'Debit' : 'Credit';
      const amount = debitFx > 0 ? debitFx : creditFx;
      const baseAmount = amount * exchangeRate;

      const line = new VoucherLineEntity(
        idx + 1,
        balance.accountId,
        side,
        amount,
        currency,
        baseAmount,
        baseCurrency,
        exchangeRate,
        'Opening Balance',
        balance.costCenterId,
        balance.metadata || {}
      );

      totalDebitBase += line.debitAmount;
      totalCreditBase += line.creditAmount;

      lines.push(line);
    });

    // Validation: total debit balances must equal total credit balances
    const tolerance = 0.01;
    if (Math.abs(totalDebitBase - totalCreditBase) > tolerance) {
      throw new Error(
        `Total debit balances must equal total credit balances. Total debits: ${totalDebitBase.toFixed(2)}, Total credits: ${totalCreditBase.toFixed(2)}`
      );
    }

    return lines;
  }
}
