"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignRoleToCompanyUserUseCase = void 0;
class AssignRoleToCompanyUserUseCase {
    constructor(companyUserRepo, permissionChecker) {
        this.companyUserRepo = companyUserRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(request) {
        await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
        const companyUser = await this.companyUserRepo.getByUserAndCompany(request.targetUserId, request.companyId);
        if (!companyUser)
            throw new Error('User is not a member of this company');
        companyUser.roleId = request.roleId;
        await this.companyUserRepo.assignRole(companyUser);
    }
}
exports.AssignRoleToCompanyUserUseCase = AssignRoleToCompanyUserUseCase;
//# sourceMappingURL=AssignRoleToCompanyUserUseCase.js.map