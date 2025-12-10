
import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';

interface UpdatePermissionInput {
  id: string;
  name?: string;
  description?: string;
}

export class UpdatePermissionUseCase {
  constructor(private permissionRepo: IPermissionRegistryRepository) {}

  async execute(input: UpdatePermissionInput): Promise<void> {
    const { id, ...updates } = input;
    
    await this.permissionRepo.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}
