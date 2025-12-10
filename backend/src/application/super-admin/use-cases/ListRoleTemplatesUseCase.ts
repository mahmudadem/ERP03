import { IRoleTemplateRegistryRepository } from '../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { RoleTemplateDefinition } from '../../../domain/super-admin/RoleTemplateDefinition';

export class ListRoleTemplatesUseCase {
  constructor(private roleTemplateRepo: IRoleTemplateRegistryRepository) {}

  async execute(): Promise<RoleTemplateDefinition[]> {
    return await this.roleTemplateRepo.getAll();
  }
}
