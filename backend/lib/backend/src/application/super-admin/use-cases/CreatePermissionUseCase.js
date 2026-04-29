"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePermissionUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
const PermissionCatalogSyncService_1 = require("../../platform/PermissionCatalogSyncService");
class CreatePermissionUseCase {
    constructor(permissionRepo) {
        this.permissionRepo = permissionRepo;
        this.manifestPermissionKeys = new PermissionCatalogSyncService_1.PermissionCatalogSyncService().getCodeOwnedPermissionKeys();
    }
    async execute(input) {
        const existing = await this.permissionRepo.getById(input.id);
        if (existing) {
            throw ApiError_1.ApiError.badRequest(`Permission ${input.id} already exists`);
        }
        const isManifestPerm = this.isManifestPermission(input.id);
        if (isManifestPerm) {
            throw ApiError_1.ApiError.forbidden(`Cannot create manifest-owned permission ${input.id}. It is declared in code and synced automatically.`);
        }
        const permission = Object.assign(Object.assign({}, input), { createdAt: new Date(), updatedAt: new Date() });
        await this.permissionRepo.create(permission);
    }
    isManifestPermission(permId) {
        return this.manifestPermissionKeys.has(permId);
    }
}
exports.CreatePermissionUseCase = CreatePermissionUseCase;
//# sourceMappingURL=CreatePermissionUseCase.js.map