
import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { PermissionDefinition } from '../../../domain/super-admin/PermissionDefinition';

export class ListPermissionsUseCase {
  constructor(private permissionRepo: IPermissionRegistryRepository) {}

  async execute(): Promise<PermissionDefinition[]> {
    return await this.permissionRepo.getAll();
  }
}
