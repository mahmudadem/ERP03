"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterRuntimeAvailableModules = exports.resolveCompanyEnabledModules = exports.resolveCompanyModuleAccess = exports.roleHasModuleWildcard = void 0;
const ModuleAvailabilityService_1 = require("../../platform/ModuleAvailabilityService");
function normalizeList(values) {
    return (values || [])
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
}
function roleHasModuleWildcard(role, membership) {
    if ((membership === null || membership === void 0 ? void 0 : membership.isOwner) === true)
        return true;
    const roleId = String((role === null || role === void 0 ? void 0 : role.id) || (membership === null || membership === void 0 ? void 0 : membership.roleId) || '').trim().toUpperCase();
    const roleName = String((role === null || role === void 0 ? void 0 : role.name) || '').trim().toUpperCase();
    if (roleId === 'OWNER' || roleId === 'ADMIN')
        return true;
    if (roleName === 'OWNER' || roleName === 'ADMIN' || roleName === 'ADMINISTRATOR')
        return true;
    const permissions = [
        ...((role === null || role === void 0 ? void 0 : role.explicitPermissions) || []),
        ...((role === null || role === void 0 ? void 0 : role.resolvedPermissions) || []),
        ...((role === null || role === void 0 ? void 0 : role.permissions) || []),
    ];
    return permissions.includes('*');
}
exports.roleHasModuleWildcard = roleHasModuleWildcard;
function resolveCompanyModuleAccess(input) {
    const hasCompanyModuleRecords = input.companyModules.length > 0;
    const legacyModuleSet = new Set(normalizeList(input.legacyModules));
    const entitledModuleSet = new Set(normalizeList(input.entitledModules));
    const roleModuleSet = new Set(normalizeList(input.roleModuleBundles));
    const enabledModuleSet = hasCompanyModuleRecords
        ? new Set(input.companyModules
            .filter((module) => module.isEnabled)
            .map((module) => String(module.moduleCode || '').trim().toLowerCase())
            .filter(Boolean))
        : legacyModuleSet;
    const companyAllowedModules = Array.from(enabledModuleSet).filter((moduleId) => entitledModuleSet.has(moduleId) || legacyModuleSet.has(moduleId));
    if (roleHasModuleWildcard(input.role, input.membership)) {
        return companyAllowedModules;
    }
    if (roleModuleSet.size === 0) {
        return [];
    }
    return companyAllowedModules.filter((moduleId) => roleModuleSet.has(moduleId));
}
exports.resolveCompanyModuleAccess = resolveCompanyModuleAccess;
function resolveCompanyEnabledModules(input) {
    return resolveCompanyModuleAccess({
        companyModules: input.companyModules,
        legacyModules: input.legacyModules,
        entitledModules: input.entitledModules,
        roleModuleBundles: [],
        role: null,
        membership: { roleId: 'OWNER', isOwner: true },
    });
}
exports.resolveCompanyEnabledModules = resolveCompanyEnabledModules;
async function filterRuntimeAvailableModules(companyId, moduleIds, availabilityService = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance()) {
    const result = [];
    const normalizedModuleIds = normalizeList(moduleIds);
    for (const moduleId of normalizedModuleIds) {
        const availability = await availabilityService.isAvailableForCompany(moduleId, companyId);
        if (availability.available) {
            result.push(moduleId);
        }
    }
    return result;
}
exports.filterRuntimeAvailableModules = filterRuntimeAvailableModules;
//# sourceMappingURL=CompanyModuleAccessResolver.js.map