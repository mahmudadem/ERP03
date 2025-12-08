"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyModuleGuard = void 0;
const ApiError_1 = require("../../errors/ApiError");
function companyModuleGuard(moduleName) {
    return (req, res, next) => {
        const context = req.tenantContext;
        if (!context) {
            return next(ApiError_1.ApiError.internal('Tenant context not initialized'));
        }
        if (!context.modules.includes(moduleName)) {
            return next(ApiError_1.ApiError.forbidden(`Module '${moduleName}' is disabled for this company`));
        }
        next();
    };
}
exports.companyModuleGuard = companyModuleGuard;
//# sourceMappingURL=companyModuleGuard.js.map