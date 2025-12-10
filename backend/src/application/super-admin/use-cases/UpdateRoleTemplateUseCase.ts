import { IRoleTemplateRegistryRepository } from '../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { RoleTemplateDefinition } from '../../../domain/super-admin/RoleTemplateDefinition';

export class UpdateRoleTemplateUseCase {
  constructor(private roleTemplateRepo: IRoleTemplateRegistryRepository) {}

  async execute(data: Partial<RoleTemplateDefinition> & { id: string }): Promise<void> {
    await this.roleTemplateRepo.update(data.id, {
      ...data,
      updatedAt: new Date(),
    });
  }
}
