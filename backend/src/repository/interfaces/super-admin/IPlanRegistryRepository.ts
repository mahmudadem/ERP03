
import { PlanDefinition } from '../../../domain/super-admin/PlanDefinition';

/**
 * Repository interface for Plan Registry management.
 */
export interface IPlanRegistryRepository {
  getAll(): Promise<PlanDefinition[]>;
  getById(id: string): Promise<PlanDefinition | null>;
  create(plan: PlanDefinition): Promise<void>;
  update(id: string, plan: Partial<PlanDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
