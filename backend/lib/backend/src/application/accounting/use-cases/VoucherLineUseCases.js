"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveVoucherLineUseCase = exports.AddVoucherLineUseCase = exports.RecalculateVoucherTotalsUseCase = void 0;
// import { VoucherLine } from '../../../domain/accounting/entities/VoucherLine';
class RecalculateVoucherTotalsUseCase {
    constructor(voucherRepo) {
        this.voucherRepo = voucherRepo;
    }
    async execute(voucherId, lines) {
        // In a pure Clean Architecture, we would fetch lines from ILineRepo.
        // Here we accept them as arg or assume logic.
        const voucher = await this.voucherRepo.getVoucher(voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        let totalDebit = 0;
        let totalCredit = 0;
        lines.forEach(line => {
            const baseAmt = line.fxAmount * voucher.exchangeRate;
            if (baseAmt > 0)
                totalDebit += baseAmt;
            else
                totalCredit += Math.abs(baseAmt);
        });
        await this.voucherRepo.updateVoucher(voucherId, {
            totalDebit,
            totalCredit
        });
    }
}
exports.RecalculateVoucherTotalsUseCase = RecalculateVoucherTotalsUseCase;
class AddVoucherLineUseCase {
    constructor(_voucherRepo) {
        this._voucherRepo = _voucherRepo;
        void this._voucherRepo;
    }
    async execute() { }
}
exports.AddVoucherLineUseCase = AddVoucherLineUseCase;
class RemoveVoucherLineUseCase {
    constructor(_voucherRepo) {
        this._voucherRepo = _voucherRepo;
        void this._voucherRepo;
    }
    async execute() { }
}
exports.RemoveVoucherLineUseCase = RemoveVoucherLineUseCase;
//# sourceMappingURL=VoucherLineUseCases.js.map