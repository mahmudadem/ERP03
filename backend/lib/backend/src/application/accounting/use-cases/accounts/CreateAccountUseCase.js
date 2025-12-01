"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAccountUseCase = void 0;
class CreateAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(companyId, data) {
        // Check if account code already exists
        const existing = await this.accountRepo.getByCode(companyId, data.code);
        if (existing) {
            throw new Error(`Account with code ${data.code} already exists`);
        }
        return await this.accountRepo.create(companyId, data);
    }
}
exports.CreateAccountUseCase = CreateAccountUseCase;
//# sourceMappingURL=CreateAccountUseCase.js.map