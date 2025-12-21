import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';

/**
 * Approve Voucher Use Case
 * 
 * ADR-005 Compliant - Simple State Transition
 * 
 * This implements the simplest possible approval:
 * DRAFT → APPROVED
 * 
 * No workflow engine. No conditional logic. No approval chains.
 * Just state transition with audit trail.
 * 
 * Principles:
 * - Voucher must be in DRAFT status
 * - Transition to APPROVED status
 * - Record who approved and when
 * - Immutable - creates new voucher entity
 * 
 * Future enhancement: Add permission check (who can approve)
 */
export class ApproveVoucherUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository
  ) {}

  /**
   * Approve a voucher
   * 
   * @param companyId Company ID
   * @param voucherId Voucher ID to approve
   * @param approverId User ID of approver
   * @returns Approved voucher entity
   * @throws Error if voucher not found or cannot be approved
   */
  async execute(
    companyId: string,
    voucherId: string,
    approverId: string
  ): Promise<VoucherEntity> {
    // Step 1: Load voucher
    const voucher = await this.voucherRepository.findById(companyId, voucherId);
    
    if (!voucher) {
      throw new Error(`Voucher not found: ${voucherId}`);
    }

    // Step 2: Validate can approve
    if (!voucher.canApprove) {
      throw new Error(
        `Cannot approve voucher in status "${voucher.status}". ` +
        `Voucher must be in DRAFT status.`
      );
    }

    // Step 3: Create approved version (immutable)
    const approvedVoucher = voucher.approve(approverId, new Date());

    // Step 4: Save approved version
    const savedVoucher = await this.voucherRepository.save(approvedVoucher);

    return savedVoucher;
  }
}

/**
 * Reject Voucher Use Case
 * 
 * ADR-005 Compliant - Simple State Transition
 * 
 * Transitions voucher to REJECTED status with reason.
 */
export class RejectVoucherUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository
  ) {}

  /**
   * Reject a voucher
   * 
   * @param companyId Company ID
   * @param voucherId Voucher ID to reject
   * @param rejecterId User ID of rejecter
   * @param reason Rejection reason
   * @returns Rejected voucher entity
   */
  async execute(
    companyId: string,
    voucherId: string,
    rejecterId: string,
    reason: string
  ): Promise<VoucherEntity> {
    // Validate reason provided
    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Load voucher
    const voucher = await this.voucherRepository.findById(companyId, voucherId);
    
    if (!voucher) {
      throw new Error(`Voucher not found: ${voucherId}`);
    }

    // Validate can reject (can reject DRAFT or APPROVED)
    if (voucher.isLocked) {
      throw new Error('Cannot reject locked voucher');
    }

    if (voucher.isRejected) {
      throw new Error('Voucher is already rejected');
    }

    // Create rejected version
    const rejectedVoucher = voucher.reject(rejecterId, new Date(), reason);

    // Save
    const savedVoucher = await this.voucherRepository.save(rejectedVoucher);

    return savedVoucher;
  }
}

/**
 * Lock Voucher Use Case
 * 
 * ADR-005 Compliant - Simple State Transition
 * 
 * Locks an approved voucher (for period close).
 * APPROVED → LOCKED
 */
export class LockVoucherUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository
  ) {}

  /**
   * Lock a voucher
   * 
   * @param companyId Company ID
   * @param voucherId Voucher ID to lock
   * @param lockerId User ID performing lock
   * @returns Locked voucher entity
   */
  async execute(
    companyId: string,
    voucherId: string,
    lockerId: string
  ): Promise<VoucherEntity> {
    // Load voucher
    const voucher = await this.voucherRepository.findById(companyId, voucherId);
    
    if (!voucher) {
      throw new Error(`Voucher not found: ${voucherId}`);
    }

    // Validate can lock
    if (!voucher.canLock) {
      throw new Error(
        `Cannot lock voucher in status "${voucher.status}". ` +
        `Voucher must be APPROVED before locking.`
      );
    }

    // Create locked version
    const lockedVoucher = voucher.lock(lockerId, new Date());

    // Save
    const savedVoucher = await this.voucherRepository.save(lockedVoucher);

    return savedVoucher;
  }
}
