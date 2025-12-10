
import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';

interface UpdateModuleInput {
  id: string;
  name?: string;
  description?: string;
}

export class UpdateModuleUseCase {
  constructor(private moduleRepo: IModuleRegistryRepository) {}

  async execute(input: UpdateModuleInput): Promise<void> {
    const { id, ...updates } = input;
    
    await this.moduleRepo.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}
