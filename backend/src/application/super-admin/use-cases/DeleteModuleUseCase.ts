
import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';

const REQUIRED_MODULES = ['finance', 'inventory', 'hr'];

export class DeleteModuleUseCase {
  constructor(private moduleRepo: IModuleRegistryRepository) {}

  async execute(id: string): Promise<void> {
    // Prevent deletion of required modules
    if (REQUIRED_MODULES.includes(id)) {
      throw new Error(`Cannot delete required module: ${id}`);
    }

    await this.moduleRepo.delete(id);
  }
}
