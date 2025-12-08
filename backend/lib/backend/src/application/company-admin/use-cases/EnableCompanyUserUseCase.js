"use strict";
/**
 * EnableCompanyUserUseCase
 * Re-activates a previously disabled user
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnableCompanyUserUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class EnableCompanyUserUseCase {
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
        // Update state
        await this.companyUserRepository.update(input.userId, input.companyId, { isDisabled: false });
        // Return
        return { userId: input.userId, companyId: input.companyId, isDisabled: false };
    }
}
exports.EnableCompanyUserUseCase = EnableCompanyUserUseCase;
//# sourceMappingURL=EnableCompanyUserUseCase.js.map