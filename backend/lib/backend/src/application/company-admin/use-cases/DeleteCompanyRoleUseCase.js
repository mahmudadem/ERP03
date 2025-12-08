"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteCompanyRoleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class DeleteCompanyRoleUseCase {
    constructor(companyRoleRepository, companyUserRepository) {
        this.companyRoleRepository = companyRoleRepository;
        this.companyUserRepository = companyUserRepository;
    }
    async execute(companyId, roleId) {
        // Validate companyId + roleId
        if (!companyId || !roleId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Load role
        const role = await this.companyRoleRepository.getById(companyId, roleId);
        if (!role) {
            throw ApiError_1.ApiError.notFound("Role not found");
        }
        // Block delete for system roles
        if (role.isSystem) {
            throw ApiError_1.ApiError.forbidden("System roles cannot be deleted");
        }
        // Check if any users assigned to this role
        const users = await this.companyUserRepository.getByRole(companyId, roleId);
        if (users.length > 0) {
            throw ApiError_1.ApiError.badRequest("Cannot delete a role that has active users");
        }
        // Delete
        await this.companyRoleRepository.delete(companyId, roleId);
    }
}
exports.DeleteCompanyRoleUseCase = DeleteCompanyRoleUseCase;
//# sourceMappingURL=DeleteCompanyRoleUseCase.js.map