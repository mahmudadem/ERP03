
import { IPlanRegistryRepository } from '../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { PlanDefinition } from '../../../domain/super-admin/PlanDefinition';

export class ListPlansUseCase {
  constructor(private planRepo: IPlanRegistryRepository) {}

  async execute(): Promise<PlanDefinition[]> {
    return await this.planRepo.getAll();
  }
}
