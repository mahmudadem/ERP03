"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeletePermissionUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
const PermissionCatalogSyncService_1 = require("../../platform/PermissionCatalogSyncService");
class DeletePermissionUseCase {
    constructor(permissionRepo) {
        this.permissionRepo = permissionRepo;
        this.manifestPermissionKeys = new PermissionCatalogSyncService_1.PermissionCatalogSyncService().getCodeOwnedPermissionKeys();
    }
    async execute(id) {
        const existing = await this.permissionRepo.getById(id);
        if (!existing) {
            throw ApiError_1.ApiError.notFound(`Permission ${id} not found`);
        }
        const isManifestPerm = this.isManifestPermission(id);
        if (isManifestPerm) {
            throw ApiError_1.ApiError.forbidden(`Cannot delete manifest-owned permission ${id}. It is declared in code and synced automatically.`);
        }
        await this.permissionRepo.delete(id);
    }
    isManifestPermission(permId) {
        return this.manifestPermissionKeys.has(permId);
    }
}
exports.DeletePermissionUseCase = DeletePermissionUseCase;
//# sourceMappingURL=DeletePermissionUseCase.js.map