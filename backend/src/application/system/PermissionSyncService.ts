import { IModulePermissionsDefinitionRepository } from '../../repository/interfaces/system/IModulePermissionsDefinitionRepository';
import { PERMISSION_CATALOG } from '../../config/PermissionCatalog';
import { ModulePermissionsDefinition } from '../../domain/system/ModulePermissionsDefinition';

export class PermissionSyncService {
    constructor(
        private repo: IModulePermissionsDefinitionRepository
    ) { }

    async sync(): Promise<void> {
        console.log('Starting Permission Sync...');

        for (const moduleCatalog of PERMISSION_CATALOG) {
            const existing = await this.repo.getByModuleId(moduleCatalog.moduleId);

            const definition: ModulePermissionsDefinition = {
                moduleId: moduleCatalog.moduleId,
                permissions: moduleCatalog.permissions.map(p => ({
                    id: p.id,
                    label: p.label,
                    enabled: true
                })),
                autoAttachToRoles: existing?.autoAttachToRoles || [],
                createdAt: existing?.createdAt || new Date(),
                updatedAt: new Date(),
                permissionsDefined: true
            };

            if (existing) {
                await this.repo.update(moduleCatalog.moduleId, definition);
            } else {
                await this.repo.create(definition);
            }
        }

        console.log('Permission Sync Completed.');
    }
}
