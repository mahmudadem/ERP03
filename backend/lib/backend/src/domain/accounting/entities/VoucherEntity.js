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
 * DRAFT → APPROVED → POSTED → LOCKED
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
    // Metadata (Generic extra fields - includes formId, prefix, sourceModule)
    metadata = {}, 
    // Audit trail
    createdBy, createdAt, approvedBy, approvedAt, rejectedBy, rejectedAt, rejectionReason, lockedBy, lockedAt, postedBy, postedAt, 
    // Additional fields migrated from legacy
    reference, // External reference (invoice #, check #, etc.)
    updatedAt // Last modification timestamp
    ) {
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
        this.postedBy = postedBy;
        this.postedAt = postedAt;
        this.reference = reference;
        this.updatedAt = updatedAt;
        // Invariant: Must have at least 2 lines (debit and credit)
        if (lines.length < 2) {
            throw new Error('Voucher must have at least 2 lines');
        }
        // Invariant: Debits must equal credits IN BASE CURRENCY (within MONEY_EPS tolerance)
        // This is the core accounting invariant - balancing is ALWAYS on baseAmount
        const calculatedDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const calculatedCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
        if (!(0, VoucherLineEntity_1.moneyEquals)(calculatedDebit, calculatedCredit)) {
            throw new Error(`Voucher not balanced in base currency: Debit=${calculatedDebit}, Credit=${calculatedCredit}`);
        }
        // Invariant: Totals must match line totals
        if (!(0, VoucherLineEntity_1.moneyEquals)(totalDebit, calculatedDebit)) {
            throw new Error('Total debit does not match sum of debit lines');
        }
        if (!(0, VoucherLineEntity_1.moneyEquals)(totalCredit, calculatedCredit)) {
            throw new Error('Total credit does not match sum of credit lines');
        }
        // Invariant: All lines must use the SAME baseCurrency (company base currency)
        // NOTE: FX currencies (line.currency) may differ - mixed FX is allowed
        const invalidBaseLines = lines.filter(line => line.baseCurrency !== baseCurrency);
        if (invalidBaseLines.length > 0) {
            throw new Error(`All lines must use the same base currency (${baseCurrency}). ` +
                `Found lines with: ${[...new Set(invalidBaseLines.map(l => l.baseCurrency))].join(', ')}`);
        }
    }
    // ========== Convenience getters for metadata fields ==========
    /** Source module that created this voucher (accounting, pos, inventory, hr) */
    get sourceModule() {
        var _a;
        return (_a = this.metadata) === null || _a === void 0 ? void 0 : _a.sourceModule;
    }
    /** Form/template ID used to create this voucher */
    get formId() {
        var _a;
        return (_a = this.metadata) === null || _a === void 0 ? void 0 : _a.formId;
    }
    /** Voucher number prefix (JE-, PV-, RV-, etc.) */
    get prefix() {
        var _a;
        return (_a = this.metadata) === null || _a === void 0 ? void 0 : _a.prefix;
    }
    /** Total debit in base currency (same as totalDebit for now) */
    get totalDebitBase() {
        return this.totalDebit;
    }
    /** Total credit in base currency (same as totalCredit for now) */
    get totalCreditBase() {
        return this.totalCredit;
    }
    /**
     * Check if voucher is balanced (within MONEY_EPS tolerance)
     */
    get isBalanced() {
        return (0, VoucherLineEntity_1.moneyEquals)(this.totalDebit, this.totalCredit);
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
     * Check if voucher is posted to ledger
     */
    get isPosted() {
        return this.status === VoucherTypes_1.VoucherStatus.POSTED;
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
     * Check if voucher is pending approval
     */
    get isPending() {
        return this.status === VoucherTypes_1.VoucherStatus.PENDING;
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
        return this.isPending; // Only PENDING vouchers can be approved
    }
    /**
     * Check if voucher can be posted
     */
    get canPost() {
        return this.isDraft || this.isApproved;
    }
    /**
     * Check if voucher can be locked
     */
    get canLock() {
        return this.isPosted;
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
     * Create posted version (immutable update)
     */
    post(postedBy, postedAt) {
        if (!this.canPost) {
            throw new Error(`Cannot post voucher in status: ${this.status}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.POSTED, this.metadata, this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, this.rejectionReason, this.lockedBy, this.lockedAt, postedBy, postedAt);
    }
    /**
     * Create locked version (immutable update)
     */
    lock(lockedBy, lockedAt) {
        if (!this.canLock) {
            throw new Error(`Cannot lock voucher in status: ${this.status}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.LOCKED, this.metadata, this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, this.rejectionReason, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt);
    }
    /**
     * Create a reversal voucher (for corrections)
     *
     * Generates a new voucher that exactly negates this voucher's financial impact.
     * Swaps debits and credits on all lines.
     *
     * @param reversalDate - Date for the reversal (typically today)
     * @param correctionGroupId - UUID linking reversal to replacement
     * @param reason - Reason for correction
     * @returns New VoucherEntity in DRAFT status (ready to be posted)
     */
    createReversal(reversalDate, correctionGroupId, userId, // Required for createdBy
    reason) {
        if (this.status !== VoucherTypes_1.VoucherStatus.POSTED) {
            throw new Error('Only POSTED vouchers can be reversed');
        }
        // Generate reversal lines by swapping debits/credits
        const reversalLines = this.lines.map((line, index) => new VoucherLineEntity_1.VoucherLineEntity(index + 1, // Re-index from 1
        line.accountId, line.side === 'Debit' ? 'Credit' : 'Debit', // Opposite side
        line.baseAmount, // baseAmount stays the same
        line.baseCurrency, // baseCurrency
        line.amount, // amount stays the same
        line.currency, // currency
        line.exchangeRate));
        // Swap totals as well
        const reversalTotalDebit = this.totalCredit;
        const reversalTotalCredit = this.totalDebit;
        // Create reversal metadata
        const reversalMetadata = Object.assign(Object.assign({}, this.metadata), { reversalOfVoucherId: this.id, correctionGroupId, correctionReason: reason });
        // Create new voucher entity for reversal
        return new VoucherEntity('', // ID will be generated when saved
        this.companyId, '', // Voucher number will be generated
        this.type, reversalDate, `Reversal of ${this.voucherNo}`, this.currency, this.baseCurrency, this.exchangeRate, reversalLines, reversalTotalDebit, reversalTotalCredit, VoucherTypes_1.VoucherStatus.DRAFT, reversalMetadata, userId, new Date());
    }
    /**
     * Check if this voucher is a reversal
     */
    get isReversal() {
        return !!this.metadata.reversalOfVoucherId;
    }
    /**
     * Check if this voucher is a replacement
     */
    get isReplacement() {
        return !!this.metadata.replacesVoucherId;
    }
    /**
     * Get correction group ID if this voucher is part of a correction
     */
    get correctionGroupId() {
        return this.metadata.correctionGroupId;
    }
    /**
     * Convert to plain object for persistence
     */
    toJSON() {
        var _a, _b, _c, _d, _e;
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
            totalDebitBase: this.totalDebitBase,
            totalCreditBase: this.totalCreditBase,
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
            lockedAt: ((_c = this.lockedAt) === null || _c === void 0 ? void 0 : _c.toISOString()) || null,
            postedBy: this.postedBy || null,
            postedAt: ((_d = this.postedAt) === null || _d === void 0 ? void 0 : _d.toISOString()) || null,
            // Legacy fields
            reference: this.reference || null,
            updatedAt: ((_e = this.updatedAt) === null || _e === void 0 ? void 0 : _e.toISOString()) || null,
            // Metadata convenience fields (also in metadata object)
            sourceModule: this.sourceModule || null,
            formId: this.formId || null,
            prefix: this.prefix || null
        };
    }
    /**
     * Create from plain object (for deserialization)
     */
    static fromJSON(data) {
        var _a;
        return new VoucherEntity(data.id, data.companyId, data.voucherNo, data.type, data.date, (_a = data.description) !== null && _a !== void 0 ? _a : '', data.currency, data.baseCurrency, data.exchangeRate, (data.lines || []).map((lineData) => VoucherLineEntity_1.VoucherLineEntity.fromJSON(lineData)), data.totalDebit, data.totalCredit, data.status, data.metadata || {}, data.createdBy, new Date(data.createdAt), data.approvedBy, data.approvedAt ? new Date(data.approvedAt) : undefined, data.rejectedBy, data.rejectedAt ? new Date(data.rejectedAt) : undefined, data.rejectionReason, data.lockedBy, data.lockedAt ? new Date(data.lockedAt) : undefined, data.postedBy, data.postedAt ? new Date(data.postedAt) : undefined, 
        // Additional legacy fields
        data.reference, data.updatedAt ? new Date(data.updatedAt) : undefined);
    }
}
exports.VoucherEntity = VoucherEntity;
//# sourceMappingURL=VoucherEntity.js.map