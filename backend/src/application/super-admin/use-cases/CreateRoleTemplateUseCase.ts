import { IRoleTemplateRegistryRepository } from '../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { RoleTemplateDefinition } from '../../../domain/super-admin/RoleTemplateDefinition';

interface CreateRoleTemplateInput {
  id: string;
  name: string;
  description: string;
  permissions?: string[];
}

export class CreateRoleTemplateUseCase {
  constructor(private roleTemplateRepo: IRoleTemplateRegistryRepository) {}

  async execute(input: CreateRoleTemplateInput): Promise<void> {
    const roleTemplate: RoleTemplateDefinition = {
      ...input,
      permissions: input.permissions || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.roleTemplateRepo.create(roleTemplate);
  }
}
