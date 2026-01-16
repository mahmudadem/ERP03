
import { CostCenter } from '../../../domain/accounting/entities/CostCenter';

/**
 * Interface for Cost Center access.
 */
export interface ICostCenterRepository {
  createCostCenter(costCenter: CostCenter): Promise<void>;
  updateCostCenter(id: string, data: Partial<CostCenter>): Promise<void>;
  getCostCenter(companyId: string, id: string): Promise<CostCenter | null>;
  getCompanyCostCenters(companyId: string): Promise<CostCenter[]>;
}
