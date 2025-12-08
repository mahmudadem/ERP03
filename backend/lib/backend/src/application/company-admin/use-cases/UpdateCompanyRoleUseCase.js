"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCompanyRoleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class UpdateCompanyRoleUseCase {
    constructor(companyRoleRepository) {
        this.companyRoleRepository = companyRoleRepository;
    }
    async execute(input) {
        // Validate companyId + roleId
        if (!input.companyId || !input.roleId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Load original role
        const role = await this.companyRoleRepository.getById(input.companyId, input.roleId);
        if (!role) {
            throw ApiError_1.ApiError.notFound("Role not found");
        }
        // Block system roles
        if (role.isSystem) {
            throw ApiError_1.ApiError.forbidden("System roles cannot be modified");
        }
        // Apply updates to name, description, permissions only
        const name = input.name !== undefined ? input.name : role.name;
        const description = input.description !== undefined ? input.description : role.description;
        const permissions = input.permissions !== undefined ? input.permissions : role.permissions;
        // Save
        await this.companyRoleRepository.update(input.companyId, input.roleId, {
            name,
            description,
            permissions,
            updatedAt: new Date()
        });
    }
}
exports.UpdateCompanyRoleUseCase = UpdateCompanyRoleUseCase;
//# sourceMappingURL=UpdateCompanyRoleUseCase.js.map