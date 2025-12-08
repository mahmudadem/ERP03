"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCompanyRoleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class CreateCompanyRoleUseCase {
    constructor(companyRoleRepository) {
        this.companyRoleRepository = companyRoleRepository;
    }
    async execute(input) {
        // Validate
        if (!input.companyId || !input.name) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Generate roleId
        const roleId = `role_${Date.now()}`;
        // Create role object
        const role = {
            id: roleId,
            companyId: input.companyId,
            name: input.name,
            description: input.description || '',
            permissions: input.permissions || [],
            isSystem: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Save
        await this.companyRoleRepository.create(role);
        // Return DTO
        return {
            roleId: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            createdAt: role.createdAt
        };
    }
}
exports.CreateCompanyRoleUseCase = CreateCompanyRoleUseCase;
//# sourceMappingURL=CreateCompanyRoleUseCase.js.map