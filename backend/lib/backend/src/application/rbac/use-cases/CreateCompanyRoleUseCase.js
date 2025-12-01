"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCompanyRoleUseCase = void 0;
class CreateCompanyRoleUseCase {
    constructor(companyRoleRepo, permissionChecker) {
        this.companyRoleRepo = companyRoleRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(request) {
        await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
        const newRole = {
            id: `role_${Date.now()}`,
            companyId: request.companyId,
            name: request.name,
            description: request.description,
            permissions: request.permissions,
            sourceTemplateId: request.sourceTemplateId,
            isDefaultForNewUsers: false
        };
        await this.companyRoleRepo.create(newRole);
        return newRole;
    }
}
exports.CreateCompanyRoleUseCase = CreateCompanyRoleUseCase;
//# sourceMappingURL=CreateCompanyRoleUseCase.js.map