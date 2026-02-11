import { CostCenter } from '../../../domain/accounting/entities/CostCenter';

export interface ICostCenterRepository {
  findAll(companyId: string): Promise<CostCenter[]>;
  findById(companyId: string, id: string): Promise<CostCenter | null>;
  findByCode(companyId: string, code: string): Promise<CostCenter | null>;
  create(costCenter: CostCenter): Promise<CostCenter>;
  update(costCenter: CostCenter): Promise<CostCenter>;
  delete(companyId: string, id: string): Promise<void>;
}
