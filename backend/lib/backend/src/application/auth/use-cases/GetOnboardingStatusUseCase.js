"use strict";
/**
 * GetOnboardingStatusUseCase.ts
 *
 * Purpose: Determines user's onboarding status to route them appropriately.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetOnboardingStatusUseCase = void 0;
class GetOnboardingStatusUseCase {
    constructor(userRepository, companyUserRepository) {
        this.userRepository = userRepository;
        this.companyUserRepository = companyUserRepository;
    }
    async execute(userId, email) {
        const user = await this.userRepository.getUserById(userId);
        // If user doesn't exist in our database, they need to complete onboarding
        // This handles legacy Firebase Auth users who don't have a User record yet
        if (!user) {
            return {
                userId,
                email: email || 'unknown',
                name: 'User',
                hasPlan: false,
                planId: null,
                hasCompanies: false,
                companiesCount: 0,
                activeCompanyId: null,
                nextStep: 'PLAN_SELECTION',
            };
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