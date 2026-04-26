import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';

export class DeleteModuleUseCase {
  constructor(private moduleRepo: IModuleRegistryRepository) {}

  async execute(id: string): Promise<void> {
    const module = await this.moduleRepo.getById(id);
    if (!module) {
      throw new Error('Module not found');
    }

    if (module.lifecycleStatus === 'ready') {
      throw new Error('Cannot delete a module with lifecycleStatus=ready. Deprecate it first.');
    }

    await this.moduleRepo.delete(id);
  }
}