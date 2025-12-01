"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyUser = void 0;
class CompanyUser {
    constructor(id, userId, companyId, role, // e.g., 'MANAGER', 'ACCOUNTANT'
    permissions) {
        this.id = id;
        this.userId = userId;
        this.companyId = companyId;
        this.role = role;
        this.permissions = permissions;
    }
    hasPermission(permissionCode) {
        return this.permissions.includes(permissionCode);
    }
}
exports.CompanyUser = CompanyUser;
//# sourceMappingURL=CompanyUser.js.map