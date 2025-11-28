
import { CostCenter } from '../../../domain/accounting/entities/CostCenter';
import { ICostCenterRepository } from '../../../repository/interfaces/accounting';

export class CreateCostCenterUseCase {
  constructor(private repo: ICostCenterRepository) {}

  async execute(data: { companyId: string; name: string; code: string }): Promise<void> {
    const cc = new CostCenter(`cc_${Date.now()}`, data.companyId, data.name, data.code);
    await this.repo.createCostCenter(cc);
  }
}

export class UpdateCostCenterUseCase {
  constructor(private repo: ICostCenterRepository) {}

  async execute(id: string, data: Partial<CostCenter>): Promise<void> {
    await this.repo.updateCostCenter(id, data);
  }
}
