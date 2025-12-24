import { VoucherType, VoucherStatus } from '../types/VoucherTypes';
import { VoucherLineEntity } from './VoucherLineEntity';

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
    
    // Metadata (Generic extra fields)
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
    public readonly lockedAt?: Date
  ) {
    // Invariant: Must have at least 2 lines (debit and credit)
    if (lines.length < 2) {
      throw new Error('Voucher must have at least 2 lines');
    }
    
    // Invariant: Debits must equal credits (within rounding tolerance)
    const calculatedDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const calculatedCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
    
    if (Math.abs(calculatedDebit - calculatedCredit) > 0.01) {
      throw new Error(
        `Voucher not balanced: Debit=${calculatedDebit}, Credit=${calculatedCredit}`
      );
    }
    
    // Invariant: Totals must match line totals
    if (Math.abs(totalDebit - calculatedDebit) > 0.01) {
      throw new Error('Total debit does not match sum of debit lines');
    }
    
    if (Math.abs(totalCredit - calculatedCredit) > 0.01) {
      throw new Error('Total credit does not match sum of credit lines');
    }
    
    // Invariant: All lines must use the same currencies
    const invalidLines = lines.filter(
      line => line.currency !== currency || line.baseCurrency !== baseCurrency
    );
    
    if (invalidLines.length > 0) {
      throw new Error('All lines must use the same transaction and base currency');
    }
  }

  /**
   * Check if voucher is balanced
   */
  get isBalanced(): boolean {
    return Math.abs(this.totalDebit - this.totalCredit) < 0.01;
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
   * Check if voucher can be edited
   */
  get canEdit(): boolean {
    return this.isDraft || this.isRejected;
  }

  /**
   * Check if voucher can be approved
   */
  get canApprove(): boolean {
    return this.isDraft;
  }

  /**
   * Check if voucher can be locked
   */
  get canLock(): boolean {
    return this.isApproved;
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
      lockedBy,
      lockedAt
    );
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
      lockedAt: this.lockedAt?.toISOString() || null
    };
  }

  /**
   * Create from plain object (for deserialization)
   */
  static fromJSON(data: any): VoucherEntity {
    return new VoucherEntity(
      data.id,
      data.companyId,
      data.voucherNo,
      data.type as VoucherType,
      data.date,
      data.description,
      data.currency,
      data.baseCurrency,
      data.exchangeRate,
      (data.lines || []).map((lineData: any) => VoucherLineEntity.fromJSON(lineData)),
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
      data.lockedAt ? new Date(data.lockedAt) : undefined
    );
  }
}
