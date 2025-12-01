"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetJournalUseCase = exports.GetGeneralLedgerUseCase = exports.GetTrialBalanceUseCase = exports.DeleteVoucherLedgerUseCase = exports.RecordVoucherLedgerUseCase = void 0;
class RecordVoucherLedgerUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucher) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.approve');
        await this.ledgerRepo.recordForVoucher(voucher);
    }
}
exports.RecordVoucherLedgerUseCase = RecordVoucherLedgerUseCase;
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