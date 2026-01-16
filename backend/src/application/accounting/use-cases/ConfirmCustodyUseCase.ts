import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { ApprovalPolicyService } from '../../../domain/accounting/policies/ApprovalPolicyService';

/**
 * Confirm Custody Use Case
 * 
 * Satisfies the Custody Confirmation gate for a specific custodian.
 * If all gates (including FA) are satisfied, transitions voucher to APPROVED.
 */
export class ConfirmCustodyUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly approvalPolicyService: ApprovalPolicyService
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
    custodianUserId: string
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
    if (!pendingCustodians.includes(custodianUserId)) {
      throw new Error('User is not a pending custodian for this voucher');
    }

    // 4. Calculate if fully satisfied after this confirmation
    // We check if FA is pending and if OTHER custodians are pending
    const isFAPending = !!voucher.metadata?.pendingFinancialApproval;
    const otherCustodiansPending = pendingCustodians.filter((id: string) => id !== custodianUserId).length > 0;
    
    const isFullySatisfied = !isFAPending && !otherCustodiansPending;

    // 5. Update entity
    const updatedVoucher = voucher.confirmCustody(custodianUserId, new Date(), isFullySatisfied);

    // 6. Save
    return await this.voucherRepository.save(updatedVoucher);
  }
}
