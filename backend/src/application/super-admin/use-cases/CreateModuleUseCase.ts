
import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleDefinition } from '../../../domain/super-admin/ModuleDefinition';

interface CreateModuleInput {
  id: string;
  name: string;
  description: string;
}

export class CreateModuleUseCase {
  constructor(private moduleRepo: IModuleRegistryRepository) {}

  async execute(input: CreateModuleInput): Promise<void> {
    // Prevent creation of core or companyAdmin modules
    if (input.id === 'core' || input.id === 'companyAdmin') {
      throw new Error('Cannot create "core" or "companyAdmin" as modules - these are system components');
    }

    const module: ModuleDefinition = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.moduleRepo.create(module);
  }
}
