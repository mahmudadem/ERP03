"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveVoucherLineUseCase = exports.AddVoucherLineUseCase = exports.RecalculateVoucherTotalsUseCase = void 0;
/**
 * RecalculateVoucherTotalsUseCase
 *
 * Note: With VoucherEntity (V2), totals are calculated in the constructor
 * and the entity is immutable. This use case may need to be redesigned
 * or removed as totals are always consistent with lines.
 */
class RecalculateVoucherTotalsUseCase {
    constructor(voucherRepo) {
        this.voucherRepo = voucherRepo;
    }
    async execute(companyId, voucherId, _lines) {
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        // V2 VoucherEntity already has correct totals computed from lines
        // This use case is now a no-op since V2 entities are self-validating
        // If you need to update, you create a new entity with updated lines
        console.log('[RecalculateVoucherTotalsUseCase] V2 entities auto-calculate totals. No action needed.');
    }
}
exports.RecalculateVoucherTotalsUseCase = RecalculateVoucherTotalsUseCase;
class AddVoucherLineUseCase {
    constructor(_voucherRepo) {
        this._voucherRepo = _voucherRepo;
        void this._voucherRepo;
    }
    async execute() {
        // Placeholder - V2 entities are immutable, add line by creating new entity
    }
}
exports.AddVoucherLineUseCase = AddVoucherLineUseCase;
class RemoveVoucherLineUseCase {
    constructor(_voucherRepo) {
        this._voucherRepo = _voucherRepo;
        void this._voucherRepo;
    }
    async execute() {
        // Placeholder - V2 entities are immutable, remove line by creating new entity
    }
}
exports.RemoveVoucherLineUseCase = RemoveVoucherLineUseCase;
//# sourceMappingURL=VoucherLineUseCases.js.map