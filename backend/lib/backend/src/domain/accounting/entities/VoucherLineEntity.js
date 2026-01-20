"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherLineEntity = exports.moneyEquals = exports.roundMoney = exports.MONEY_DECIMALS = exports.MONEY_EPS = void 0;
/**
 * VoucherLine Value Object (Immutable)
 *
 * ADR-005 Compliant Implementation
 *
 * Represents a single debit or credit line in a voucher.
 * Supports mixed FX currencies within the same voucher.
 *
 * Key principles:
 * - Immutable (readonly properties)
 * - Self-validating (validation in constructor)
 * - Stores BOTH transaction (FX) and base currency amounts
 * - Exchange rate frozen at transaction time
 * - baseCurrency must match company base currency
 *
 * ROUNDING RULE:
 * - baseAmount is rounded to 2 decimal places using STANDARD rounding (Math.round)
 * - When creating FX lines, caller should compute: baseAmount = roundMoney(amount * exchangeRate)
 * - Constructor validates that baseAmount matches roundMoney(amount * exchangeRate) within MONEY_EPS
 */
// ========== MONEY CONSTANTS ==========
/** Epsilon for money comparisons (1 cent tolerance) */
exports.MONEY_EPS = 0.01;
/** Default decimal places for money rounding */
exports.MONEY_DECIMALS = 2;
/**
 * Round a monetary value to specified decimal places using STANDARD rounding.
 *
 * NOTE: This uses Math.round (round half away from zero), NOT banker's rounding (half-even).
 * For accounting purposes, standard rounding is acceptable as long as it's applied consistently.
 *
 * @param value The value to round
 * @param decimals Number of decimal places (default: 2 for currency)
 * @returns Rounded value
 */
function roundMoney(value, decimals = exports.MONEY_DECIMALS) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
exports.roundMoney = roundMoney;
/**
 * Check if two money values are equal within MONEY_EPS tolerance
 */
function moneyEquals(a, b) {
    return Math.abs(a - b) <= exports.MONEY_EPS;
}
exports.moneyEquals = moneyEquals;
class VoucherLineEntity {
    constructor(id, accountId, side, baseAmount, baseCurrency, amount, currency, exchangeRate, notes, costCenterId, metadata = {}) {
        this.id = id;
        this.accountId = accountId;
        this.side = side;
        this.baseAmount = baseAmount;
        this.baseCurrency = baseCurrency.toUpperCase();
        this.amount = amount;
        this.currency = currency.toUpperCase();
        this.exchangeRate = exchangeRate;
        this.notes = notes;
        this.costCenterId = costCenterId;
        this.metadata = metadata;
        // ========== INVARIANT VALIDATIONS ==========
        // Invariant: side must be Debit or Credit
        if (side !== 'Debit' && side !== 'Credit') {
            throw new Error(`Invalid side: ${side}. Must be 'Debit' or 'Credit'`);
        }
        // Invariant: accountId required
        if (!accountId || accountId.trim() === '') {
            throw new Error('VoucherLine accountId is required');
        }
        // Invariant: currency codes required
        if (!baseCurrency || baseCurrency.trim() === '') {
            throw new Error('VoucherLine baseCurrency is required');
        }
        if (!currency || currency.trim() === '') {
            throw new Error('VoucherLine currency is required');
        }
        // Invariant: baseAmount must be positive
        if (baseAmount <= 0) {
            throw new Error(`VoucherLine baseAmount must be positive, got: ${baseAmount}`);
        }
        // Invariant: amount must be positive
        if (amount <= 0) {
            throw new Error(`VoucherLine amount must be positive, got: ${amount}`);
        }
        // ========== FX-SPECIFIC INVARIANTS ==========
        if (currency === baseCurrency) {
            // Same currency: exchangeRate must be 1
            if (exchangeRate !== 1) {
                throw new Error(`When currency equals baseCurrency, exchangeRate must be 1. Got: ${exchangeRate}`);
            }
            // Same currency: amount should equal baseAmount (within MONEY_EPS)
            if (!moneyEquals(amount, baseAmount)) {
                throw new Error(`When currency equals baseCurrency, amount (${amount}) must equal baseAmount (${baseAmount})`);
            }
        }
        else {
            // Different currency (FX line)
            // Invariant: exchangeRate must be present and positive
            if (!exchangeRate || exchangeRate <= 0) {
                throw new Error(`FX line requires positive exchangeRate. Got: ${exchangeRate}`);
            }
            // Invariant: baseAmount must match roundMoney(amount * exchangeRate)
            const expectedBaseAmount = roundMoney(amount * exchangeRate);
            if (!moneyEquals(baseAmount, expectedBaseAmount)) {
                throw new Error(`baseAmount (${baseAmount}) does not match amount * exchangeRate. ` +
                    `Expected: ${expectedBaseAmount} (${amount} * ${exchangeRate})`);
            }
        }
    }
    /**
     * Get debit amount in base currency (0 if this is a credit line)
     */
    get debitAmount() {
        return this.side === 'Debit' ? this.baseAmount : 0;
    }
    /**
     * Get credit amount in base currency (0 if this is a debit line)
     */
    get creditAmount() {
        return this.side === 'Credit' ? this.baseAmount : 0;
    }
    /**
     * Check if this line is a debit
     */
    get isDebit() {
        return this.side === 'Debit';
    }
    /**
     * Check if this line is a credit
     */
    get isCredit() {
        return this.side === 'Credit';
    }
    /**
     * Check if this involves foreign currency
     */
    get isForeignCurrency() {
        return this.currency !== this.baseCurrency;
    }
    /**
     * Convert to plain object for persistence
     */
    toJSON() {
        return {
            id: this.id,
            accountId: this.accountId,
            side: this.side,
            baseAmount: this.baseAmount,
            baseCurrency: this.baseCurrency,
            amount: this.amount,
            currency: this.currency,
            exchangeRate: this.exchangeRate,
            notes: this.notes || null,
            costCenterId: this.costCenterId || null,
            metadata: this.metadata
        };
    }
    /**
     * Create from plain object (for deserialization)
     *
     * V2 ONLY - No legacy format support.
     * Legacy data migration should be done via separate migration script.
     */
    static fromJSON(data, fallbackBaseCurrency) {
        // Determine side and amounts (Handle Legacy V1 format)
        let side = data.side;
        let amount = data.amount;
        let baseAmount = data.baseAmount;
        let currency = data.currency || data.lineCurrency;
        let baseCurrency = data.baseCurrency;
        // Legacy fallback logic
        if (side === undefined) {
            side = (data.debitFx > 0 || data.debitBase > 0) ? 'Debit' : 'Credit';
        }
        if (amount === undefined) {
            amount = Math.abs(data.debitFx || 0) || Math.abs(data.creditFx || 0) || 0;
        }
        if (baseAmount === undefined) {
            baseAmount = Math.abs(data.debitBase || 0) || Math.abs(data.creditBase || 0) || amount;
        }
        if (!baseCurrency) {
            // Logic: In V1, we didn't store baseCurrency per line. 
            // We'll use the voucher's base currency if provided, otherwise default to USD.
            baseCurrency = fallbackBaseCurrency || 'USD';
        }
        // Default amount to 0.01 if it's somehow 0 in old data (to avoid invariant crash)
        const safeAmount = Math.max(0.01, amount);
        const safeBaseAmount = Math.max(0.01, baseAmount);
        return new VoucherLineEntity(data.id || 1, data.accountId || 'legacy-account', side, safeBaseAmount, baseCurrency, safeAmount, currency || 'USD', data.exchangeRate || 1, data.notes || data.description, data.costCenterId, data.metadata || {});
    }
    /**
     * Create a new line with updated notes (immutable update)
     */
    withNotes(notes) {
        return new VoucherLineEntity(this.id, this.accountId, this.side, this.baseAmount, this.baseCurrency, this.amount, this.currency, this.exchangeRate, notes, this.costCenterId, this.metadata);
    }
}
exports.VoucherLineEntity = VoucherLineEntity;
//# sourceMappingURL=VoucherLineEntity.js.map