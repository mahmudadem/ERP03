
import { IPlanRegistryRepository } from '../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { PlanDefinition } from '../../../domain/super-admin/PlanDefinition';

interface UpdatePlanInput {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  status?: 'active' | 'inactive' | 'deprecated';
  limits?: {
    maxCompanies?: number;
    maxUsersPerCompany?: number;
    maxModulesAllowed?: number;
    maxStorageMB?: number;
    maxTransactionsPerMonth?: number;
  };
}

export class UpdatePlanUseCase {
  constructor(private planRepo: IPlanRegistryRepository) {}

  async execute(input: UpdatePlanInput): Promise<void> {
    const { id, ...updates } = input;
    
    const updateData: Partial<PlanDefinition> = {
      ...updates,
      updatedAt: new Date(),
    } as Partial<PlanDefinition>;
    
    await this.planRepo.update(id, updateData);
  }
}
