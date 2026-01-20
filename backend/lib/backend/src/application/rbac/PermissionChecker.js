"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionChecker = void 0;
const ApiError_1 = require("../../api/errors/ApiError");
class PermissionChecker {
    constructor(getPermissionsUC) {
        this.getPermissionsUC = getPermissionsUC;
    }
    async assertOrThrow(userId, companyId, required) {
        if (await this.hasPermission(userId, companyId, required))
            return;
        throw ApiError_1.ApiError.forbidden(`Missing permission '${required}'`);
    }
    async hasPermission(userId, companyId, required) {
        const perms = await this.getPermissionsUC.execute({ userId, companyId });
        if (perms.includes("*"))
            return true;
        return perms.some(p => {
            // Direct match
            if (p === required)
                return true;
            // Parent permission: if user has 'accounting.vouchers', they have 'accounting.vouchers.approve'
            const isParent = required.startsWith(p + '.');
            return isParent;
        });
    }
}
exports.PermissionChecker = PermissionChecker;
//# sourceMappingURL=PermissionChecker.js.map