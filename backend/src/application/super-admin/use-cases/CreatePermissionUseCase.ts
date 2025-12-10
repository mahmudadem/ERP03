
import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { PermissionDefinition } from '../../../domain/super-admin/PermissionDefinition';

interface CreatePermissionInput {
  id: string;
  name: string;
  description: string;
}

export class CreatePermissionUseCase {
  constructor(private permissionRepo: IPermissionRegistryRepository) {}

  async execute(input: CreatePermissionInput): Promise<void> {
    const permission: PermissionDefinition = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.permissionRepo.create(permission);
  }
}
