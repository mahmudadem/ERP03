"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetNextVoucherNumberUseCase = exports.ListVoucherSequencesUseCase = void 0;
class ListVoucherSequencesUseCase {
    constructor(repo, permission) {
        this.repo = repo;
        this.permission = permission;
    }
    async execute(companyId, userId) {
        await this.permission.assertOrThrow(userId, companyId, 'accounting.settings.write');
        return this.repo.listSequences(companyId);
    }
}
exports.ListVoucherSequencesUseCase = ListVoucherSequencesUseCase;
class SetNextVoucherNumberUseCase {
    constructor(repo, permission) {
        this.repo = repo;
        this.permission = permission;
    }
    async execute(companyId, userId, prefix, nextNumber, year) {
        await this.permission.assertOrThrow(userId, companyId, 'accounting.settings.write');
        await this.repo.setNextNumber(companyId, prefix, nextNumber, year);
    }
}
exports.SetNextVoucherNumberUseCase = SetNextVoucherNumberUseCase;
//# sourceMappingURL=VoucherSequenceUseCases.js.map