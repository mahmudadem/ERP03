
import { IPlanRegistryRepository } from '../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { PlanDefinition } from '../../../domain/super-admin/PlanDefinition';

interface CreatePlanInput {
  id: string;
  name: string;
  description: string;
  price: number;
  status: 'active' | 'inactive' | 'deprecated';
  limits: {
    maxCompanies: number;
    maxUsersPerCompany: number;
    maxModulesAllowed: number;
    maxStorageMB: number;
    maxTransactionsPerMonth: number;
  };
}

export class CreatePlanUseCase {
  constructor(private planRepo: IPlanRegistryRepository) {}

  async execute(input: CreatePlanInput): Promise<void> {
    const plan: PlanDefinition = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.planRepo.create(plan);
  }
}
