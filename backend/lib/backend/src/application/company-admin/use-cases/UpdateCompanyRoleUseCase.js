"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCompanyRoleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
const PermissionCatalogSyncService_1 = require("../../platform/PermissionCatalogSyncService");
const RoleModuleBundleDeriver_1 = require("../services/RoleModuleBundleDeriver");
class UpdateCompanyRoleUseCase {
    constructor(companyRoleRepository) {
        this.companyRoleRepository = companyRoleRepository;
    }
    async execute(input) {
        // Validate companyId + roleId
        if (!input.companyId || !input.roleId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Load original role
        const role = await this.companyRoleRepository.getById(input.companyId, input.roleId);
        if (!role) {
            throw ApiError_1.ApiError.notFound("Role not found");
        }
        // Block system roles
        if (role.isSystem) {
            throw ApiError_1.ApiError.forbidden("System roles cannot be modified");
        }
        // Validate permissions against company-scoped catalog if provided
        if (input.permissions !== undefined && input.permissions.length > 0) {
            const syncService = new PermissionCatalogSyncService_1.PermissionCatalogSyncService();
            const availablePerms = await syncService.getAvailablePermissions(input.companyId);
            const validSet = new Set(availablePerms.map(p => p.id));
            const invalid = input.permissions.filter(p => !validSet.has(p));
            if (invalid.length > 0) {
                throw ApiError_1.ApiError.badRequest(`Invalid permissions: ${invalid.join(', ')}. Permissions must be from the available catalog for your company's modules.`);
            }
        }
        // Apply updates to name, description, permissions, and derived access metadata.
        const name = input.name !== undefined ? input.name : role.name;
        const description = input.description !== undefined ? input.description : role.description;
        const permissions = input.permissions !== undefined ? input.permissions : role.permissions;
        const moduleBundles = input.permissions !== undefined
            ? (0, RoleModuleBundleDeriver_1.deriveModuleBundlesFromPermissions)(permissions)
            : role.moduleBundles;
        const explicitPermissions = input.permissions !== undefined
            ? permissions
            : role.explicitPermissions;
        const resolvedPermissions = input.permissions !== undefined
            ? permissions
            : role.resolvedPermissions;
        // Save
        await this.companyRoleRepository.update(input.companyId, input.roleId, {
            name,
            description,
            permissions,
            explicitPermissions,
            resolvedPermissions,
            moduleBundles,
            updatedAt: new Date()
        });
    }
}
exports.UpdateCompanyRoleUseCase = UpdateCompanyRoleUseCase;
//# sourceMappingURL=UpdateCompanyRoleUseCase.js.map