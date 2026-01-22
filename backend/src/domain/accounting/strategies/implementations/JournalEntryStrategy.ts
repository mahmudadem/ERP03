import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLineEntity, roundMoney } from '../../entities/VoucherLineEntity';

/**
 * JournalEntryStrategy
 * 
 * Handles manual general ledger entries.
 * No automatic posting logic - accepts user-defined debit/credit lines.
 * Validates that entries balance (debits = credits).
 * 
 * Accepts both V2 format (side, amount, baseAmount) and legacy format (debitFx, creditFx).
 */
export class JournalEntryStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string, baseCurrency: string): Promise<VoucherLineEntity[]> {
    if (!header.lines || !Array.isArray(header.lines) || header.lines.length === 0) {
      throw new Error('Journal entry must have at least one line');
    }

    // FIX: If header currency equals base currency, ignore header exchange rate (must be 1.0)
    const headerCurrency = (header.currency || baseCurrency).toUpperCase();
    const isHeaderInBaseCurrency = headerCurrency === baseCurrency.toUpperCase();
    
    // Use 1.0 if header is in base currency, otherwise use provided rate
    const headerRate = isHeaderInBaseCurrency ? 1.0 : (Number(header.exchangeRate) || 1);
    
    // Debug logging
    console.log('[JournalEntryStrategy] Processing voucher:', {
      headerCurrency,
      baseCurrency,
      isHeaderInBaseCurrency,
      providedExchangeRate: header.exchangeRate,
      effectiveHeaderRate: headerRate,
      lineCount: header.lines.length
    });
    
    const lines: VoucherLineEntity[] = [];
    let totalDebitBase = 0;
    let totalCreditBase = 0;

    header.lines.forEach((inputLine: any, idx: number) => {
      if (!inputLine.accountId) {
        throw new Error(`Line ${idx + 1}: Account ID required`);
      }

      // Strict V2 format: side and amount are required
      if (!inputLine.side || inputLine.amount === undefined) {
        throw new Error(`Line ${idx + 1}: Missing required V2 fields: side, amount`);
      }

      const side = inputLine.side;
      const amount = Math.abs(Number(inputLine.amount) || 0);
      
      // Determine line currency (default to header currency if not specified)
      const lineCurrency = (inputLine.currency || inputLine.lineCurrency || header.currency || baseCurrency).toUpperCase();
      
      // Line parity is relative to header currency
      const lineParity = Number(inputLine.exchangeRate) || 1; // UI sends parity relative to header
      
      // Calculate absolute conversion rate to base currency
      let absoluteRate: number;
      
      if (lineCurrency === baseCurrency) {
        // Line is already in base currency, no conversion needed
        absoluteRate = 1.0;
      } else if (lineCurrency === headerCurrency) {
        // Line currency matches header, use header rate
        absoluteRate = headerRate;
      } else {
        // Line currency differs from both header and base
        // This requires: line -> header -> base conversion
        absoluteRate = roundMoney(headerRate * lineParity);
      }
      
      // Calculate baseAmount
      const baseAmount = roundMoney(amount * absoluteRate);

      // Debug logging for each line
      console.log(`[JournalEntryStrategy] Line ${idx + 1}:`, {
        side,
        amount,
        lineCurrency,
        lineParity,
        absoluteRate,
        baseAmount,
        baseCurrency
      });

      // Validate we have valid amounts
      if (amount <= 0) {
        throw new Error(`Line ${idx + 1}: Amount must be positive (got ${amount} ${lineCurrency})`);
      }
      
      if (baseAmount <= 0) {
        throw new Error(
          `Line ${idx + 1}: Base amount must be positive. ` +
          `Amount: ${amount} ${lineCurrency}, Rate: ${absoluteRate}, Base: ${baseAmount} ${baseCurrency}. ` +
          `Check exchange rates for ${lineCurrency}->${baseCurrency} conversion.`
        );
      }

      const line = new VoucherLineEntity(
        idx + 1,
        inputLine.accountId,
        side,
        baseAmount,              // baseAmount
        baseCurrency,            // baseCurrency
        amount,                  // amount
        lineCurrency,            // currency
        absoluteRate,            // rate used for conversion
        inputLine.notes || inputLine.description || undefined,
        inputLine.costCenterId,
        inputLine.metadata || {}
      );

      totalDebitBase += line.debitAmount;
      totalCreditBase += line.creditAmount;

      lines.push(line);
    });

    // Debug final totals
    console.log('[JournalEntryStrategy] Final totals:', {
      totalDebitBase,
      totalCreditBase,
      difference: totalDebitBase - totalCreditBase
    });

    // Validation: debits must equal credits
    const tolerance = 0.01;
    if (Math.abs(totalDebitBase - totalCreditBase) > tolerance) {
      throw new Error(
        `Debits must equal credits. Total debits: ${totalDebitBase.toFixed(2)}, Total credits: ${totalCreditBase.toFixed(2)}`
      );
    }

    return lines;
  }
}
