import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLine } from '../../entities/VoucherLine';
import { randomUUID } from 'crypto';

/**
 * OpeningBalanceStrategy
 * 
 * Handles initial account balances when starting the system.
 * Establishes starting financial position.
 * Validates that total debit balances equal total credit balances.
 */
export class OpeningBalanceStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLine[]> {
    // Expected header: { balances: Array<{accountId, debitBalance, creditBalance, currency}> }
    
    if (!header.balances || !Array.isArray(header.balances) || header.balances.length === 0) {
      throw new Error('Opening balances required');
    }

    const lines: VoucherLine[] = [];
    let totalDebitBalance = 0;
    let totalCreditBalance = 0;

    for (const balance of header.balances) {
      // Validation: must have accountId
      if (!balance.accountId) {
        throw new Error('Account ID required for all balances');
      }

      // Validation: cannot have both debit and credit balance
      const hasDebit = (balance.debitBalance || 0) > 0;
      const hasCredit = (balance.creditBalance || 0) > 0;
      
      if (hasDebit && hasCredit) {
        throw new Error('Account cannot have both debit and credit balance');
      }

      if (!hasDebit && !hasCredit) {
        throw new Error('Account must have either debit or credit balance');
      }

      // Create VoucherLine
      const line = new VoucherLine(
        randomUUID(),
        '', // voucherId will be set by UseCase
        balance.accountId,
        'Opening Balance'
      );

      const debitAmount = Number(balance.debitBalance) || 0;
      const creditAmount = Number(balance.creditBalance) || 0;
      const exchangeRate = Number(balance.exchangeRate) || 1;
      const currency = balance.currency || 'USD';

      line.debitFx = debitAmount;
      line.creditFx = creditAmount;
      line.debitBase = debitAmount * exchangeRate;
      line.creditBase = creditAmount * exchangeRate;
      line.exchangeRate = exchangeRate;
      line.lineCurrency = currency;

      totalDebitBalance += line.debitBase;
      totalCreditBalance += line.creditBase;

      lines.push(line);
    }

    // Validation: total debit balances must equal total credit balances
    const tolerance = 0.01; // Allow minor rounding differences
    if (Math.abs(totalDebitBalance - totalCreditBalance) > tolerance) {
      throw new Error(
        `Total debit balances must equal total credit balances. Total debits: ${totalDebitBalance.toFixed(2)}, Total credits: ${totalCreditBalance.toFixed(2)}`
      );
    }

    return lines;
  }
}
