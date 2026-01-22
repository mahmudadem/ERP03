"use strict";
/**
 * OnboardingController.ts
 *
 * Purpose: Handles onboarding-related HTTP requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const SignupUseCase_1 = require("../../../application/auth/use-cases/SignupUseCase");
const SelectPlanUseCase_1 = require("../../../application/auth/use-cases/SelectPlanUseCase");
const GetOnboardingStatusUseCase_1 = require("../../../application/auth/use-cases/GetOnboardingStatusUseCase");
const CreateCompanyUseCase_1 = require("../../../application/onboarding/use-cases/CreateCompanyUseCase");
const CompanyRolePermissionResolver_1 = require("../../../application/rbac/CompanyRolePermissionResolver");
const ApiError_1 = require("../../errors/ApiError");
class OnboardingController {
    /**
     * POST /auth/signup
     * Creates a new user account
     */
    static async signup(req, res, next) {
        try {
            const { email, password, firstName, lastName } = req.body;
            const useCase = new SignupUseCase_1.SignupUseCase(bindRepositories_1.diContainer.userRepository);
            const result = await useCase.execute({
                email,
                password,
                firstName,
                lastName,
            });
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /auth/onboarding-status
     * Returns user's onboarding status (requires auth)
     */
    static async getOnboardingStatus(req, res, next) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return next(ApiError_1.ApiError.unauthorized('Authentication required'));
            }
            const useCase = new GetOnboardingStatusUseCase_1.GetOnboardingStatusUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository);
            const status = await useCase.execute(userId);
            res.json({
                success: true,
                data: status,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /auth/select-plan
     * Saves user's plan selection (requires auth)
     */
    static async selectPlan(req, res, next) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return next(ApiError_1.ApiError.unauthorized('Authentication required'));
            }
            const { planId } = req.body;
            if (!planId) {
                return next(ApiError_1.ApiError.badRequest('planId is required'));
            }
            const useCase = new SelectPlanUseCase_1.SelectPlanUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.planRegistryRepository);
            const result = await useCase.execute({ userId, planId });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /plans
     * Returns all active plans (public endpoint for plan selection page)
     */
    static async listPlans(req, res, next) {
        try {
            const plans = await bindRepositories_1.diContainer.planRegistryRepository.getAll();
            // Filter to only active plans and format for frontend
            const activePlans = plans
                .filter(p => p.status === 'active')
                .map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: p.price,
                limits: p.limits,
            }));
            res.json({
                success: true,
                data: activePlans,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /bundles
     * Returns all active bundles (for company wizard)
     */
    static async listBundles(req, res, next) {
        try {
            const bundles = await bindRepositories_1.diContainer.bundleRegistryRepository.getAll();
            // Format for frontend
            const formattedBundles = bundles.map((b) => ({
                id: b.id,
                name: b.name,
                description: b.description,
                modules: b.modulesIncluded,
                recommended: false, // Could be based on user's business domain in future
            }));
            res.json({
                success: true,
                data: formattedBundles,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /create-company
     * Creates a new company directly (fast wizard)
     */
    static async createCompany(req, res, next) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return next(ApiError_1.ApiError.unauthorized('Authentication required'));
            }
            const { companyName, description, country, email, bundleId, logoData, currency, language, timezone, dateFormat } = req.body;
            // We need a resolver instance
            const resolver = new CompanyRolePermissionResolver_1.CompanyRolePermissionResolver(bindRepositories_1.diContainer.modulePermissionsDefinitionRepository, bindRepositories_1.diContainer.companyRoleRepository);
            const useCase = new CreateCompanyUseCase_1.CreateCompanyUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository, resolver, bindRepositories_1.diContainer.bundleRegistryRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.companySettingsRepository);
            const result = await useCase.execute({
                userId,
                companyName,
                description,
                country,
                email,
                bundleId,
                logoData,
                currency,
                language,
                timezone,
                dateFormat
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.OnboardingController = OnboardingController;
//# sourceMappingURL=OnboardingController.js.map