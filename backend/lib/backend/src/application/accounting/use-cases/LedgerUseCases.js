"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetJournalUseCase = exports.GetGeneralLedgerUseCase = exports.GetTrialBalanceUseCase = exports.DeleteVoucherLedgerUseCase = void 0;
/**
 * DeleteVoucherLedgerUseCase
 *
 * Removes ledger entries for a voucher.
 * CAUTION: Should only be used for corrections/unposting where allowed by policy.
 * Standard accounting practice prefers reversal entries.
 */
class DeleteVoucherLedgerUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.cancel');
        await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    }
}
exports.DeleteVoucherLedgerUseCase = DeleteVoucherLedgerUseCase;
class GetTrialBalanceUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, asOfDate) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'report.trialBalance');
        return this.ledgerRepo.getTrialBalance(companyId, asOfDate);
    }
}
exports.GetTrialBalanceUseCase = GetTrialBalanceUseCase;
class GetGeneralLedgerUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'report.generalLedger');
        return this.ledgerRepo.getGeneralLedger(companyId, filters);
    }
}
exports.GetGeneralLedgerUseCase = GetGeneralLedgerUseCase;
class GetJournalUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'report.journal');
        return this.ledgerRepo.getGeneralLedger(companyId, filters);
    }
}
exports.GetJournalUseCase = GetJournalUseCase;
//# sourceMappingURL=LedgerUseCases.js.map