import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleDefinition } from '../../../domain/super-admin/ModuleDefinition';

interface CreateModuleInput {
  id: string;
  name: string;
  description: string;
  version: string;
  releaseNotes?: string;
}

export class CreateModuleUseCase {
  constructor(private moduleRepo: IModuleRegistryRepository) {}

  async execute(input: CreateModuleInput): Promise<void> {
    if (input.id === 'core' || input.id === 'companyAdmin') {
      throw new Error('Cannot create "core" or "companyAdmin" as modules - these are system components');
    }

    if (!input.version || input.version.trim() === '') {
      throw new Error('Version is required for module creation');
    }

    const module: ModuleDefinition = {
      id: input.id,
      code: input.id,
      name: input.name,
      description: input.description,
      version: input.version,
      releaseNotes: input.releaseNotes,
      lifecycleStatus: 'draft',
      runtimeStatus: 'available',
      implementationStatus: 'unchecked',
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.moduleRepo.create(module);
  }
}