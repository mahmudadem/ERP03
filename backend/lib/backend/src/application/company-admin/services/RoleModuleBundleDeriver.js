"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveModuleBundlesFromPermissions = void 0;
const NON_MODULE_PERMISSION_PREFIXES = new Set(['system']);
function deriveModuleBundlesFromPermissions(permissions = []) {
    var _a;
    const modules = new Set();
    for (const permission of permissions) {
        const moduleId = (_a = String(permission || '').split('.')[0]) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
        if (!moduleId || NON_MODULE_PERMISSION_PREFIXES.has(moduleId) || moduleId === '*') {
            continue;
        }
        modules.add(moduleId);
    }
    return Array.from(modules).sort();
}
exports.deriveModuleBundlesFromPermissions = deriveModuleBundlesFromPermissions;
//# sourceMappingURL=RoleModuleBundleDeriver.js.map