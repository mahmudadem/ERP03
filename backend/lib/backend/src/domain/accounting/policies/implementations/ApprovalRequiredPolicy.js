"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalRequiredPolicy = void 0;
const VoucherTypes_1 = require("../../types/VoucherTypes");
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
class ApprovalRequiredPolicy {
    constructor() {
        this.id = 'approval-required';
        this.name = 'Approval Required';
    }
    validate(ctx) {
        // Check if voucher is approved
        if (ctx.status !== VoucherTypes_1.VoucherStatus.APPROVED) {
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
exports.ApprovalRequiredPolicy = ApprovalRequiredPolicy;
//# sourceMappingURL=ApprovalRequiredPolicy.js.map