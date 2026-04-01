"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleInitializedGuard = void 0;
const ApiError_1 = require("../../errors/ApiError");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
function moduleInitializedGuard(moduleCode) {
    return async (req, res, next) => {
        var _a, _b;
        try {
            const companyId = ((_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.companyId);
            if (!companyId) {
                return next(ApiError_1.ApiError.internal('Tenant context not initialized'));
            }
            const moduleState = await bindRepositories_1.diContainer.companyModuleRepository.get(companyId, moduleCode);
            if (!moduleState || !moduleState.initialized) {
                return next(ApiError_1.ApiError.forbidden(`Module '${moduleCode}' is not initialized`));
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
exports.moduleInitializedGuard = moduleInitializedGuard;
//# sourceMappingURL=moduleInitializedGuard.js.map