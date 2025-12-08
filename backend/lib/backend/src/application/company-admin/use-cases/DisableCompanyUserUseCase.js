"use strict";
/**
 * DisableCompanyUserUseCase
 * Disables a user's access to the company (soft delete)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisableCompanyUserUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class DisableCompanyUserUseCase {
    constructor(companyUserRepository) {
        this.companyUserRepository = companyUserRepository;
    }
    async execute(input) {
        // Validate
        if (!input.companyId || !input.userId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Load membership
        const membership = await this.companyUserRepository.get(input.companyId, input.userId);
        if (!membership) {
            throw ApiError_1.ApiError.notFound("User not found in company");
        }
        // Block owner
        if (membership.isOwner) {
            throw ApiError_1.ApiError.forbidden("Owner cannot be disabled");
        }
        // Update state
        await this.companyUserRepository.update(input.userId, input.companyId, { isDisabled: true });
        // Return
        return { userId: input.userId, companyId: input.companyId, isDisabled: true };
    }
}
exports.DisableCompanyUserUseCase = DisableCompanyUserUseCase;
//# sourceMappingURL=DisableCompanyUserUseCase.js.map