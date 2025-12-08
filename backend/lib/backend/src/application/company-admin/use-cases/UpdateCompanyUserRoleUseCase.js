"use strict";
/**
 * UpdateCompanyUserRoleUseCase
 * Changes a user's role within the company
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCompanyUserRoleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class UpdateCompanyUserRoleUseCase {
    constructor(companyUserRepository, companyRoleRepository) {
        this.companyUserRepository = companyUserRepository;
        this.companyRoleRepository = companyRoleRepository;
    }
    async execute(input) {
        // Validate inputs
        if (!input.companyId || !input.userId || !input.newRoleId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Load the membership
        const membership = await this.companyUserRepository.get(input.companyId, input.userId);
        if (!membership) {
            throw ApiError_1.ApiError.notFound("User is not a member of this company");
        }
        // Ensure you cannot change the owner's role
        if (membership.isOwner) {
            throw ApiError_1.ApiError.forbidden("Cannot change the role of the company owner");
        }
        // Ensure role exists
        const role = await this.companyRoleRepository.getById(input.companyId, input.newRoleId);
        if (!role) {
            throw ApiError_1.ApiError.notFound("Role not found");
        }
        // Update membership
        await this.companyUserRepository.update(input.userId, input.companyId, { roleId: input.newRoleId });
        // Return success DTO
        return {
            userId: input.userId,
            companyId: input.companyId,
            roleId: input.newRoleId,
            updatedAt: new Date()
        };
    }
}
exports.UpdateCompanyUserRoleUseCase = UpdateCompanyUserRoleUseCase;
//# sourceMappingURL=UpdateCompanyUserRoleUseCase.js.map