import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { ApprovalPolicyService } from '../../../domain/accounting/policies/ApprovalPolicyService';
import { NotificationService } from '../../system/services/NotificationService';

/**
 * Confirm Custody Use Case
 * 
 * Satisfies the Custody Confirmation gate for a specific custodian.
 * If all gates (including FA) are satisfied, transitions voucher to APPROVED.
 * Notifies the submitter when all gates are cleared.
 */
export class ConfirmCustodyUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly approvalPolicyService: ApprovalPolicyService,
    private readonly notificationService?: NotificationService
  ) {}

  /**
   * Confirm custody for a voucher
   * 
   * @param companyId Company ID
   * @param voucherId Voucher ID
   * @param custodianUserId User ID of the custodian confirming
   * @returns Updated voucher entity
   */
  async execute(
    companyId: string,
    voucherId: string,
    custodianUserId: string,
    custodianUserEmail?: string
  ): Promise<VoucherEntity> {
    // 1. Load voucher
    const voucher = await this.voucherRepository.findById(companyId, voucherId);
    
    if (!voucher) {
      throw new Error(`Voucher not found: ${voucherId}`);
    }

    // 2. Validate status
    if (voucher.status !== VoucherStatus.PENDING) {
      throw new Error(`Cannot confirm custody for voucher in status "${voucher.status}"`);
    }

    // 3. Verify this user IS a pending custodian
    const pendingCustodians = voucher.metadata?.pendingCustodyConfirmations || [];
    // Case-insensitive check for ID or Email
    const isPending = pendingCustodians.some(id => 
      id.toLowerCase() === custodianUserId.toLowerCase() ||
      (custodianUserEmail && id.toLowerCase() === custodianUserEmail.toLowerCase())
    );
    if (!isPending) {
      throw new Error(`User is not a pending custodian. MeID=${custodianUserId}, MeEmail=${custodianUserEmail}, Pending=${pendingCustodians.join(',')}`);
    }

    // 4. Calculate if fully satisfied after this confirmation
    // 4. Calculate if fully satisfied after this confirmation
    const isFAPending = !!voucher.metadata?.pendingFinancialApproval;
    
    // Check if there are OTHER custodians pending (excluding me via ID or Email)
    const otherCustodiansPending = pendingCustodians.some((id: string) => {
      const isMe = id.toLowerCase() === custodianUserId.toLowerCase() ||
                   (custodianUserEmail && id.toLowerCase() === custodianUserEmail.toLowerCase());
      return !isMe;
    });
    
    const isFullySatisfied = !isFAPending && !otherCustodiansPending;

    // 5. Update entity
    const updatedVoucher = voucher.confirmCustody(custodianUserId, new Date(), isFullySatisfied, custodianUserEmail);

    // 6. Save
    const savedVoucher = await this.voucherRepository.save(updatedVoucher);

    // 7. Notify submitter if all gates are cleared
    if (isFullySatisfied && this.notificationService) {
      const submitterId = voucher.metadata?.submittedBy;
      if (submitterId) {
        const voucherNo = voucher.voucherNo || voucher.id.slice(0, 8);
        this.notificationService.notifyVoucherAction(
          companyId,
          [submitterId],
          voucherNo,
          voucher.id,
          'APPROVED'
        ).catch(() => {
          console.error('[ConfirmCustodyUseCase] Notification dispatch failed');
        });
      }
    }

    return savedVoucher;
  }
}
