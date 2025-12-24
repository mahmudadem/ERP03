"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherLineEntity = void 0;
/**
 * VoucherLine Value Object (Immutable)
 *
 * ADR-005 Compliant Implementation
 *
 * Represents a single debit or credit line in a voucher.
 * This is a complete rewrite following the simplified architecture.
 *
 * Key principles:
 * - Immutable (readonly properties)
 * - Self-validating (validation in constructor)
 * - Always stores BOTH transaction and base currency
 * - Exchange rate frozen at transaction time
 */
class VoucherLineEntity {
    constructor(id, accountId, side, 
    // Transaction currency (what user entered)
    amount, currency, 
    // Base currency (for accounting/reporting)
    baseAmount, baseCurrency, 
    // FX metadata (rate at transaction time)
    exchangeRate, 
    // Optional fields
    notes, costCenterId, 
    // Metadata (Generic extra fields)
    metadata = {}) {
        this.id = id;
        this.accountId = accountId;
        this.side = side;
        this.amount = amount;
        this.currency = currency;
        this.baseAmount = baseAmount;
        this.baseCurrency = baseCurrency;
        this.exchangeRate = exchangeRate;
        this.notes = notes;
        this.costCenterId = costCenterId;
        this.metadata = metadata;
        // Invariant: amount must be positive
        if (amount <= 0) {
            throw new Error(`VoucherLine amount must be positive, got: ${amount}`);
        }
        // Invariant: baseAmount must be positive
        if (baseAmount <= 0) {
            throw new Error(`VoucherLine baseAmount must be positive, got: ${baseAmount}`);
        }
        // Invariant: exchangeRate must be positive
        if (exchangeRate <= 0) {
            throw new Error(`Exchange rate must be positive, got: ${exchangeRate}`);
        }
        // Invariant: accountId required
        if (!accountId || accountId.trim() === '') {
            throw new Error('VoucherLine accountId is required');
        }
        // Invariant: currency codes required
        if (!currency || !baseCurrency) {
            throw new Error('Currency codes are required');
        }
    }
    /**
     * Get debit amount in base currency (0 if this is a credit line)
     */
    get debitAmount() {
        return this.side === 'Debit' ? this.baseAmount : 0;
    }
    /**
     * Get credit amount in base currency (0 if this is a credit line)
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
            amount: this.amount,
            currency: this.currency,
            baseAmount: this.baseAmount,
            baseCurrency: this.baseCurrency,
            exchangeRate: this.exchangeRate,
            notes: this.notes || null,
            costCenterId: this.costCenterId || null,
            metadata: this.metadata
        };
    }
    /**
     * Create from plain object (for deserialization)
     */
    static fromJSON(data) {
        return new VoucherLineEntity(data.id, data.accountId, data.side, data.amount, data.currency, data.baseAmount, data.baseCurrency, data.exchangeRate, data.notes, data.costCenterId, data.metadata || {});
    }
    /**
     * Create a new line with updated notes (immutable update)
     */
    withNotes(notes) {
        return new VoucherLineEntity(this.id, this.accountId, this.side, this.amount, this.currency, this.baseAmount, this.baseCurrency, this.exchangeRate, notes, this.costCenterId, this.metadata);
    }
}
exports.VoucherLineEntity = VoucherLineEntity;
//# sourceMappingURL=VoucherLineEntity.js.map