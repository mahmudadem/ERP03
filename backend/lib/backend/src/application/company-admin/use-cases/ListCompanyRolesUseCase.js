"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCompanyRolesUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class ListCompanyRolesUseCase {
    constructor(companyRoleRepository) {
        this.companyRoleRepository = companyRoleRepository;
    }
    async execute(input) {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError_1.ApiError.badRequest("Missing companyId");
        }
        // Load roles
        const roles = await this.companyRoleRepository.getAll(input.companyId);
        // Sort system roles first
        roles.sort((a, b) => Number(b.isSystem) - Number(a.isSystem));
        // Return DTO
        return roles.map(r => ({
            roleId: r.id,
            name: r.name,
            description: r.description || '',
            isSystem: !!r.isSystem,
            permissions: r.permissions || []
        }));
    }
}
exports.ListCompanyRolesUseCase = ListCompanyRolesUseCase;
//# sourceMappingURL=ListCompanyRolesUseCase.js.map