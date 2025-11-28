
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory';

export class CreateWarehouseUseCase {
  constructor(private repo: IWarehouseRepository) {}

  async execute(data: { companyId: string; name: string; location?: string }): Promise<void> {
    const wh = new Warehouse(`wh_${Date.now()}`, data.companyId, data.name, data.location);
    await this.repo.createWarehouse(wh);
  }
}

export class UpdateWarehouseUseCase {
  constructor(private repo: IWarehouseRepository) {}
  async execute(id: string, data: Partial<Warehouse>): Promise<void> {
    await this.repo.updateWarehouse(id, data);
  }
}
