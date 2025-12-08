"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlagGuard = void 0;
const ApiError_1 = require("../../errors/ApiError");
function featureFlagGuard(featureName) {
    return (req, res, next) => {
        const context = req.tenantContext;
        if (!context) {
            return next(ApiError_1.ApiError.internal('Tenant context not initialized'));
        }
        if (!context.features.includes(featureName)) {
            return next(ApiError_1.ApiError.forbidden(`Feature not enabled: ${featureName}`));
        }
        next();
    };
}
exports.featureFlagGuard = featureFlagGuard;
//# sourceMappingURL=featureFlagGuard.js.map