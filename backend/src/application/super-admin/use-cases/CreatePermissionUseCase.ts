import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { PermissionDefinition } from '../../../domain/super-admin/PermissionDefinition';
import { ApiError } from '../../../api/errors/ApiError';
import { PermissionCatalogSyncService } from '../../platform/PermissionCatalogSyncService';

interface CreatePermissionInput {
  id: string;
  name: string;
  description: string;
}

export class CreatePermissionUseCase {
  private manifestPermissionKeys: Set<string>;

  constructor(private permissionRepo: IPermissionRegistryRepository) {
    this.manifestPermissionKeys = new PermissionCatalogSyncService().getCodeOwnedPermissionKeys();
  }

  async execute(input: CreatePermissionInput): Promise<void> {
    const existing = await this.permissionRepo.getById(input.id);
    if (existing) {
      throw ApiError.badRequest(`Permission ${input.id} already exists`);
    }

    const isManifestPerm = this.isManifestPermission(input.id);
    if (isManifestPerm) {
      throw ApiError.forbidden(`Cannot create manifest-owned permission ${input.id}. It is declared in code and synced automatically.`);
    }

    const permission: PermissionDefinition = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.permissionRepo.create(permission);
  }

  private isManifestPermission(permId: string): boolean {
    return this.manifestPermissionKeys.has(permId);
  }
}
