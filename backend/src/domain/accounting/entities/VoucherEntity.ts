import { VoucherType, VoucherStatus } from '../types/VoucherTypes';
import { VoucherLineEntity, MONEY_EPS, moneyEquals } from './VoucherLineEntity';


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
export class VoucherEntity {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly voucherNo: string,
    public readonly type: VoucherType,
    public readonly date: string,  // ISO date string (YYYY-MM-DD)
    public readonly description: string,
    
    // Currency
    public readonly currency: string,
    public readonly baseCurrency: string,
    public readonly exchangeRate: number,
    
    // Lines (aggregate)
    public readonly lines: readonly VoucherLineEntity[],
    
    // Calculated totals (in base currency)
    public readonly totalDebit: number,
    public readonly totalCredit: number,
    
    // State
    public readonly status: VoucherStatus,
    
    // Metadata (Generic extra fields - includes formId, prefix, sourceModule)
    public readonly metadata: Record<string, any> = {},
    
    // Audit trail
    public readonly createdBy: string,
    public readonly createdAt: Date,
    public readonly approvedBy?: string,
    public readonly approvedAt?: Date,
    public readonly rejectedBy?: string,
    public readonly rejectedAt?: Date,
    public readonly rejectionReason?: string,
    public readonly lockedBy?: string,
    public readonly lockedAt?: Date,
    public readonly postedBy?: string,
    public readonly postedAt?: Date,
    
    // Additional fields migrated from legacy
    public readonly reference?: string | null,     // External reference (invoice #, check #, etc.)
    public readonly updatedAt?: Date | null        // Last modification timestamp
  ) {
    // Invariant: Must have at least 2 lines (debit and credit)
    if (lines.length < 2) {
      throw new Error('Voucher must have at least 2 lines');
    }
    
    // Invariant: Debits must equal credits IN BASE CURRENCY (within MONEY_EPS tolerance)
    // This is the core accounting invariant - balancing is ALWAYS on baseAmount
    const calculatedDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const calculatedCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
    
    if (!moneyEquals(calculatedDebit, calculatedCredit)) {
      throw new Error(
        `Voucher not balanced in base currency: Debit=${calculatedDebit}, Credit=${calculatedCredit}`
      );
    }
    
    // Invariant: Totals must match line totals
    if (!moneyEquals(totalDebit, calculatedDebit)) {
      throw new Error('Total debit does not match sum of debit lines');
    }
    
    if (!moneyEquals(totalCredit, calculatedCredit)) {
      throw new Error('Total credit does not match sum of credit lines');
    }
    
    // Invariant: All lines must use the SAME baseCurrency (company base currency)
    // NOTE: FX currencies (line.currency) may differ - mixed FX is allowed
    const invalidBaseLines = lines.filter(line => line.baseCurrency !== baseCurrency);
    
    if (invalidBaseLines.length > 0) {
      throw new Error(
        `All lines must use the same base currency (${baseCurrency}). ` +
        `Found lines with: ${[...new Set(invalidBaseLines.map(l => l.baseCurrency))].join(', ')}`
      );
    }
  }

  // ========== Convenience getters for metadata fields ==========
  
  /** Source module that created this voucher (accounting, pos, inventory, hr) */
  get sourceModule(): string | undefined {
    return this.metadata?.sourceModule;
  }
  
  /** Form/template ID used to create this voucher */
  get formId(): string | undefined {
    return this.metadata?.formId;
  }
  
  /** Voucher number prefix (JE-, PV-, RV-, etc.) */
  get prefix(): string | undefined {
    return this.metadata?.prefix;
  }

  /** Total debit in base currency (same as totalDebit for now) */
  get totalDebitBase(): number {
    return this.totalDebit;
  }

  /** Total credit in base currency (same as totalCredit for now) */
  get totalCreditBase(): number {
    return this.totalCredit;
  }


  /**
   * Check if voucher is balanced (within MONEY_EPS tolerance)
   */
  get isBalanced(): boolean {
    return moneyEquals(this.totalDebit, this.totalCredit);
  }

  /**
   * Check if voucher is in draft state
   */
  get isDraft(): boolean {
    return this.status === VoucherStatus.DRAFT;
  }

  /**
   * Check if voucher is approved
   */
  get isApproved(): boolean {
    return this.status === VoucherStatus.APPROVED;
  }

  /**
   * Check if voucher is posted to ledger
   */
  get isPosted(): boolean {
    return this.status === VoucherStatus.POSTED;
  }

  /**
   * Check if voucher is locked
   */
  get isLocked(): boolean {
    return this.status === VoucherStatus.LOCKED;
  }

  /**
   * Check if voucher is rejected
   */
  get isRejected(): boolean {
    return this.status === VoucherStatus.REJECTED;
  }

  /**
   * Check if voucher is pending approval
   */
  get isPending(): boolean {
    return this.status === VoucherStatus.PENDING;
  }

  /**
   * Check if voucher can be edited.
   * - DRAFT/REJECTED: Always editable.
   * - PENDING: Editable (will trigger 'Edited' marker).
   * - POSTED/LOCKED: Immutable (unless policy allows correction/re-post).
   */
  get canEdit(): boolean {
    return this.isDraft || this.isRejected || this.isPending;
  }

  /**
   * Check if voucher can be approved
   */
  get canApprove(): boolean {
    return this.isPending; // Only PENDING vouchers can be approved
  }

  /**
   * Check if voucher can be posted
   */
  get canPost(): boolean {
    return this.isDraft || this.isApproved;
  }

  /**
   * Check if voucher can be locked
   */
  get canLock(): boolean {
    return this.isPosted;
  }

  /**
   * Check if voucher involves foreign currency
   */
  get isForeignCurrency(): boolean {
    return this.currency !== this.baseCurrency;
  }

  /**
   * Create approved version (immutable update)
   */
  approve(approvedBy: string, approvedAt: Date): VoucherEntity {
    if (!this.canApprove) {
      throw new Error(`Cannot approve voucher in status: ${this.status}`);
    }
    
    return new VoucherEntity(
      this.id,
      this.companyId,
      this.voucherNo,
      this.type,
      this.date,
      this.description,
      this.currency,
      this.baseCurrency,
      this.exchangeRate,
      this.lines,
      this.totalDebit,
      this.totalCredit,
      VoucherStatus.APPROVED,
      this.metadata,
      this.createdBy,
      this.createdAt,
      approvedBy,
      approvedAt,
      undefined,
      undefined,
      undefined,
      this.lockedBy,
      this.lockedAt
    );
  }

  /**
   * Create rejected version (immutable update)
   */
  reject(rejectedBy: string, rejectedAt: Date, reason: string): VoucherEntity {
    if (!this.isDraft && !this.isApproved) {
      throw new Error(`Cannot reject voucher in status: ${this.status}`);
    }
    
    return new VoucherEntity(
      this.id,
      this.companyId,
      this.voucherNo,
      this.type,
      this.date,
      this.description,
      this.currency,
      this.baseCurrency,
      this.exchangeRate,
      this.lines,
      this.totalDebit,
      this.totalCredit,
      VoucherStatus.REJECTED,
      this.metadata,
      this.createdBy,
      this.createdAt,
      this.approvedBy,
      this.approvedAt,
      rejectedBy,
      rejectedAt,
      reason,
      this.lockedBy,
      this.lockedAt
    );
  }

  /**
   * Create posted version (immutable update)
   */
  post(postedBy: string, postedAt: Date): VoucherEntity {
    if (!this.canPost) {
      throw new Error(`Cannot post voucher in status: ${this.status}`);
    }

    return new VoucherEntity(
      this.id,
      this.companyId,
      this.voucherNo,
      this.type,
      this.date,
      this.description,
      this.currency,
      this.baseCurrency,
      this.exchangeRate,
      this.lines,
      this.totalDebit,
      this.totalCredit,
      VoucherStatus.POSTED,
      this.metadata,
      this.createdBy,
      this.createdAt,
      this.approvedBy,
      this.approvedAt,
      this.rejectedBy,
      this.rejectedAt,
      this.rejectionReason,
      this.lockedBy,
      this.lockedAt,
      postedBy,
      postedAt
    );
  }

  /**
   * Mark voucher as edited (immutable update).
   * Used for PENDING vouchers to show a badge indicating they were modified after submission.
   */
  markAsEdited(): VoucherEntity {
    return new VoucherEntity(
      this.id,
      this.companyId,
      this.voucherNo,
      this.type,
      this.date,
      this.description,
      this.currency,
      this.baseCurrency,
      this.exchangeRate,
      this.lines,
      this.totalDebit,
      this.totalCredit,
      this.status,
      { ...this.metadata, isEdited: true },
      this.createdBy,
      this.createdAt,
      this.approvedBy,
      this.approvedAt,
      this.rejectedBy,
      this.rejectedAt,
      this.rejectionReason,
      this.lockedBy,
      this.lockedAt,
      this.postedBy,
      this.postedAt,
      this.reference,
      new Date() // UpdatedAt
    );
  }

  /**
   * Create locked version (immutable update)
   */
  lock(lockedBy: string, lockedAt: Date): VoucherEntity {
    if (!this.canLock) {
      throw new Error(`Cannot lock voucher in status: ${this.status}`);
    }

    return new VoucherEntity(
      this.id,
      this.companyId,
      this.voucherNo,
      this.type,
      this.date,
      this.description,
      this.currency,
      this.baseCurrency,
      this.exchangeRate,
      this.lines,
      this.totalDebit,
      this.totalCredit,
      VoucherStatus.LOCKED,
      this.metadata,
      this.createdBy,
      this.createdAt,
      this.approvedBy,
      this.approvedAt,
      this.rejectedBy,
      this.rejectedAt,
      this.rejectionReason,
      this.lockedBy,
      this.lockedAt,
      this.postedBy,
      this.postedAt
    );
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
  createReversal(
    reversalDate: string,
    correctionGroupId: string,
    userId: string, // Required for createdBy
    reason?: string
  ): VoucherEntity {
    if (this.status !== VoucherStatus.POSTED) {
      throw new Error('Only POSTED vouchers can be reversed');
    }

    // Generate reversal lines by swapping debits/credits
    const reversalLines = this.lines.map((line, index) => 
      new VoucherLineEntity(
        index + 1, // Re-index from 1
        line.accountId,
        line.side === 'Debit' ? 'Credit' : 'Debit', // Opposite side
        line.baseAmount,     // baseAmount stays the same
        line.baseCurrency,   // baseCurrency
        line.amount,         // amount stays the same
        line.currency,       // currency
        line.exchangeRate
      )
    );

    // Swap totals as well
    const reversalTotalDebit = this.totalCredit;
    const reversalTotalCredit = this.totalDebit;

    // Create reversal metadata
    const reversalMetadata = {
      ...this.metadata,
      reversalOfVoucherId: this.id,
      correctionGroupId,
      correctionReason: reason
    };

    // Create new voucher entity for reversal
    return new VoucherEntity(
      '', // ID will be generated when saved
      this.companyId,
      '', // Voucher number will be generated
      this.type,
      reversalDate,
      `Reversal of ${this.voucherNo}`,
      this.currency,
      this.baseCurrency,
      this.exchangeRate,
      reversalLines,
      reversalTotalDebit,
      reversalTotalCredit,
      VoucherStatus.DRAFT,
      reversalMetadata,
      userId,
      new Date()
    );
  }

  /**
   * Check if this voucher is a reversal
   */
  get isReversal(): boolean {
    return !!this.metadata.reversalOfVoucherId;
  }

  /**
   * Check if this voucher is a replacement
   */
  get isReplacement(): boolean {
    return !!this.metadata.replacesVoucherId;
  }

  /**
   * Get correction group ID if this voucher is part of a correction
   */
  get correctionGroupId(): string | undefined {
    return this.metadata.correctionGroupId;
  }

  /**
   * Convert to plain object for persistence
   */
  toJSON(): Record<string, any> {
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
      approvedAt: this.approvedAt?.toISOString() || null,
      rejectedBy: this.rejectedBy || null,
      rejectedAt: this.rejectedAt?.toISOString() || null,
      rejectionReason: this.rejectionReason || null,
      lockedBy: this.lockedBy || null,
      lockedAt: this.lockedAt?.toISOString() || null,
      postedBy: this.postedBy || null,
      postedAt: this.postedAt?.toISOString() || null,
      // Legacy fields
      reference: this.reference || null,
      updatedAt: this.updatedAt?.toISOString() || null,
      // Metadata convenience fields (also in metadata object)
      sourceModule: this.sourceModule || null,
      formId: this.formId || null,
      prefix: this.prefix || null
    };
  }

  /**
   * Create from plain object (for deserialization)
   */
  static fromJSON(data: any): VoucherEntity {
    // Legacy support: ensure baseCurrency exists (default to USD if missing)
    const baseCurrency = data.baseCurrency || 'USD';

    return new VoucherEntity(
      data.id,
      data.companyId,
      data.voucherNo,
      data.type as VoucherType,
      data.date,
      data.description ?? '',
      data.currency,
      baseCurrency,
      data.exchangeRate,
      (data.lines || []).map((lineData: any) => VoucherLineEntity.fromJSON(lineData, baseCurrency)),
      data.totalDebit,
      data.totalCredit,
      data.status as VoucherStatus,
      data.metadata || {},
      data.createdBy,
      new Date(data.createdAt),
      data.approvedBy,
      data.approvedAt ? new Date(data.approvedAt) : undefined,
      data.rejectedBy,
      data.rejectedAt ? new Date(data.rejectedAt) : undefined,
      data.rejectionReason,
      data.lockedBy,
      data.lockedAt ? new Date(data.lockedAt) : undefined,
      data.postedBy,
      data.postedAt ? new Date(data.postedAt) : undefined,
      // Additional legacy fields
      data.reference,
      data.updatedAt ? new Date(data.updatedAt) : undefined
    );
  }
}
