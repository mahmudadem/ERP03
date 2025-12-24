"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherEntity = void 0;
const VoucherTypes_1 = require("../types/VoucherTypes");
const VoucherLineEntity_1 = require("./VoucherLineEntity");
/**
 * Voucher Aggregate Root (Immutable)
 *
 * ADR-005 Compliant Implementation
 *
 * Represents a complete financial voucher (transaction document).
 * This is the aggregate root that contains voucher lines.
 *
 * Key principles:
 * - Immutable once created (use methods to create new versions)
 * - Self-validating (balanced debits/credits)
 * - Complete audit trail embedded
 * - Simple state-based approval (no workflow engine)
 *
 * State Flow:
 * DRAFT → APPROVED → LOCKED
 *    ↓
 * REJECTED
 */
class VoucherEntity {
    constructor(id, companyId, voucherNo, type, date, // ISO date string (YYYY-MM-DD)
    description, 
    // Currency
    currency, baseCurrency, exchangeRate, 
    // Lines (aggregate)
    lines, 
    // Calculated totals (in base currency)
    totalDebit, totalCredit, 
    // State
    status, 
    // Metadata (Generic extra fields)
    metadata = {}, 
    // Audit trail
    createdBy, createdAt, approvedBy, approvedAt, rejectedBy, rejectedAt, rejectionReason, lockedBy, lockedAt) {
        this.id = id;
        this.companyId = companyId;
        this.voucherNo = voucherNo;
        this.type = type;
        this.date = date;
        this.description = description;
        this.currency = currency;
        this.baseCurrency = baseCurrency;
        this.exchangeRate = exchangeRate;
        this.lines = lines;
        this.totalDebit = totalDebit;
        this.totalCredit = totalCredit;
        this.status = status;
        this.metadata = metadata;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
        this.approvedBy = approvedBy;
        this.approvedAt = approvedAt;
        this.rejectedBy = rejectedBy;
        this.rejectedAt = rejectedAt;
        this.rejectionReason = rejectionReason;
        this.lockedBy = lockedBy;
        this.lockedAt = lockedAt;
        // Invariant: Must have at least 2 lines (debit and credit)
        if (lines.length < 2) {
            throw new Error('Voucher must have at least 2 lines');
        }
        // Invariant: Debits must equal credits (within rounding tolerance)
        const calculatedDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const calculatedCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
        if (Math.abs(calculatedDebit - calculatedCredit) > 0.01) {
            throw new Error(`Voucher not balanced: Debit=${calculatedDebit}, Credit=${calculatedCredit}`);
        }
        // Invariant: Totals must match line totals
        if (Math.abs(totalDebit - calculatedDebit) > 0.01) {
            throw new Error('Total debit does not match sum of debit lines');
        }
        if (Math.abs(totalCredit - calculatedCredit) > 0.01) {
            throw new Error('Total credit does not match sum of credit lines');
        }
        // Invariant: All lines must use the same currencies
        const invalidLines = lines.filter(line => line.currency !== currency || line.baseCurrency !== baseCurrency);
        if (invalidLines.length > 0) {
            throw new Error('All lines must use the same transaction and base currency');
        }
    }
    /**
     * Check if voucher is balanced
     */
    get isBalanced() {
        return Math.abs(this.totalDebit - this.totalCredit) < 0.01;
    }
    /**
     * Check if voucher is in draft state
     */
    get isDraft() {
        return this.status === VoucherTypes_1.VoucherStatus.DRAFT;
    }
    /**
     * Check if voucher is approved
     */
    get isApproved() {
        return this.status === VoucherTypes_1.VoucherStatus.APPROVED;
    }
    /**
     * Check if voucher is locked
     */
    get isLocked() {
        return this.status === VoucherTypes_1.VoucherStatus.LOCKED;
    }
    /**
     * Check if voucher is rejected
     */
    get isRejected() {
        return this.status === VoucherTypes_1.VoucherStatus.REJECTED;
    }
    /**
     * Check if voucher can be edited
     */
    get canEdit() {
        return this.isDraft || this.isRejected;
    }
    /**
     * Check if voucher can be approved
     */
    get canApprove() {
        return this.isDraft;
    }
    /**
     * Check if voucher can be locked
     */
    get canLock() {
        return this.isApproved;
    }
    /**
     * Check if voucher involves foreign currency
     */
    get isForeignCurrency() {
        return this.currency !== this.baseCurrency;
    }
    /**
     * Create approved version (immutable update)
     */
    approve(approvedBy, approvedAt) {
        if (!this.canApprove) {
            throw new Error(`Cannot approve voucher in status: ${this.status}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, this.metadata, this.createdBy, this.createdAt, approvedBy, approvedAt, undefined, undefined, undefined, this.lockedBy, this.lockedAt);
    }
    /**
     * Create rejected version (immutable update)
     */
    reject(rejectedBy, rejectedAt, reason) {
        if (!this.isDraft && !this.isApproved) {
            throw new Error(`Cannot reject voucher in status: ${this.status}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.REJECTED, this.metadata, this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, rejectedBy, rejectedAt, reason, this.lockedBy, this.lockedAt);
    }
    /**
     * Create locked version (immutable update)
     */
    lock(lockedBy, lockedAt) {
        if (!this.canLock) {
            throw new Error(`Cannot lock voucher in status: ${this.status}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.LOCKED, this.metadata, this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, this.rejectionReason, lockedBy, lockedAt);
    }
    /**
     * Convert to plain object for persistence
     */
    toJSON() {
        var _a, _b, _c;
        return {
            id: this.id,
            companyId: this.companyId,
            voucherNo: this.voucherNo,
            type: this.type,
            date: this.date,
            description: this.description,
            currency: this.currency,
            baseCurrency: this.baseCurrency,
            exchangeRate: this.exchangeRate,
            lines: this.lines.map(line => line.toJSON()),
            totalDebit: this.totalDebit,
            totalCredit: this.totalCredit,
            status: this.status,
            metadata: this.metadata,
            createdBy: this.createdBy,
            createdAt: this.createdAt.toISOString(),
            approvedBy: this.approvedBy || null,
            approvedAt: ((_a = this.approvedAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
            rejectedBy: this.rejectedBy || null,
            rejectedAt: ((_b = this.rejectedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
            rejectionReason: this.rejectionReason || null,
            lockedBy: this.lockedBy || null,
            lockedAt: ((_c = this.lockedAt) === null || _c === void 0 ? void 0 : _c.toISOString()) || null
        };
    }
    /**
     * Create from plain object (for deserialization)
     */
    static fromJSON(data) {
        return new VoucherEntity(data.id, data.companyId, data.voucherNo, data.type, data.date, data.description, data.currency, data.baseCurrency, data.exchangeRate, (data.lines || []).map((lineData) => VoucherLineEntity_1.VoucherLineEntity.fromJSON(lineData)), data.totalDebit, data.totalCredit, data.status, data.metadata || {}, data.createdBy, new Date(data.createdAt), data.approvedBy, data.approvedAt ? new Date(data.approvedAt) : undefined, data.rejectedBy, data.rejectedAt ? new Date(data.rejectedAt) : undefined, data.rejectionReason, data.lockedBy, data.lockedAt ? new Date(data.lockedAt) : undefined);
    }
}
exports.VoucherEntity = VoucherEntity;
//# sourceMappingURL=VoucherEntity.js.map