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
    // Load voucher
    const voucher = await this.voucherRepository.findById(companyId, voucherId);
    
    if (!voucher) {
      throw new Error(`Voucher not found: ${voucherId}`);
    }

    // V2: Structural Guard (Hard Lock)
    voucher.assertCanMutate();

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

    // V2: Structural Guard (Hard Lock)
    voucher.assertCanMutate();

    // V1: Cannot reject posted vouchers (they have financial effect)\n    if (voucher.isPosted) {\n      throw new Error('Cannot reject a posted voucher. Use reversal instead.');\n    }

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
 * V1 DEPRECATED: Per-voucher locking is replaced by period locking.
 * Use lockedThroughDate in company settings to lock all vouchers up to a date.
 */
export class LockVoucherUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository
  ) {}

  /**
   * V1 DEPRECATED: Use lockedThroughDate in company settings instead.
   */
  async execute(
    companyId: string,
    voucherId: string,
    lockerId: string
  ): Promise<VoucherEntity> {
    throw new Error(
      'LockVoucherUseCase is deprecated in V1. ' +
      'Use lockedThroughDate in company settings to lock periods.'
    );
  }
}
