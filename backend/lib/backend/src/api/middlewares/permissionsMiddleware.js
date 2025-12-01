"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionsMiddleware = void 0;
const ApiError_1 = require("../errors/ApiError");
const permissionsMiddleware = (requiredPermission) => {
    return (req, res, next) => {
        // 1. Ensure User is Authenticated
        const user = req.user;
        if (!user) {
            return next(ApiError_1.ApiError.unauthorized('User not authenticated'));
        }
        if (!user.companyId) {
            return next(ApiError_1.ApiError.forbidden('No active company selected'));
        }
        next();
    };
};
exports.permissionsMiddleware = permissionsMiddleware;
//# sourceMappingURL=permissionsMiddleware.js.map