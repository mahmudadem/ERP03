"use strict";
/**
 * DeleteCompanyUserUseCase.ts
 *
 * Purpose: Removes a user from the company (deletes the membership record).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteCompanyUserUseCase = void 0;
class DeleteCompanyUserUseCase {
    constructor(companyUserRepository) {
        this.companyUserRepository = companyUserRepository;
    }
    async execute(input) {
        await this.companyUserRepository.delete(input.companyId, input.userId);
    }
}
exports.DeleteCompanyUserUseCase = DeleteCompanyUserUseCase;
//# sourceMappingURL=DeleteCompanyUserUseCase.js.map