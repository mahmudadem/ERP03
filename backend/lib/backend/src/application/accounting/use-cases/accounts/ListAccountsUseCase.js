"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAccountsUseCase = void 0;
class ListAccountsUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(companyId) {
        return await this.accountRepo.list(companyId);
    }
}
exports.ListAccountsUseCase = ListAccountsUseCase;
//# sourceMappingURL=ListAccountsUseCase.js.map