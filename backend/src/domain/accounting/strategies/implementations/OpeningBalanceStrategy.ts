import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLineEntity, roundMoney } from '../../entities/VoucherLineEntity';

/**
 * OpeningBalanceStrategy
 * 
 * Handles initial account balances when starting the system.
 * Establishes starting financial position.
 * Validates that total debit balances equal total credit balances.
 */
export class OpeningBalanceStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string, baseCurrency: string): Promise<VoucherLineEntity[]> {
    // Expected header: { balances: Array<{accountId, debitBalance, creditBalance, currency, exchangeRate}> }
    
    if (!header.balances || !Array.isArray(header.balances) || header.balances.length === 0) {
      throw new Error('Opening balances required');
    }

    const lines: VoucherLineEntity[] = [];
    let totalDebitBase = 0;
    let totalCreditBase = 0;
    let totalDebitHeader = 0;
    let totalCreditHeader = 0;

    const headerRate = Number(header.exchangeRate) || 1;
    const headerCurrency = (header.currency || baseCurrency).toUpperCase();

    header.balances.forEach((balance: any, idx: number) => {
      if (!balance.accountId) {
        throw new Error(`Line ${idx + 1}: Account ID required`);
      }

      const debitFx = Number(balance.debitBalance) || 0;
      const creditFx = Number(balance.creditBalance) || 0;
      const lineParity = Number(balance.exchangeRate) || 1;
      const exchangeRate = roundMoney(headerRate * lineParity);
      const currency = (balance.currency || headerCurrency).toUpperCase();

      if (debitFx > 0 && creditFx > 0) {
        throw new Error(`Line ${idx + 1}: Account cannot have both debit and credit balance`);
      }

      if (debitFx <= 0 && creditFx <= 0) {
        throw new Error(`Line ${idx + 1}: Account must have either debit or credit balance`);
      }

      const side = debitFx > 0 ? 'Debit' : 'Credit';
      const amount = debitFx > 0 ? debitFx : creditFx;
      const baseAmount = roundMoney(amount * exchangeRate);

      // Tracking Header Totals is now handled in a dedicated loop 
      // during Penny Balancing to ensure all currency types are covered.

      const line = new VoucherLineEntity(
        idx + 1,
        balance.accountId,
        side,
        baseAmount,        // baseAmount (base currency)
        baseCurrency,      // baseCurrency
        amount,            // amount (FX currency)
        currency,          // currency
        exchangeRate,
        'Opening Balance',
        balance.costCenterId,
        balance.metadata || {}
      );

      totalDebitBase += line.debitAmount;
      totalCreditBase += line.creditAmount;

      lines.push(line);
    });

    // Track Header Totals (Convert EVERY line to header currency using parity)
    // We reset these to zero to avoid any double-counting from the previous loop.
    totalDebitHeader = 0;
    totalCreditHeader = 0;

    header.balances.forEach((balance: any) => {
      const debitFx = Number(balance.debitBalance) || 0;
      const creditFx = Number(balance.creditBalance) || 0;
      const amount = debitFx > 0 ? debitFx : creditFx;
      const lineParity = Number(balance.exchangeRate) || 1;
      const amountInHeader = roundMoney(amount * lineParity);
      
      if (debitFx > 0) totalDebitHeader = roundMoney(totalDebitHeader + amountInHeader);
      else totalCreditHeader = roundMoney(totalCreditHeader + amountInHeader);
    });

    // ========== PENNY BALANCING LOGIC ==========
    const baseTolerance = 0.01;
    const headerTolerance = 0.01;
    const pennyThreshold = 5.0;

    const baseDiff = roundMoney(totalDebitBase - totalCreditBase);
    const headerDiff = roundMoney(totalDebitHeader - totalCreditHeader);

    if (Math.abs(headerDiff) <= headerTolerance && Math.abs(baseDiff) > baseTolerance) {
      if (Math.abs(baseDiff) <= pennyThreshold) {
        const lastIndex = lines.length - 1;
        const lastLine = lines[lastIndex];
        
        let newBaseAmount = lastLine.baseAmount;
        if (lastLine.side === 'Debit') {
          newBaseAmount = roundMoney(lastLine.baseAmount - baseDiff);
        } else {
          newBaseAmount = roundMoney(lastLine.baseAmount + baseDiff);
        }

        if (newBaseAmount > 0) {
          const newAbsoluteRate = newBaseAmount / lastLine.amount;

          lines[lastIndex] = new VoucherLineEntity(
            lastLine.id,
            lastLine.accountId,
            lastLine.side,
            newBaseAmount,
            baseCurrency,
            lastLine.amount,
            lastLine.currency,
            newAbsoluteRate,
            lastLine.notes,
            lastLine.costCenterId,
            lastLine.metadata
          );

          if (lastLine.side === 'Debit') {
            totalDebitBase = roundMoney(totalDebitBase - baseDiff);
          } else {
            totalCreditBase = roundMoney(totalCreditBase + baseDiff);
          }
        }
      }
    }

    // Validation: total debit balances must equal total credit balances
    if (Math.abs(totalDebitBase - totalCreditBase) > baseTolerance) {
      throw new Error(
        `Total debit balances must equal total credit balances in base currency (${baseCurrency}). ` +
        `Total debits: ${totalDebitBase.toFixed(2)}, Total credits: ${totalCreditBase.toFixed(2)}`
      );
    }

    return lines;
  }
}
