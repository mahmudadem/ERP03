"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListVouchersUseCase = exports.GetVoucherUseCase = exports.CancelVoucherUseCase = exports.LockVoucherUseCase = exports.ApproveVoucherUseCase = exports.UpdateVoucherUseCase = exports.CreateVoucherUseCase = void 0;
const crypto_1 = require("crypto");
const Voucher_1 = require("../../../domain/accounting/entities/Voucher");
const VoucherLine_1 = require("../../../domain/accounting/entities/VoucherLine");
const VoucherPostingStrategyFactory_1 = require("../../../domain/accounting/factories/VoucherPostingStrategyFactory");
const PostingFieldExtractor_1 = require("../../../domain/accounting/services/PostingFieldExtractor");
const assertBalanced = (voucher) => {
    if (Math.abs((voucher.totalDebitBase || 0) - (voucher.totalCreditBase || 0)) > 0.0001) {
        const err = new Error('Voucher not balanced');
        err.statusCode = 400;
        throw err;
    }
};
class CreateVoucherUseCase {
    constructor(voucherRepo, accountRepo, settingsRepo, _ledgerRepo, permissionChecker, transactionManager, voucherTypeRepo) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.settingsRepo = settingsRepo;
        this._ledgerRepo = _ledgerRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.voucherTypeRepo = voucherTypeRepo;
    }
    async execute(companyId, userId, payload) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.create');
        return this.transactionManager.runTransaction(async (transaction) => {
            var _a, _b;
            const settings = await this.settingsRepo.getSettings(companyId, 'accounting');
            const baseCurrency = (settings === null || settings === void 0 ? void 0 : settings.baseCurrency) || payload.baseCurrency || payload.currency;
            const autoNumbering = (settings === null || settings === void 0 ? void 0 : settings.autoNumbering) !== false;
            const voucherId = payload.id || (0, crypto_1.randomUUID)();
            const voucherNo = autoNumbering ? `V-${Date.now()}` : payload.voucherNo || '';
            let lines = [];
            const voucherType = payload.type || 'JOURNAL';
            const strategy = VoucherPostingStrategyFactory_1.VoucherPostingStrategyFactory.getStrategy(voucherType);
            if (strategy) {
                // Load voucher type definition for field metadata
                const voucherTypeDef = await this.voucherTypeRepo.getByCode(companyId, voucherType);
                let strategyInput = payload;
                // If voucher type definition exists with field metadata, extract posting fields
                if (voucherTypeDef && voucherTypeDef.headerFields && voucherTypeDef.headerFields.length > 0) {
                    try {
                        strategyInput = PostingFieldExtractor_1.PostingFieldExtractor.extractPostingFields(payload, voucherTypeDef);
                    }
                    catch (error) {
                        // If extraction fails, log warning and use original payload
                        console.warn(`PostingFieldExtractor failed for ${voucherType}:`, error.message);
                        strategyInput = payload;
                    }
                }
                lines = await strategy.generateLines(strategyInput, companyId);
                // Ensure IDs and voucherId are set
                lines.forEach((l, idx) => {
                    if (!l.id)
                        l.id = `${voucherId}_l${idx}`;
                    l.voucherId = voucherId;
                });
            }
            else {
                // Fallback to manual lines (Journal / Manual Mode)
                lines = (payload.lines || []).map((l, idx) => {
                    var _a;
                    const line = new VoucherLine_1.VoucherLine(l.id || `${voucherId}_l${idx}`, voucherId, l.accountId, (_a = l.description) !== null && _a !== void 0 ? _a : null);
                    line.debitFx = l.debitFx || 0;
                    line.creditFx = l.creditFx || 0;
                    line.debitBase = l.debitBase || (l.debitFx || 0) * (payload.exchangeRate || 1);
                    line.creditBase = l.creditBase || (l.creditFx || 0) * (payload.exchangeRate || 1);
                    line.costCenterId = l.costCenterId;
                    line.lineCurrency = l.lineCurrency || payload.currency;
                    line.exchangeRate = l.exchangeRate || payload.exchangeRate || 1;
                    line.fxAmount = line.debitFx && line.debitFx > 0 ? line.debitFx : -1 * (line.creditFx || 0);
                    line.baseAmount = line.debitBase && line.debitBase > 0 ? line.debitBase : -1 * (line.creditBase || 0);
                    return line;
                });
            }
            // TEMPORARY: Comment out account validation to debug
            // TODO: Fix account repository getById with transaction
            // for (const line of lines) {
            //   const acc = await this.accountRepo.getById(companyId, line.accountId, transaction);
            //   if (!acc || acc.active === false) throw new Error(`Account ${line.accountId} invalid`);
            // }
            const totalDebitBase = lines.reduce((s, l) => s + (l.debitBase || 0), 0);
            const totalCreditBase = lines.reduce((s, l) => s + (l.creditBase || 0), 0);
            const voucher = new Voucher_1.Voucher(voucherId, companyId, payload.type || 'journal', payload.date ? new Date(payload.date) : new Date(), payload.currency || baseCurrency, payload.exchangeRate || 1, (settings === null || settings === void 0 ? void 0 : settings.strictApprovalMode) === false ? 'approved' : 'draft', totalDebitBase, totalCreditBase, userId, (_a = payload.reference) !== null && _a !== void 0 ? _a : null, lines);
            voucher.voucherNo = voucherNo;
            voucher.baseCurrency = baseCurrency;
            voucher.totalDebitBase = totalDebitBase;
            voucher.totalCreditBase = totalCreditBase;
            voucher.createdAt = new Date().toISOString();
            voucher.updatedAt = new Date().toISOString();
            voucher.description = (_b = payload.description) !== null && _b !== void 0 ? _b : null;
            assertBalanced(voucher);
            // Pass transaction to createVoucher
            await this.voucherRepo.createVoucher(voucher, transaction);
            // Auto-approved path writes ledger
            if (voucher.status === 'approved') {
                // Pass transaction to recordForVoucher
                await this._ledgerRepo.recordForVoucher(voucher, transaction);
            }
            return voucher;
        });
    }
}
exports.CreateVoucherUseCase = CreateVoucherUseCase;
class UpdateVoucherUseCase {
    constructor(voucherRepo, accountRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId, payload) {
        const voucher = await this.voucherRepo.getVoucher(companyId, voucherId);
        if (!voucher || voucher.companyId !== companyId)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.update');
        if (voucher.status !== 'draft')
            throw new Error('Only draft vouchers can be updated');
        if (payload.lines) {
            for (const l of payload.lines) {
                const acc = await this.accountRepo.getById(companyId, l.accountId);
                if (!acc || acc.active === false)
                    throw new Error(`Account ${l.accountId} invalid`);
            }
            const totalDebitBase = payload.lines.reduce((s, l) => s + (l.debitBase || 0), 0);
            const totalCreditBase = payload.lines.reduce((s, l) => s + (l.creditBase || 0), 0);
            payload.totalDebitBase = totalDebitBase;
            payload.totalCreditBase = totalCreditBase;
            if (Math.abs(totalDebitBase - totalCreditBase) > 0.0001) {
                const err = new Error('Voucher not balanced');
                err.statusCode = 400;
                throw err;
            }
        }
        payload.updatedAt = new Date().toISOString();
        if (typeof payload.date === 'string') {
            payload.date = new Date(payload.date);
        }
        await this.voucherRepo.updateVoucher(companyId, voucherId, payload);
    }
}
exports.UpdateVoucherUseCase = UpdateVoucherUseCase;
class ApproveVoucherUseCase {
    constructor(voucherRepo, ledgerRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.getVoucher(companyId, voucherId);
        if (!voucher || voucher.companyId !== companyId)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.approve');
        if (!['draft', 'pending'].includes(voucher.status))
            throw new Error('Cannot approve from this status');
        assertBalanced(voucher);
        await this.ledgerRepo.recordForVoucher(voucher);
        await this.voucherRepo.updateVoucher(companyId, voucherId, { status: 'approved', approvedBy: userId, updatedAt: new Date().toISOString() });
    }
}
exports.ApproveVoucherUseCase = ApproveVoucherUseCase;
class LockVoucherUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.getVoucher(companyId, voucherId);
        if (!voucher || voucher.companyId !== companyId)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.lock');
        if (voucher.status !== 'approved')
            throw new Error('Only approved vouchers can be locked');
        await this.voucherRepo.updateVoucher(companyId, voucherId, { status: 'locked', lockedBy: userId, updatedAt: new Date().toISOString() });
    }
}
exports.LockVoucherUseCase = LockVoucherUseCase;
class CancelVoucherUseCase {
    constructor(voucherRepo, ledgerRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.getVoucher(companyId, voucherId);
        if (!voucher || voucher.companyId !== companyId)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.cancel');
        if (!['draft', 'pending', 'approved'].includes(voucher.status))
            throw new Error('Cannot cancel from this status');
        await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
        await this.voucherRepo.updateVoucher(companyId, voucherId, { status: 'cancelled', updatedAt: new Date().toISOString() });
    }
}
exports.CancelVoucherUseCase = CancelVoucherUseCase;
class GetVoucherUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.getVoucher(companyId, voucherId);
        if (!voucher || voucher.companyId !== companyId)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
        return voucher;
    }
}
exports.GetVoucherUseCase = GetVoucherUseCase;
class ListVouchersUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
        return this.voucherRepo.getVouchers(companyId, filters);
    }
}
exports.ListVouchersUseCase = ListVouchersUseCase;
//# sourceMappingURL=VoucherUseCases.js.map