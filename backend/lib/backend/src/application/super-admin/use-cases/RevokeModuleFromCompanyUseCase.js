"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevokeModuleFromCompanyUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class RevokeModuleFromCompanyUseCase {
    constructor(entitlementService) {
        this.entitlementService = entitlementService;
    }
    async execute(companyId, moduleKey) {
        const normalizedKey = moduleKey.toLowerCase();
        // Check if company has this module
        const hasModule = await this.entitlementService.companyHasModule(companyId, normalizedKey);
        if (!hasModule) {
            throw ApiError_1.ApiError.badRequest(`Company does not have access to module '${moduleKey}'.`);
        }
        // Revoke via entitlement service
        await this.entitlementService.revokeModule(companyId, normalizedKey);
    }
}
exports.RevokeModuleFromCompanyUseCase = RevokeModuleFromCompanyUseCase;
//# sourceMappingURL=RevokeModuleFromCompanyUseCase.js.map