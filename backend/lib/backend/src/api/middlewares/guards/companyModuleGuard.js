"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyModuleGuard = void 0;
const ApiError_1 = require("../../errors/ApiError");
const ModuleRegistry_1 = require("../../../application/platform/ModuleRegistry");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
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
        // Primary path: trust tenant context when module list contains canonical module ids.
        if (tenantModules.includes(normalizedModuleName)) {
            return next();
        }
        const registeredModules = new Set(ModuleRegistry_1.ModuleRegistry.getInstance()
            .getAllModules()
            .map((m) => String(m.metadata.id || '').trim().toLowerCase())
            .filter(Boolean));
        const hasCanonicalTenantModules = tenantModules.some((m) => registeredModules.has(m));
        // Fallback path for legacy/stale company.modules payloads (e.g., wizard model tokens).
        if (!hasCanonicalTenantModules) {
            try {
                const moduleState = await bindRepositories_1.diContainer.companyModuleRepository.get(context.companyId, normalizedModuleName);
                if (moduleState && (moduleState.initialized || moduleState.initializationStatus === 'complete')) {
                    return next();
                }
            }
            catch (error) {
                return next(error);
            }
        }
        return next(ApiError_1.ApiError.forbidden(`Module '${moduleName}' is disabled for this company`));
    };
}
exports.companyModuleGuard = companyModuleGuard;
//# sourceMappingURL=companyModuleGuard.js.map