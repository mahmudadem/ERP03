"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
class Role {
    constructor(id, name, permissions, moduleBundles = [], explicitPermissions = [], resolvedPermissions = []) {
        this.id = id;
        this.name = name;
        this.permissions = permissions;
        this.moduleBundles = moduleBundles;
        this.explicitPermissions = explicitPermissions;
        this.resolvedPermissions = resolvedPermissions;
    }
}
exports.Role = Role;
//# sourceMappingURL=Role.js.map