import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLine } from '../../entities/VoucherLine';
import { randomUUID } from 'crypto';

/**
 * JournalEntryStrategy
 * 
 * Handles manual general ledger entries.
 * No automatic posting logic - accepts user-defined debit/credit lines.
 * Validates that entries balance (debits = credits).
 */
export class JournalEntryStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string): Promise<VoucherLine[]> {
    // Expected header: { lines: Array<{accountId, debitFx, creditFx, debitBase, creditBase, description, lineCurrency, exchangeRate}> }
    
    if (!header.lines || !Array.isArray(header.lines) || header.lines.length === 0) {
      throw new Error('Journal entry must have at least one line');
    }

    const lines: VoucherLine[] = [];
    let totalDebitBase = 0;
    let totalCreditBase = 0;

    for (const inputLine of header.lines) {
      // Validation: must have accountId
      if (!inputLine.accountId) {
        throw new Error('Account ID required for all lines');
      }

      // Validation: cannot have both debit and credit on same line
      const hasDebit = (inputLine.debitFx || 0) > 0;
      const hasCredit = (inputLine.creditFx || 0) > 0;
      
      if (hasDebit && hasCredit) {
        throw new Error('Line cannot have both debit and credit');
      }

      if (!hasDebit && !hasCredit) {
        throw new Error('Line must have either debit or credit');
      }

      // Create VoucherLine
      const line = new VoucherLine(
        randomUUID(),
        '', // voucherId will be set by UseCase
        inputLine.accountId,
        inputLine.description || ''
      );

      line.debitFx = Number(inputLine.debitFx) || 0;
      line.creditFx = Number(inputLine.creditFx) || 0;
      line.debitBase = Number(inputLine.debitBase) || 0;
      line.creditBase = Number(inputLine.creditBase) || 0;
      line.exchangeRate = Number(inputLine.exchangeRate) || 1;
      line.lineCurrency = inputLine.lineCurrency || 'USD';

      totalDebitBase += line.debitBase;
      totalCreditBase += line.creditBase;

      lines.push(line);
    }

    // Validation: debits must equal credits
    const tolerance = 0.01; // Allow minor rounding differences
    if (Math.abs(totalDebitBase - totalCreditBase) > tolerance) {
      throw new Error(
        `Debits must equal credits. Total debits: ${totalDebitBase.toFixed(2)}, Total credits: ${totalCreditBase.toFixed(2)}`
      );
    }

    return lines;
  }
}
