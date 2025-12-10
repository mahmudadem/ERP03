import { IRoleTemplateRegistryRepository } from '../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { RoleTemplateDefinition } from '../../../domain/super-admin/RoleTemplateDefinition';

export class GetRoleTemplateByIdUseCase {
  constructor(private roleTemplateRepo: IRoleTemplateRegistryRepository) {}

  async execute(id: string): Promise<RoleTemplateDefinition | null> {
    return await this.roleTemplateRepo.getById(id);
  }
}
