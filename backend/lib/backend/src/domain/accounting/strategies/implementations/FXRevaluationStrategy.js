"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FXRevaluationStrategy = void 0;
const VoucherLineEntity_1 = require("../../entities/VoucherLineEntity");
/**
 * FXRevaluationStrategy
 *
 * Handles the generation of automatic Foreign Currency Revaluation vouchers.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * FX Revaluation lines are a base-currency-only adjustment. The foreign currency
 * balance does NOT change — only the base-currency equivalent is adjusted.
 *
 * Because VoucherLineEntity enforces `baseAmount == roundMoney(amount * exchangeRate)`
 * when currency != baseCurrency, we express ALL revaluation lines in baseCurrency
 * with `amount = baseAmount` and `exchangeRate = 1.0`. This correctly passes all
 * domain invariants while conveying the pure base-currency adjustment.
 *
 * The original foreign currency info is preserved in each line's `notes` field
 * (and optionally in `metadata`) for audit trail purposes.
 */
class FXRevaluationStrategy {
    async generateLines(header, companyId, baseCurrency) {
        if (!header.lines || !Array.isArray(header.lines) || header.lines.length === 0) {
            throw new Error('FX Revaluation must have at least one account line');
        }
        if (!header.targetAccountId) {
            throw new Error('FX Revaluation Strategy requires a targetAccountId for Unrealized Gains/Losses');
        }
        const lines = [];
        let netDeltaBase = 0;
        // Process each calculated revaluation line
        header.lines.forEach((inputLine, idx) => {
            if (!inputLine.accountId) {
                throw new Error(`Line ${idx + 1}: Account ID required`);
            }
            const deltaBase = Number(inputLine.deltaBase) || 0;
            if (deltaBase === 0) {
                return; // Skip accounts with zero delta
            }
            const isDebit = deltaBase > 0;
            const amountBase = (0, VoucherLineEntity_1.roundMoney)(Math.abs(deltaBase));
            const signedAmountBase = isDebit ? amountBase : -amountBase;
            // All FX Revaluation lines are expressed in baseCurrency.
            // amount = baseAmount, currency = baseCurrency, exchangeRate = 1.0
            // This passes VoucherLineEntity's same-currency invariant (amount == baseAmount).
            lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, // Unique sequential ID for each line
            inputLine.accountId, isDebit ? 'Debit' : 'Credit', amountBase, // baseAmount
            baseCurrency, // baseCurrency
            amountBase, // amount = baseAmount (same-currency line)
            baseCurrency, // currency = baseCurrency
            1.0, // exchangeRate = 1.0
            `FX Reval: ${inputLine.currency} balance ${inputLine.foreignBalance} @ ${inputLine.newRate}`, undefined, // costCenterId
            { originalCurrency: inputLine.currency, foreignBalance: inputLine.foreignBalance, newRate: inputLine.newRate, isRevaluation: true }));
            netDeltaBase += signedAmountBase;
        });
        if (lines.length === 0) {
            throw new Error('No foreign exchange differences found to revalue.');
        }
        // Generate the offset line for the Unrealized Gain/Loss Account
        const isTargetDebit = netDeltaBase < 0;
        const targetAmountBase = (0, VoucherLineEntity_1.roundMoney)(Math.abs(netDeltaBase));
        lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, // Unique sequential ID for the offset line
        header.targetAccountId, isTargetDebit ? 'Debit' : 'Credit', targetAmountBase, // baseAmount
        baseCurrency, // baseCurrency
        targetAmountBase, // amount = baseAmount
        baseCurrency, // currency = baseCurrency
        1.0, // exchangeRate
        `Total FX Revaluation (Unrealized ${netDeltaBase > 0 ? 'Gain' : 'Loss'})`, undefined, { totalNetDelta: netDeltaBase, isRevaluation: true }));
        return lines;
    }
}
exports.FXRevaluationStrategy = FXRevaluationStrategy;
//# sourceMappingURL=FXRevaluationStrategy.js.map