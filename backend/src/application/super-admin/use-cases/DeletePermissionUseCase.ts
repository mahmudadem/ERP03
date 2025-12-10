
import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';

export class DeletePermissionUseCase {
  constructor(private permissionRepo: IPermissionRegistryRepository) {}

  async execute(id: string): Promise<void> {
    await this.permissionRepo.delete(id);
  }
}
