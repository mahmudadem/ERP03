"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmCustodyUseCase = void 0;
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
/**
 * Confirm Custody Use Case
 *
 * Satisfies the Custody Confirmation gate for a specific custodian.
 * If all gates (including FA) are satisfied, transitions voucher to APPROVED.
 */
class ConfirmCustodyUseCase {
    constructor(voucherRepository, approvalPolicyService) {
        this.voucherRepository = voucherRepository;
        this.approvalPolicyService = approvalPolicyService;
    }
    /**
     * Confirm custody for a voucher
     *
     * @param companyId Company ID
     * @param voucherId Voucher ID
     * @param custodianUserId User ID of the custodian confirming
     * @returns Updated voucher entity
     */
    async execute(companyId, voucherId, custodianUserId) {
        var _a, _b;
        // 1. Load voucher
        const voucher = await this.voucherRepository.findById(companyId, voucherId);
        if (!voucher) {
            throw new Error(`Voucher not found: ${voucherId}`);
        }
        // 2. Validate status
        if (voucher.status !== VoucherTypes_1.VoucherStatus.PENDING) {
            throw new Error(`Cannot confirm custody for voucher in status "${voucher.status}"`);
        }
        // 3. Verify this user IS a pending custodian
        const pendingCustodians = ((_a = voucher.metadata) === null || _a === void 0 ? void 0 : _a.pendingCustodyConfirmations) || [];
        if (!pendingCustodians.includes(custodianUserId)) {
            throw new Error('User is not a pending custodian for this voucher');
        }
        // 4. Calculate if fully satisfied after this confirmation
        // We check if FA is pending and if OTHER custodians are pending
        const isFAPending = !!((_b = voucher.metadata) === null || _b === void 0 ? void 0 : _b.pendingFinancialApproval);
        const otherCustodiansPending = pendingCustodians.filter((id) => id !== custodianUserId).length > 0;
        const isFullySatisfied = !isFAPending && !otherCustodiansPending;
        // 5. Update entity
        const updatedVoucher = voucher.confirmCustody(custodianUserId, new Date(), isFullySatisfied);
        // 6. Save
        return await this.voucherRepository.save(updatedVoucher);
    }
}
exports.ConfirmCustodyUseCase = ConfirmCustodyUseCase;
//# sourceMappingURL=ConfirmCustodyUseCase.js.map