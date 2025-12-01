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
            const err = new Error(`Account with code ${data.code} already exists`);
            err.statusCode = 409;
            throw err;
        }
        const sanitized = {
            code: data.code,
            name: data.name,
            type: (data.type || 'ASSET').toUpperCase(),
            parentId: data.parentId ? data.parentId : null,
            currency: data.currency || null
        };
        return await this.accountRepo.create(companyId, sanitized);
    }
}
exports.CreateAccountUseCase = CreateAccountUseCase;
//# sourceMappingURL=CreateAccountUseCase.js.map