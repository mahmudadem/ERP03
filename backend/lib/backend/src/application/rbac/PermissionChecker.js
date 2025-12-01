"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionChecker = void 0;
const ApiError_1 = require("../../api/errors/ApiError");
class PermissionChecker {
    constructor(getPermissionsUC) {
        this.getPermissionsUC = getPermissionsUC;
    }
    async assertOrThrow(userId, companyId, required) {
        const perms = await this.getPermissionsUC.execute({ userId, companyId });
        if (perms.includes("*") || perms.includes(required))
            return;
        throw ApiError_1.ApiError.forbidden(`Missing permission '${required}'`);
    }
    async hasPermission(userId, companyId, required) {
        const perms = await this.getPermissionsUC.execute({ userId, companyId });
        return perms.includes("*") || perms.includes(required);
    }
}
exports.PermissionChecker = PermissionChecker;
//# sourceMappingURL=PermissionChecker.js.map