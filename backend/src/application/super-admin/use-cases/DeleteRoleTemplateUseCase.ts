import { IRoleTemplateRegistryRepository } from '../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';

export class DeleteRoleTemplateUseCase {
  constructor(private roleTemplateRepo: IRoleTemplateRegistryRepository) {}

  async execute(id: string): Promise<void> {
    await this.roleTemplateRepo.delete(id);
  }
}
