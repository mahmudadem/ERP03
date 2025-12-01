"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCompanyRoleUseCase = void 0;
class UpdateCompanyRoleUseCase {
    constructor(companyRoleRepo, permissionChecker) {
        this.companyRoleRepo = companyRoleRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(request) {
        await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
        const role = await this.companyRoleRepo.getById(request.companyId, request.roleId);
        if (!role)
            throw new Error('Role not found');
        await this.companyRoleRepo.update(request.companyId, request.roleId, request.updates);
    }
}
exports.UpdateCompanyRoleUseCase = UpdateCompanyRoleUseCase;
//# sourceMappingURL=UpdateCompanyRoleUseCase.js.map