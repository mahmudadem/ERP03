"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteCompanyRoleUseCase = void 0;
class DeleteCompanyRoleUseCase {
    constructor(companyRoleRepo, companyUserRepo, permissionChecker) {
        this.companyRoleRepo = companyRoleRepo;
        this.companyUserRepo = companyUserRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(request) {
        await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
        const role = await this.companyRoleRepo.getById(request.companyId, request.roleId);
        if (!role)
            throw new Error('Role not found');
        // Check if in use
        const users = await this.companyUserRepo.getByCompany(request.companyId);
        const inUse = users.some(u => u.roleId === request.roleId);
        if (inUse) {
            throw new Error('Cannot delete role because it is assigned to one or more users.');
        }
        await this.companyRoleRepo.delete(request.companyId, request.roleId);
    }
}
exports.DeleteCompanyRoleUseCase = DeleteCompanyRoleUseCase;
//# sourceMappingURL=DeleteCompanyRoleUseCase.js.map