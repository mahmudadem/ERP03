"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAccountUseCase = void 0;
class GetAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(companyId, accountId) {
        return await this.accountRepo.getById(companyId, accountId);
    }
}
exports.GetAccountUseCase = GetAccountUseCase;
//# sourceMappingURL=GetAccountUseCase.js.map