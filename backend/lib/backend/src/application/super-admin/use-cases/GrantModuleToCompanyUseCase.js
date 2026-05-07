"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrantModuleToCompanyUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class GrantModuleToCompanyUseCase {
    constructor(entitlementService, moduleRepo) {
        this.entitlementService = entitlementService;
        this.moduleRepo = moduleRepo;
    }
    async execute(companyId, moduleKey) {
        const normalizedKey = moduleKey.toLowerCase();
        // Validate module exists in registry
        const modules = await this.moduleRepo.getAll();
        const moduleExists = modules.some(m => m.id.toLowerCase() === normalizedKey);
        if (!moduleExists) {
            throw ApiError_1.ApiError.badRequest(`Module '${moduleKey}' does not exist in the registry.`);
        }
        // Check if already entitled
        const alreadyEntitled = await this.entitlementService.companyHasModule(companyId, normalizedKey);
        if (alreadyEntitled) {
            throw ApiError_1.ApiError.badRequest(`Company already has access to module '${moduleKey}'.`);
        }
        // Grant via entitlement service with superadmin_override source
        await this.entitlementService.grantModule(companyId, normalizedKey, 'superadmin_override', 'superadmin_manual');
    }
}
exports.GrantModuleToCompanyUseCase = GrantModuleToCompanyUseCase;
//# sourceMappingURL=GrantModuleToCompanyUseCase.js.map