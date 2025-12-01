"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignRoleToCompanyUserUseCase = exports.InviteUserToCompanyUseCase = exports.GetUserCompaniesUseCase = void 0;
class GetUserCompaniesUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(userId) {
        return this.companyRepository.getUserCompanies(userId);
    }
}
exports.GetUserCompaniesUseCase = GetUserCompaniesUseCase;
class InviteUserToCompanyUseCase {
    constructor(companyUserRepository) {
        this.companyUserRepository = companyUserRepository;
    }
    async execute(userId, companyId, role) {
        // Logic to check if already member could go here
        await this.companyUserRepository.assignUserToCompany(userId, companyId, role);
    }
}
exports.InviteUserToCompanyUseCase = InviteUserToCompanyUseCase;
class AssignRoleToCompanyUserUseCase {
    constructor(companyUserRepository) {
        this.companyUserRepository = companyUserRepository;
    }
    async execute(userId, companyId, role) {
        // Re-assign or update role
        await this.companyUserRepository.assignUserToCompany(userId, companyId, role);
    }
}
exports.AssignRoleToCompanyUserUseCase = AssignRoleToCompanyUserUseCase;
//# sourceMappingURL=UserContextUseCases.js.map