"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionSyncService = void 0;
const PermissionCatalog_1 = require("../../config/PermissionCatalog");
class PermissionSyncService {
    constructor(repo) {
        this.repo = repo;
    }
    async sync() {
        console.log('Starting Permission Sync...');
        for (const moduleCatalog of PermissionCatalog_1.PERMISSION_CATALOG) {
            const existing = await this.repo.getByModuleId(moduleCatalog.moduleId);
            const definition = {
                moduleId: moduleCatalog.moduleId,
                permissions: moduleCatalog.permissions.map(p => ({
                    id: p.id,
                    label: p.label,
                    enabled: true
                })),
                autoAttachToRoles: (existing === null || existing === void 0 ? void 0 : existing.autoAttachToRoles) || [],
                createdAt: (existing === null || existing === void 0 ? void 0 : existing.createdAt) || new Date(),
                updatedAt: new Date(),
                permissionsDefined: true
            };
            if (existing) {
                await this.repo.update(moduleCatalog.moduleId, definition);
            }
            else {
                await this.repo.create(definition);
            }
        }
        console.log('Permission Sync Completed.');
    }
}
exports.PermissionSyncService = PermissionSyncService;
//# sourceMappingURL=PermissionSyncService.js.map