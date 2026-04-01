
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { IWarehouseRepository, WarehouseListOptions } from '../../../repository/interfaces/inventory';
import { randomUUID } from 'crypto';

export interface CreateWarehouseInput {
  companyId: string;
  name: string;
  code: string;
  address?: string;
  isDefault?: boolean;
}

export class CreateWarehouseUseCase {
  constructor(private readonly repo: IWarehouseRepository) {}

  async execute(data: CreateWarehouseInput): Promise<Warehouse> {
    const byCode = await this.repo.getWarehouseByCode(data.companyId, data.code);
    if (byCode) {
      throw new Error(`Warehouse code already exists: ${data.code}`);
    }

    const now = new Date();
    const wh = new Warehouse({
      id: randomUUID(),
      companyId: data.companyId,
      name: data.name,
      code: data.code,
      address: data.address,
      active: true,
      isDefault: data.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.createWarehouse(wh);
    return wh;
  }
}

export class UpdateWarehouseUseCase {
  constructor(private readonly repo: IWarehouseRepository) {}

  async execute(id: string, data: Partial<Warehouse>): Promise<Warehouse> {
    const current = await this.repo.getWarehouse(id);
    if (!current) throw new Error(`Warehouse not found: ${id}`);

    if (data.code && data.code !== current.code) {
      const duplicate = await this.repo.getWarehouseByCode(current.companyId, data.code);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Warehouse code already exists: ${data.code}`);
      }
    }

    await this.repo.updateWarehouse(id, data);
    const updated = await this.repo.getWarehouse(id);
    if (!updated) throw new Error(`Warehouse not found after update: ${id}`);
    return updated;
  }
}

export class ListWarehousesUseCase {
  constructor(private readonly repo: IWarehouseRepository) {}

  async execute(companyId: string, filters: WarehouseListOptions = {}): Promise<Warehouse[]> {
    return this.repo.getCompanyWarehouses(companyId, filters);
  }
}
