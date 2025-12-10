"use strict";
/**
 * GetOnboardingStatusUseCase.ts
 *
 * Purpose: Determines user's onboarding status to route them appropriately.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetOnboardingStatusUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class GetOnboardingStatusUseCase {
    constructor(userRepository, companyUserRepository) {
        this.userRepository = userRepository;
        this.companyUserRepository = companyUserRepository;
    }
    async execute(userId) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw ApiError_1.ApiError.notFound('User not found');
        }
        // Get user's companies
        const userCompanies = await this.companyUserRepository.getMembershipsByUser(userId);
        const hasCompanies = userCompanies.length > 0;
        // Determine next step
        let nextStep;
        if (!user.planId) {
            nextStep = 'PLAN_SELECTION';
        }
        else if (!hasCompanies) {
            nextStep = 'COMPANY_SELECT';
        }
        else if (user.activeCompanyId) {
            nextStep = 'DASHBOARD';
        }
        else {
            nextStep = 'COMPANY_SELECT';
        }
        return {
            userId: user.id,
            email: user.email,
            name: user.name,
            hasPlan: !!user.planId,
            planId: user.planId || null,
            hasCompanies,
            companiesCount: userCompanies.length,
            activeCompanyId: user.activeCompanyId || null,
            nextStep,
        };
    }
}
exports.GetOnboardingStatusUseCase = GetOnboardingStatusUseCase;
//# sourceMappingURL=GetOnboardingStatusUseCase.js.map