
import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleDefinition } from '../../../domain/super-admin/ModuleDefinition';

export class ListModulesUseCase {
  constructor(private moduleRepo: IModuleRegistryRepository) {}

  async execute(): Promise<ModuleDefinition[]> {
    return await this.moduleRepo.getAll();
  }
}
