import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { ApiError } from '../../../api/errors/ApiError';
import { PermissionCatalogSyncService } from '../../platform/PermissionCatalogSyncService';

export class DeletePermissionUseCase {
  private manifestPermissionKeys: Set<string>;

  constructor(private permissionRepo: IPermissionRegistryRepository) {
    this.manifestPermissionKeys = new PermissionCatalogSyncService().getCodeOwnedPermissionKeys();
  }

  async execute(id: string): Promise<void> {
    const existing = await this.permissionRepo.getById(id);
    if (!existing) {
      throw ApiError.notFound(`Permission ${id} not found`);
    }

    const isManifestPerm = this.isManifestPermission(id);
    if (isManifestPerm) {
      throw ApiError.forbidden(`Cannot delete manifest-owned permission ${id}. It is declared in code and synced automatically.`);
    }

    await this.permissionRepo.delete(id);
  }

  private isManifestPermission(permId: string): boolean {
    return this.manifestPermissionKeys.has(permId);
  }
}
