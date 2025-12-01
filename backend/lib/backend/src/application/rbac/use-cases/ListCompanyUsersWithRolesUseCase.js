"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCompanyUsersWithRolesUseCase = void 0;
class ListCompanyUsersWithRolesUseCase {
    constructor(companyUserRepo, permissionChecker) {
        this.companyUserRepo = companyUserRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(request) {
        await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
        return this.companyUserRepo.getByCompany(request.companyId);
    }
}
exports.ListCompanyUsersWithRolesUseCase = ListCompanyUsersWithRolesUseCase;
//# sourceMappingURL=ListCompanyUsersWithRolesUseCase.js.map