"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCurrentUserPermissionsForCompanyUseCase = void 0;
class GetCurrentUserPermissionsForCompanyUseCase {
    constructor(userRepo, companyUserRepo, companyRoleRepo) {
        this.userRepo = userRepo;
        this.companyUserRepo = companyUserRepo;
        this.companyRoleRepo = companyRoleRepo;
    }
    async execute(request) {
        const { userId, companyId } = request;
        const user = await this.userRepo.getUserById(userId);
        if (user && user.isAdmin()) {
            return ['*'];
        }
        const companyUser = await this.companyUserRepo.getByUserAndCompany(userId, companyId);
        if (!companyUser) {
            return [];
        }
        if (companyUser.isOwner) {
            return ['*'];
        }
        const role = await this.companyRoleRepo.getById(companyId, companyUser.roleId);
        if (!role) {
            return [];
        }
        return role.resolvedPermissions || role.permissions || [];
    }
}
exports.GetCurrentUserPermissionsForCompanyUseCase = GetCurrentUserPermissionsForCompanyUseCase;
//# sourceMappingURL=GetCurrentUserPermissionsForCompanyUseCase.js.map