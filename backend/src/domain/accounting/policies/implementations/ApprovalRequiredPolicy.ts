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

  /**
   * @param exemptVoucherTypes voucher types that skip the approval requirement (per-type scope,
   *   owned by Accounting). Empty -> all types are subject to approval (safe-by-default).
   */
  constructor(private readonly exemptVoucherTypes: string[] = []) {}

  validate(ctx: PostingPolicyContext): PolicyResult {
    // Per-type scope: exempt voucher types skip the approval requirement entirely.
    if (this.exemptVoucherTypes.includes(ctx.voucherType)) {
      return { ok: true };
    }

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
