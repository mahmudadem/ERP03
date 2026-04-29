"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCompanyRoleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
const PermissionCatalogSyncService_1 = require("../../platform/PermissionCatalogSyncService");
const RoleModuleBundleDeriver_1 = require("../services/RoleModuleBundleDeriver");
class CreateCompanyRoleUseCase {
    constructor(companyRoleRepository, permissionRegistryRepository) {
        this.companyRoleRepository = companyRoleRepository;
        this.permissionRegistryRepository = permissionRegistryRepository;
    }
    async execute(input) {
        // Validate
        if (!input.companyId || !input.name) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Validate permissions against company-scoped catalog
        if (input.permissions && input.permissions.length > 0) {
            const syncService = new PermissionCatalogSyncService_1.PermissionCatalogSyncService();
            const availablePerms = await syncService.getAvailablePermissions(input.companyId);
            const validSet = new Set(availablePerms.map(p => p.id));
            const invalid = input.permissions.filter(p => !validSet.has(p));
            if (invalid.length > 0) {
                throw ApiError_1.ApiError.badRequest(`Invalid permissions: ${invalid.join(', ')}. Permissions must be from the available catalog for your company's modules.`);
            }
        }
        // Generate roleId
        const roleId = `role_${Date.now()}`;
        // Create role object
        const role = {
            id: roleId,
            companyId: input.companyId,
            name: input.name,
            description: input.description || '',
            permissions: input.permissions || [],
            explicitPermissions: input.permissions || [],
            resolvedPermissions: input.permissions || [],
            moduleBundles: (0, RoleModuleBundleDeriver_1.deriveModuleBundlesFromPermissions)(input.permissions || []),
            isSystem: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Save
        await this.companyRoleRepository.create(role);
        // Return DTO
        return {
            id: role.id,
            companyId: role.companyId,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            explicitPermissions: role.explicitPermissions,
            resolvedPermissions: role.resolvedPermissions,
            moduleBundles: role.moduleBundles,
            isSystem: role.isSystem,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt
        };
    }
}
exports.CreateCompanyRoleUseCase = CreateCompanyRoleUseCase;
//# sourceMappingURL=CreateCompanyRoleUseCase.js.map