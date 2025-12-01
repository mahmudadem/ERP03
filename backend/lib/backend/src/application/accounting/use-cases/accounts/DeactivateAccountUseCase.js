"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeactivateAccountUseCase = void 0;
class DeactivateAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(companyId, accountId) {
        const account = await this.accountRepo.getById(companyId, accountId);
        if (!account) {
            throw new Error('Account not found');
        }
        if (account.isProtected) {
            throw new Error('Cannot deactivate a protected account');
        }
        const hasChildren = await this.accountRepo.hasChildren(companyId, accountId);
        if (hasChildren) {
            throw new Error('Cannot deactivate an account with children');
        }
        await this.accountRepo.deactivate(companyId, accountId);
    }
}
exports.DeactivateAccountUseCase = DeactivateAccountUseCase;
//# sourceMappingURL=DeactivateAccountUseCase.js.map