"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubledgerVoucherPostingService = void 0;
const crypto_1 = require("crypto");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherValidationService_1 = require("../../../domain/accounting/services/VoucherValidationService");
const VoucherPostingStrategyFactory_1 = require("../../../domain/accounting/factories/VoucherPostingStrategyFactory");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
class SubledgerVoucherPostingService {
    constructor(voucherRepo, ledgerRepo, companyCurrencyRepo, accountRepo, validationService) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.accountRepo = accountRepo;
        this.validationService = validationService || new VoucherValidationService_1.VoucherValidationService();
    }
    async postInTransaction(input, transaction) {
        const baseCurrency = ((await this.companyCurrencyRepo.getBaseCurrency(input.companyId))
            || input.currency
            || 'USD').toUpperCase();
        const voucherCurrency = (input.currency || baseCurrency).toUpperCase();
        const parsedRate = Number(input.exchangeRate);
        const effectiveExchangeRate = voucherCurrency === baseCurrency
            ? 1
            : (parsedRate > 0 ? parsedRate : 1);
        const strategy = VoucherPostingStrategyFactory_1.VoucherPostingStrategyFactory.getStrategy(input.voucherType);
        const strategyInput = Object.assign(Object.assign({}, (input.strategyPayload || {})), { currency: voucherCurrency, exchangeRate: effectiveExchangeRate, lines: input.lines || [] });
        const voucherLines = await strategy.generateLines(strategyInput, input.companyId, baseCurrency);
        if (voucherLines.length < 2) {
            throw new Error('Subledger voucher must have at least two lines');
        }
        const totalDebit = (0, VoucherLineEntity_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
        const totalCredit = (0, VoucherLineEntity_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
        if (Math.abs(totalDebit - totalCredit) > 0.001) {
            throw new Error(`Subledger voucher is not balanced: debit=${totalDebit}, credit=${totalCredit}`);
        }
        const now = new Date();
        const draftApprovedVoucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), input.companyId, input.voucherNo || `V-${Date.now()}`, input.voucherType, input.date, input.description || '', voucherCurrency, baseCurrency, effectiveExchangeRate, voucherLines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, input.metadata || {}, input.createdBy, now, input.createdBy, now, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, input.reference || null);
        const postedVoucher = draftApprovedVoucher.post(input.createdBy, now, input.postingLockPolicy || VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
        this.validationService.validateCore(postedVoucher);
        if (this.accountRepo) {
            await this.validationService.validateAccounts(postedVoucher, this.accountRepo);
        }
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        return postedVoucher;
    }
    async deleteVoucherInTransaction(companyId, voucherId, transaction) {
        if (!voucherId)
            return;
        await this.ledgerRepo.deleteForVoucher(companyId, voucherId, transaction);
        await this.voucherRepo.delete(companyId, voucherId, transaction);
    }
    async deleteVouchersInTransaction(companyId, voucherIds, transaction) {
        const uniqueIds = Array.from(new Set((voucherIds || []).filter((id) => !!id)));
        for (const voucherId of uniqueIds) {
            await this.deleteVoucherInTransaction(companyId, voucherId, transaction);
        }
    }
}
exports.SubledgerVoucherPostingService = SubledgerVoucherPostingService;
//# sourceMappingURL=SubledgerVoucherPostingService.js.map