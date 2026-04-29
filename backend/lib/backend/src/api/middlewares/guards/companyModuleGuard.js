"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyModuleGuard = void 0;
const ApiError_1 = require("../../errors/ApiError");
const ModuleAvailabilityService_1 = require("../../../application/platform/ModuleAvailabilityService");
function companyModuleGuard(moduleName) {
    return async (req, res, next) => {
        const context = req.tenantContext;
        const normalizedModuleName = String(moduleName || '').trim().toLowerCase();
        if (!context) {
            return next(ApiError_1.ApiError.internal('Tenant context not initialized'));
        }
        const tenantModules = Array.isArray(context.modules)
            ? context.modules.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
            : [];
        const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
        if (tenantModules.includes(normalizedModuleName)) {
            await service.ensureCacheFresh();
            const info = service.getAvailabilityInfo(normalizedModuleName);
            if (!info) {
                return next(ApiError_1.ApiError.internal('Module availability info not found'));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.DB_ONLY) {
                return next(ApiError_1.ApiError.custom(503, 'Module implementation not found. Contact SuperAdmin.'));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.CODE_ONLY) {
                return next(ApiError_1.ApiError.custom(503, 'Module not registered. Contact SuperAdmin.'));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.VERSION_MISMATCH) {
                return next(ApiError_1.ApiError.custom(503, `Module version mismatch: ${info.reason}`));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.IMPLEMENTATION_FAILED) {
                return next(ApiError_1.ApiError.custom(503, `Module implementation failed: ${info.reason}`));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED) {
                return next(ApiError_1.ApiError.custom(503, `Module implementation not verified: ${info.reason}`));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.NOT_READY) {
                return next(ApiError_1.ApiError.custom(503, `Module is not ready: ${info.reason}`));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.SUSPENDED) {
                return next(ApiError_1.ApiError.locked(`${normalizedModuleName} is temporarily unavailable due to maintenance. Your data is safe. Please try again later or contact your administrator.`));
            }
            if (info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.AVAILABLE) {
                return next();
            }
            return next(ApiError_1.ApiError.forbidden(`Module '${moduleName}' access denied`));
        }
        return next(ApiError_1.ApiError.forbidden(`Module '${moduleName}' is not enabled for this company`));
    };
}
exports.companyModuleGuard = companyModuleGuard;
//# sourceMappingURL=companyModuleGuard.js.map