"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeactivateAccountUseCase = exports.UpdateAccountUseCase = exports.CreateAccountUseCase = void 0;
const crypto_1 = require("crypto");
const Account_1 = require("../../../domain/accounting/entities/Account");
class CreateAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(data) {
        const account = new Account_1.Account(data.companyId, (0, crypto_1.randomUUID)(), data.code, data.name, data.type, data.currency, false, // isProtected
        true, // active
        undefined, undefined);
        await this.accountRepo.create(data.companyId, {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            currency: account.currency,
            parentId: account.parentId || null
        });
        return account;
    }
}
exports.CreateAccountUseCase = CreateAccountUseCase;
class UpdateAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(accountId, data) {
        if (!data.companyId) {
            throw new Error('companyId is required for update');
        }
        await this.accountRepo.update(data.companyId, accountId, {
            code: data.code,
            name: data.name,
            type: data.type,
            parentId: data.parentId,
            isActive: data.isActive,
            currency: data.currency
        });
    }
}
exports.UpdateAccountUseCase = UpdateAccountUseCase;
class DeactivateAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(accountId, companyId) {
        const account = await this.accountRepo.getById(companyId, accountId);
        if (account && account.isProtected) {
            throw new Error('Cannot deactivate a system protected account');
        }
        await this.accountRepo.deactivate(companyId, accountId);
    }
}
exports.DeactivateAccountUseCase = DeactivateAccountUseCase;
//# sourceMappingURL=AccountUseCases.js.map