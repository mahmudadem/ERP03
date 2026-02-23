"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateFXRevaluationVoucherUseCase = void 0;
const VoucherPostingStrategyFactory_1 = require("../../../domain/accounting/factories/VoucherPostingStrategyFactory");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const crypto_1 = require("crypto");
class GenerateFXRevaluationVoucherUseCase {
    constructor(voucherRepo, companyRepo) {
        this.voucherRepo = voucherRepo;
        this.companyRepo = companyRepo;
    }
    /**
     * Generates a DRAFT voucher for the FX Revaluation results.
     */
    async execute(companyId, userId, calculationResult, targetGainLossAccountId) {
        // 1. Validate Company
        const company = await this.companyRepo.findById(companyId);
        if (!company) {
            throw new Error('Company not found');
        }
        // 2. Prepare the payload for the Strategy
        const strategyPayload = {
            lines: calculationResult.lines,
            targetAccountId: targetGainLossAccountId,
        };
        // 3. Get the Strategy and generate Ledger Lines
        const strategy = VoucherPostingStrategyFactory_1.VoucherPostingStrategyFactory.getStrategy('fx_revaluation');
        const ledgerLines = await strategy.generateLines(strategyPayload, companyId, company.baseCurrency);
        // 4. Calculate total base amount for the voucher header
        const totalDebitBase = ledgerLines.reduce((sum, line) => sum + line.debitAmount, 0);
        const totalCreditBase = ledgerLines.reduce((sum, line) => sum + line.creditAmount, 0);
        // 5. Create the Voucher Entity
        const voucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), // id
        companyId, // companyId
        `FX-REV-${calculationResult.asOfDate.toISOString().split('T')[0]}`, // voucherNo
        VoucherTypes_1.VoucherType.FX_REVALUATION, // type
        calculationResult.asOfDate.toISOString().split('T')[0], // date
        `FX Revaluation as of ${calculationResult.asOfDate.toISOString().split('T')[0]}`, // description
        company.baseCurrency, // currency
        company.baseCurrency, // baseCurrency
        1.0, // exchangeRate
        ledgerLines, // lines
        totalDebitBase, // totalDebit
        totalCreditBase, // totalCredit
        VoucherTypes_1.VoucherStatus.DRAFT, // status
        { formId: 'fx_revaluation' }, // metadata
        userId, // createdBy
        new Date() // createdAt
        );
        // 6. Save to DB using the repository
        await this.voucherRepo.save(voucher);
        return {
            success: true,
            voucherId: voucher.id,
            voucherNo: voucher.voucherNo,
            status: voucher.status,
            message: 'Draft FX Revaluation voucher created successfully'
        };
    }
}
exports.GenerateFXRevaluationVoucherUseCase = GenerateFXRevaluationVoucherUseCase;
//# sourceMappingURL=GenerateFXRevaluationVoucherUseCase.js.map