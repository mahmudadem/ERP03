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
    createdBy, createdAt, approvedBy, approvedAt, rejectedBy, rejectedAt, rejectionReason, lockedBy, lockedAt, postedBy, postedAt, postingLockPolicy, reversalOfVoucherId, 
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
        this.postingLockPolicy = postingLockPolicy;
        this.reversalOfVoucherId = reversalOfVoucherId;
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
     * Check if voucher is posted to ledger (V1: derived from postedAt)
     * POSTED is NOT a workflow state. It is a financial effect indicator.
     */
    get isPosted() {
        return !!this.postedAt;
    }
    /**
     * Governance Guard for EDITING posted vouchers
     *
     * PostingLockPolicy Semantics:
     * - STRICT_LOCKED: Voucher was posted under Strict Mode → IMMUTABLE FOREVER (no config can unlock)
     * - FLEXIBLE_LOCKED: Voucher was posted under Flexible Mode → Editable IF allowEditDeletePosted=true
     *
     * Rules:
     * 1. STRICT_LOCKED vouchers → BLOCKED (unconditional invariant)
     * 2. FLEXIBLE_LOCKED + STRICT mode → BLOCKED
     * 3. FLEXIBLE_LOCKED + FLEXIBLE mode + toggle OFF → BLOCKED
     * 4. FLEXIBLE_LOCKED + FLEXIBLE mode + toggle ON → ALLOWED (caller must resync ledger)
     *
     * @param isStrictMode - Whether company is currently in Strict Approval Mode
     * @param allowEditDeletePosted - Toggle from settings (only applies in FLEXIBLE mode to FLEXIBLE_LOCKED vouchers)
     * @throws Error if edit is forbidden
     */
    assertCanEdit(isStrictMode, allowEditDeletePosted = false) {
        // Rule 1: CANCELLED vouchers cannot be edited
        if (this.status === VoucherTypes_1.VoucherStatus.CANCELLED) {
            throw new Error('Voucher is CANCELLED and cannot be modified.');
        }
        // Rule 2: Non-posted vouchers can always be edited (workflow permit)
        if (!this.isPosted) {
            return; // Edit allowed
        }
        // Rule 3: UNCONDITIONAL INVARIANT - Strict-Forever Lock
        // Vouchers posted under STRICT policy are IMMUTABLE FOREVER
        // This takes precedence over any runtime config (mode switch cannot unlock)
        if (this.postingLockPolicy === VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED) {
            throw new Error('VOUCHER_STRICT_LOCK_FOREVER: This voucher was posted under Strict policy and is immutable forever. Use Reversal.');
        }
        // Rule 4: STRICT MODE - Posted vouchers (FLEXIBLE_LOCKED) CANNOT be edited
        if (isStrictMode) {
            throw new Error('VOUCHER_POSTED_EDIT_FORBIDDEN: Posted vouchers cannot be edited in Strict Mode. Use Reversal to correct.');
        }
        // Rule 5: FLEXIBLE MODE - Check toggle
        if (!allowEditDeletePosted) {
            throw new Error('VOUCHER_POSTED_EDIT_FORBIDDEN: Posted vouchers cannot be edited. Enable "Allow Edit/Delete Posted" in settings or use Reversal.');
        }
        // FLEXIBLE + toggle ON + FLEXIBLE_LOCKED voucher → Edit allowed (caller must perform ledger resync)
    }
    /**
     * Governance Guard for DELETING posted vouchers
     *
     * PostingLockPolicy Semantics:
     * - STRICT_LOCKED: Voucher was posted under Strict Mode → IMMUTABLE FOREVER (no config can unlock)
     * - FLEXIBLE_LOCKED: Voucher was posted under Flexible Mode → Deletable IF allowEditDeletePosted=true
     *
     * Rules:
     * 1. STRICT_LOCKED vouchers → BLOCKED (unconditional invariant)
     * 2. FLEXIBLE_LOCKED + STRICT mode → BLOCKED
     * 3. FLEXIBLE_LOCKED + FLEXIBLE mode + toggle OFF → BLOCKED
     * 4. FLEXIBLE_LOCKED + FLEXIBLE mode + toggle ON → ALLOWED (caller must delete ledger entries)
     *
     * @param isStrictMode - Whether company is currently in Strict Approval Mode
     * @param allowEditDeletePosted - Toggle from settings (only applies in FLEXIBLE mode to FLEXIBLE_LOCKED vouchers)
     * @throws Error if delete is forbidden
     */
    assertCanDelete(isStrictMode, allowEditDeletePosted = false) {
        // Rule 1: Already CANCELLED vouchers cannot be deleted again
        if (this.status === VoucherTypes_1.VoucherStatus.CANCELLED) {
            throw new Error('Voucher is already cancelled.');
        }
        // Rule 2: Non-posted vouchers can always be deleted
        if (!this.isPosted) {
            return; // Delete allowed
        }
        // Rule 3: UNCONDITIONAL INVARIANT - Strict-Forever Lock
        // Vouchers posted under STRICT policy are IMMUTABLE FOREVER
        // This takes precedence over any runtime config (mode switch cannot unlock)
        if (this.postingLockPolicy === VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED) {
            throw new Error('VOUCHER_STRICT_LOCK_FOREVER: This voucher was posted under Strict policy and is immutable forever. Use Reversal.');
        }
        // Rule 4: STRICT MODE - Posted vouchers (FLEXIBLE_LOCKED) CANNOT be deleted
        if (isStrictMode) {
            throw new Error('VOUCHER_POSTED_DELETE_FORBIDDEN: Posted vouchers cannot be deleted in Strict Mode. Use Reversal to correct.');
        }
        // Rule 5: FLEXIBLE MODE - Check toggle
        if (!allowEditDeletePosted) {
            throw new Error('VOUCHER_POSTED_DELETE_FORBIDDEN: Posted vouchers cannot be deleted. Enable "Allow Edit/Delete Posted" in settings or use Reversal.');
        }
        // FLEXIBLE + toggle ON + FLEXIBLE_LOCKED voucher → Delete allowed (caller must delete ledger entries)
    }
    /**
     * @deprecated Use assertCanEdit or assertCanDelete instead
     * Legacy mutation guard - kept for backward compatibility during transition
     */
    assertCanMutate() {
        if (this.postingLockPolicy === VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED) {
            throw new Error('VOUCHER_LOCKED_STRICT: This voucher belongs to an audit-compliant period and is permanently locked.');
        }
        if (this.status === VoucherTypes_1.VoucherStatus.CANCELLED) {
            throw new Error(`Voucher is CANCELLED and cannot be modified.`);
        }
        if (this.isPosted && this.postingLockPolicy === VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED) {
            throw new Error('VOUCHER_LOCKED_POLICY: This voucher is currently locked. Enable "Allow Edit/Delete Posted" in settings to modify.');
        }
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
     * Check if voucher can be edited (basic workflow check).
     * Note: This does NOT check period lock or allowEditPostedVouchersEnabled.
     * Those checks must be done in the use case layer.
     */
    get canEdit() {
        // Posted vouchers require additional policy check in use case
        if (this.isPosted)
            return false; // Default: not editable. Use case may override.
        return this.isDraft || this.isRejected || this.isPending || this.isApproved;
    }
    /**
     * Submit voucher for approval (DRAFT/REJECTED -> PENDING)
     */
    submit(submittedBy) {
        if (this.status !== VoucherTypes_1.VoucherStatus.DRAFT && this.status !== VoucherTypes_1.VoucherStatus.REJECTED) {
            throw new Error(`Cannot submit voucher in status: ${this.status}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.PENDING, this.metadata, this.createdBy, this.createdAt, undefined, // approvedBy cleared
        undefined, // approvedAt cleared
        undefined, // rejectedBy cleared
        undefined, // rejectedAt cleared
        undefined, // rejectionReason cleared
        this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, new Date() // UpdatedAt
        );
    }
    /**
     * Check if voucher can be approved
     */
    get canApprove() {
        // Allow approving DRAFT directly (Fast-track / Auto-approval)
        return this.isPending || this.status === VoucherTypes_1.VoucherStatus.DRAFT;
    }
    /**
     * Check if voucher can be posted to ledger.
     * V1: Only APPROVED vouchers that are NOT already posted can be posted.
     */
    get canPost() {
        return this.isApproved && !this.isPosted;
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
    /**
     * Create approved version (immutable update)
     * V1: Fast-track approval (legacy/simple mode)
     */
    approve(approvedBy, approvedAt) {
        if (!this.canApprove) {
            throw new Error(`Cannot approve voucher in status: ${this.status}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, this.metadata, this.createdBy, this.createdAt, approvedBy, approvedAt, undefined, undefined, undefined, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, this.updatedAt);
    }
    /**
     * Satisfy the Financial Approval gate (immutable update).
     *
     * @param approverId User ID of the approver
     * @param approvedAt Date of approval
     * @param isFullySatisfied If true, transitions status to APPROVED
     */
    satisfyFinancialApproval(approverId, approvedAt, isFullySatisfied) {
        if (this.status !== VoucherTypes_1.VoucherStatus.PENDING) {
            throw new Error('Voucher must be in PENDING status for financial approval gate.');
        }
        const newMetadata = Object.assign(Object.assign({}, this.metadata), { pendingFinancialApproval: false, financialApproval: {
                by: approverId,
                at: approvedAt.toISOString()
            } });
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, isFullySatisfied ? VoucherTypes_1.VoucherStatus.APPROVED : VoucherTypes_1.VoucherStatus.PENDING, newMetadata, this.createdBy, this.createdAt, isFullySatisfied ? approverId : undefined, isFullySatisfied ? approvedAt : undefined, undefined, undefined, undefined, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, new Date());
    }
    /**
     * Confirm custody for one or more accounts (immutable update).
     *
     * @param custodianUserId User ID of the custodian
     * @param confirmedAt Date of confirmation
     * @param isFullySatisfied If true, transitions status to APPROVED
     */
    confirmCustody(custodianUserId, confirmedAt, isFullySatisfied) {
        var _a, _b;
        if (this.status !== VoucherTypes_1.VoucherStatus.PENDING) {
            throw new Error('Voucher must be in PENDING status for custody confirmation gate.');
        }
        const currentPending = ((_a = this.metadata) === null || _a === void 0 ? void 0 : _a.pendingCustodyConfirmations) || [];
        const newPending = currentPending.filter((id) => id !== custodianUserId);
        const confirmations = [
            ...(((_b = this.metadata) === null || _b === void 0 ? void 0 : _b.custodyConfirmations) || []),
            {
                by: custodianUserId,
                at: confirmedAt.toISOString()
            }
        ];
        const newMetadata = Object.assign(Object.assign({}, this.metadata), { pendingCustodyConfirmations: newPending, custodyConfirmations: confirmations });
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, isFullySatisfied ? VoucherTypes_1.VoucherStatus.APPROVED : VoucherTypes_1.VoucherStatus.PENDING, newMetadata, this.createdBy, this.createdAt, 
        // Note: If transition to APPROVED happens via CC, we still record the final confirmation
        // and potentially the last confirming person as approver if we want, 
        // but usually the "approver" is the Finance Manager. 
        // V1: If CC satisfies the last gate, the previous FA details are already in approval fields.
        this.approvedBy, this.approvedAt, undefined, undefined, undefined, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, new Date());
    }
    /**
     * Create rejected version (immutable update)
     */
    reject(rejectedBy, rejectedAt, reason) {
        if (this.isPosted) {
            throw new Error('Cannot reject a posted voucher. Use reversal instead.');
        }
        if (this.status !== VoucherTypes_1.VoucherStatus.PENDING) {
            throw new Error(`Cannot reject voucher in status: ${this.status}. Rejection is only allowed for PENDING vouchers.`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.REJECTED, this.metadata, this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, rejectedBy, rejectedAt, reason, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, this.updatedAt);
    }
    /**
     * Create cancelled version (immutable update)
     * Terminal state for Drafts or Approved vouchers that should not be processed.
     */
    cancel(cancelledBy, cancelledAt, reason = 'Cancelled by user') {
        if (this.isPosted) {
            throw new Error('Cannot cancel a posted voucher. Use reversal instead.');
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.CANCELLED, this.metadata, this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, cancelledBy, cancelledAt, reason, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, new Date() // updatedAt
        );
    }
    /**
     * Create posted version (immutable update)
     * This method should ONLY be called AFTER ledger write succeeds.
     */
    post(postedBy, postedAt, lockPolicy = VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED) {
        if (!this.canPost) {
            throw new Error(`Cannot post voucher: status=${this.status}, isPosted=${this.isPosted}`);
        }
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, // V1: Status stays APPROVED
        this.metadata, this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, this.rejectionReason, this.lockedBy, this.lockedAt, postedBy, postedAt, lockPolicy, this.reversalOfVoucherId, this.reference, this.updatedAt);
    }
    /**
     * Mark voucher as edited (immutable update).
     * Used for PENDING vouchers to show a badge indicating they were modified after submission.
     */
    markAsEdited() {
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, this.status, Object.assign(Object.assign({}, this.metadata), { isEdited: true }), this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, this.rejectionReason, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, new Date() // UpdatedAt
        );
    }
    /**
     * Link a reversal attempt to this voucher.
     * Tracks that a reversal is in progress but does NOT mark it as finalized.
     *
     * @param reversalVoucherId - ID of the voucher that reverses this one
     */
    linkReversal(reversalVoucherId) {
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, this.status, Object.assign(Object.assign({}, this.metadata), { reversedByVoucherId: reversalVoucherId }), this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, this.rejectionReason, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, new Date());
    }
    /**
     * Mark voucher as reversed (finalized immutable update).
     * Sets isReversed=true. Should only be called when reversal voucher is POSTED.
     *
     * @param reversalVoucherId - ID of the voucher that reverses this one
     */
    markAsReversed(reversalVoucherId) {
        var _a;
        return new VoucherEntity(this.id, this.companyId, this.voucherNo, this.type, this.date, this.description, this.currency, this.baseCurrency, this.exchangeRate, this.lines, this.totalDebit, this.totalCredit, this.status, Object.assign(Object.assign({}, this.metadata), { reversedByVoucherId: reversalVoucherId || ((_a = this.metadata) === null || _a === void 0 ? void 0 : _a.reversedByVoucherId), isReversed: true }), this.createdBy, this.createdAt, this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, this.rejectionReason, this.lockedBy, this.lockedAt, this.postedBy, this.postedAt, this.postingLockPolicy, this.reversalOfVoucherId, this.reference, new Date());
    }
    // V1: lock() method removed. Period locking is enforced via lockedThroughDate in use cases.
    /**
     * Create a reversal voucher (for corrections)
     *
     * V2 Audit-Grade: Generates reversal from ACTUAL POSTED LEDGER LINES.
     * Negates the financial impact recorded in the ledger, not just the original voucher lines.
     *
     * @param reversalDate - Date for the reversal (typically today)
     * @param correctionGroupId - UUID linking reversal to replacement
     * @param userId - User creating the reversal
     * @param ledgerLines - The actual posted ledger entries for the original voucher
     * @param reason - Reason for correction
     * @returns New VoucherEntity in DRAFT status (ready to be posted)
     */
    createReversal(reversalVoucherId, reversalDate, correctionGroupId, userId, ledgerLines, reason) {
        if (!this.isPosted) {
            throw new Error('Only POSTED vouchers can be reversed');
        }
        if (!ledgerLines || ledgerLines.length === 0) {
            throw new Error('Cannot create reversal: No ledger lines provided. Audit source missing.');
        }
        // Generate reversal lines by inverting ACTUAL LEDGER entries
        const reversalLines = ledgerLines.map((entry, index) => {
            return new VoucherLineEntity_1.VoucherLineEntity(index + 1, entry.accountId, entry.side === 'Debit' ? 'Credit' : 'Debit', // INVERT SIDE
            entry.baseAmount, entry.baseCurrency, entry.amount, entry.currency, entry.exchangeRate, `[REVERSAL] ${entry.notes || ''}`.trim(), entry.costCenterId, Object.assign(Object.assign({}, entry.metadata), { sourceLedgerEntryId: entry.id }));
        });
        // Calculate totals from reversal lines to ensure balance
        const reversalTotalDebit = reversalLines.reduce((sum, l) => sum + l.debitAmount, 0);
        const reversalTotalCredit = reversalLines.reduce((sum, l) => sum + l.creditAmount, 0);
        // Create reversal metadata
        const reversalMetadata = Object.assign(Object.assign({}, this.metadata), { reversalOfVoucherId: this.id, correctionGroupId, correctionReason: reason, originType: this.type, originVoucherNo: this.voucherNo, prefix: 'RV-' // Set prefix to RV- per user request
         });
        // Create new voucher entity for reversal
        return new VoucherEntity(reversalVoucherId, this.companyId, `RV-${this.voucherNo}`, // Use RV- prefix and original number
        VoucherTypes_1.VoucherType.REVERSAL, reversalDate, `Reversal of ${this.voucherNo}`, this.currency, this.baseCurrency, this.exchangeRate, reversalLines, reversalTotalDebit, reversalTotalCredit, VoucherTypes_1.VoucherStatus.DRAFT, reversalMetadata, userId, new Date(), undefined, // approvedBy
        undefined, // approvedAt
        undefined, // rejectedBy
        undefined, // rejectedAt
        reason, // rejectionReason (used as correction reason)
        undefined, // lockedBy
        undefined, // lockedAt
        undefined, // postedBy
        undefined, // postedAt
        undefined, // postingLockPolicy
        this.id, // reversalOfVoucherId (STRUCTURAL)
        undefined, // reference
        new Date() // updatedAt
        );
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
            postingLockPolicy: this.postingLockPolicy || null,
            reversalOfVoucherId: this.reversalOfVoucherId || null,
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
        var _a, _b;
        // Legacy support: ensure baseCurrency exists (default to USD if missing)
        const baseCurrency = data.baseCurrency || 'USD';
        // Naming normalization (handles legacy V1 vs modern V2)
        const id = data.id || data.voucherId;
        const voucherNo = data.voucherNo || data.voucherNumber || '';
        const reversalOfVoucherId = data.reversalOfVoucherId || ((_a = data.metadata) === null || _a === void 0 ? void 0 : _a.reversalOfVoucherId) || null;
        return new VoucherEntity(id, data.companyId, voucherNo, data.type, data.date, (_b = data.description) !== null && _b !== void 0 ? _b : '', data.currency, baseCurrency, data.exchangeRate, (data.lines || []).map((lineData) => VoucherLineEntity_1.VoucherLineEntity.fromJSON(lineData, baseCurrency)), data.totalDebit, data.totalCredit, data.status, data.metadata || {}, data.createdBy, new Date(data.createdAt), data.approvedBy, data.approvedAt ? new Date(data.approvedAt) : undefined, data.rejectedBy, data.rejectedAt ? new Date(data.rejectedAt) : undefined, data.rejectionReason, data.lockedBy, data.lockedAt ? new Date(data.lockedAt) : undefined, data.postedBy, data.postedAt ? new Date(data.postedAt) : undefined, data.postingLockPolicy, reversalOfVoucherId, 
        // Additional legacy fields
        data.reference, data.updatedAt ? new Date(data.updatedAt) : undefined);
    }
}
exports.VoucherEntity = VoucherEntity;
//# sourceMappingURL=VoucherEntity.js.map