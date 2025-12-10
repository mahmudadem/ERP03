
import { IPlanRegistryRepository } from '../../../repository/interfaces/super-admin/IPlanRegistryRepository';

export class DeletePlanUseCase {
  constructor(private planRepo: IPlanRegistryRepository) {}

  async execute(id: string): Promise<void> {
    await this.planRepo.delete(id);
  }
}
