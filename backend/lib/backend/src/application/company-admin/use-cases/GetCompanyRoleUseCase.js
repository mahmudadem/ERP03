"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCompanyRoleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class GetCompanyRoleUseCase {
    constructor(companyRoleRepository) {
        this.companyRoleRepository = companyRoleRepository;
    }
    async execute(companyId, roleId) {
        // Validate roleId + companyId
        if (!companyId || !roleId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Load role
        const role = await this.companyRoleRepository.getById(companyId, roleId);
        if (!role) {
            throw ApiError_1.ApiError.notFound("Role not found");
        }
        // Return role details DTO
        return {
            roleId: role.id,
            name: role.name,
            description: role.description || '',
            isSystem: !!role.isSystem,
            permissions: role.permissions || [],
            createdAt: role.createdAt,
            updatedAt: role.updatedAt
        };
    }
}
exports.GetCompanyRoleUseCase = GetCompanyRoleUseCase;
//# sourceMappingURL=GetCompanyRoleUseCase.js.map