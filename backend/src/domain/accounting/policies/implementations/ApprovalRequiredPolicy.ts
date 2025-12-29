import { IPostingPolicy } from '../IPostingPolicy';
import { PostingPolicyContext, PolicyResult } from '../PostingPolicyTypes';
import { VoucherStatus } from '../../types/VoucherTypes';

/**
 * ApprovalRequiredPolicy
 * 
 * Enforces that vouchers must be approved before posting.
 * 
 * When enabled:
 * - Vouchers in DRAFT status cannot be posted
 * - Vouchers must transition to APPROVED status first (via ApproveVoucherUseCase)
 * - Only then can PostVoucherUseCase create financial impact
 * 
 * This separates approval workflow from ledger persistence.
 */
export class ApprovalRequiredPolicy implements IPostingPolicy {
  readonly id = 'approval-required';
  readonly name = 'Approval Required';

  validate(ctx: PostingPolicyContext): PolicyResult {
    // Check if voucher is approved
    if (ctx.status !== VoucherStatus.APPROVED) {
      return {
        ok: false,
        error: {
          code: 'APPROVAL_REQUIRED',
          message: `Voucher must be approved before posting. Current status: ${ctx.status}`,
          fieldHints: ['status', 'approvedBy']
        }
      };
    }

    return { ok: true };
  }
}
