"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalEntryStrategy = void 0;
const VoucherLineEntity_1 = require("../../entities/VoucherLineEntity");
/**
 * JournalEntryStrategy
 *
 * Handles manual general ledger entries.
 * No automatic posting logic - accepts user-defined debit/credit lines.
 * Validates that entries balance (debits = credits).
 *
 * Accepts both V2 format (side, amount, baseAmount) and legacy format (debitFx, creditFx).
 */
class JournalEntryStrategy {
    async generateLines(header, companyId, baseCurrency) {
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
        const lines = [];
        let totalDebitBase = 0;
        let totalCreditBase = 0;
        let totalDebitHeader = 0;
        let totalCreditHeader = 0;
        header.lines.forEach((inputLine, idx) => {
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
            let absoluteRate;
            if (lineCurrency === baseCurrency) {
                // Line is already in base currency, no conversion needed
                absoluteRate = 1.0;
            }
            else if (lineCurrency === headerCurrency) {
                // Line currency matches header, use header rate
                absoluteRate = headerRate;
            }
            else {
                // Line currency differs from both header and base
                // This requires: line -> header -> base conversion
                absoluteRate = (0, VoucherLineEntity_1.roundMoney)(headerRate * lineParity);
            }
            // Calculate baseAmount
            const baseAmount = (0, VoucherLineEntity_1.roundMoney)(amount * absoluteRate);
            // Tracking Header Totals is now handled in a dedicated loop 
            // during Penny Balancing to ensure all currency types are covered.
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
                throw new Error(`Line ${idx + 1}: Base amount must be positive. ` +
                    `Amount: ${amount} ${lineCurrency}, Rate: ${absoluteRate}, Base: ${baseAmount} ${baseCurrency}. ` +
                    `Check exchange rates for ${lineCurrency}->${baseCurrency} conversion.`);
            }
            const line = new VoucherLineEntity_1.VoucherLineEntity(idx + 1, inputLine.accountId, side, baseAmount, // baseAmount
            baseCurrency, // baseCurrency
            amount, // amount
            lineCurrency, // currency
            absoluteRate, // rate used for conversion
            inputLine.notes || inputLine.description || undefined, inputLine.costCenterId, inputLine.metadata || {});
            totalDebitBase += line.debitAmount;
            totalCreditBase += line.creditAmount;
            lines.push(line);
        });
        // Track Header Totals (Convert EVERY line to header currency using parity)
        // We reset these to zero to avoid any double-counting from the previous loop.
        totalDebitHeader = 0;
        totalCreditHeader = 0;
        header.lines.forEach((inputLine) => {
            const amount = Math.abs(Number(inputLine.amount) || 0);
            const lineParity = Number(inputLine.exchangeRate) || 1;
            const amountInHeader = (0, VoucherLineEntity_1.roundMoney)(amount * lineParity);
            if (inputLine.side === 'Debit')
                totalDebitHeader = (0, VoucherLineEntity_1.roundMoney)(totalDebitHeader + amountInHeader);
            else
                totalCreditHeader = (0, VoucherLineEntity_1.roundMoney)(totalCreditHeader + amountInHeader);
        });
        const baseTolerance = 0.01;
        const headerTolerance = 0.01;
        const pennyThreshold = 5.0; // Max 5.0 units of base currency for auto-balancing
        const baseDiff = (0, VoucherLineEntity_1.roundMoney)(totalDebitBase - totalCreditBase);
        const headerDiff = (0, VoucherLineEntity_1.roundMoney)(totalDebitHeader - totalCreditHeader);
        console.log('[JournalEntryStrategy] Balance check:', {
            totalDebitBase,
            totalCreditBase,
            baseDiff,
            totalDebitHeader,
            totalCreditHeader,
            headerDiff
        });
        if (Math.abs(headerDiff) <= headerTolerance && Math.abs(baseDiff) > baseTolerance) {
            if (Math.abs(baseDiff) <= pennyThreshold) {
                console.log(`[JournalEntryStrategy] Penny Balancing: Adjusting residual ${baseDiff} ${baseCurrency}`);
                // Adjust the last line to close the gap
                const lastIndex = lines.length - 1;
                const lastLine = lines[lastIndex];
                // New base amount for the last line
                let newBaseAmount = lastLine.baseAmount;
                if (lastLine.side === 'Debit') {
                    newBaseAmount = (0, VoucherLineEntity_1.roundMoney)(lastLine.baseAmount - baseDiff);
                }
                else {
                    newBaseAmount = (0, VoucherLineEntity_1.roundMoney)(lastLine.baseAmount + baseDiff);
                }
                // Safety check: Ensure new base amount is still positive
                if (newBaseAmount > 0) {
                    // Recalculate effective rate for this line
                    const newAbsoluteRate = newBaseAmount / lastLine.amount;
                    // Replace the last line with adjusted values
                    lines[lastIndex] = new VoucherLineEntity_1.VoucherLineEntity(lastLine.id, lastLine.accountId, lastLine.side, newBaseAmount, baseCurrency, lastLine.amount, lastLine.currency, newAbsoluteRate, lastLine.notes, lastLine.costCenterId, lastLine.metadata);
                    // Update final totals
                    if (lastLine.side === 'Debit') {
                        totalDebitBase = (0, VoucherLineEntity_1.roundMoney)(totalDebitBase - baseDiff);
                    }
                    else {
                        totalCreditBase = (0, VoucherLineEntity_1.roundMoney)(totalCreditBase + baseDiff);
                    }
                    console.log('[JournalEntryStrategy] Adjusted last line:', {
                        originalBase: lastLine.baseAmount,
                        newBase: newBaseAmount,
                        newRate: newAbsoluteRate
                    });
                }
            }
        }
        // Validation: Final debits must equal credits
        if (Math.abs(totalDebitBase - totalCreditBase) > baseTolerance) {
            throw new Error(`Debits must equal credits in base currency (${baseCurrency}). ` +
                `Total debits: ${totalDebitBase.toFixed(2)}, Total credits: ${totalCreditBase.toFixed(2)}`);
        }
        return lines;
    }
}
exports.JournalEntryStrategy = JournalEntryStrategy;
//# sourceMappingURL=JournalEntryStrategy.js.map