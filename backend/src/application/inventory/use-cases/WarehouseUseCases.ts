
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { IWarehouseRepository, WarehouseListOptions } from '../../../repository/interfaces/inventory';
import { randomUUID } from 'crypto';

export interface CreateWarehouseInput {
  companyId: string;
  name: string;
  code: string;
  parentId?: string | null;
  address?: string;
  isDefault?: boolean;
}

const normalizeParentId = (parentId?: string | null): string | null | undefined => {
  if (parentId === undefined) return undefined;
  const trimmed = parentId?.trim();
  return trimmed ? trimmed : null;
};

const resolveValidatedParent = async (
  repo: IWarehouseRepository,
  companyId: string,
  currentWarehouseId: string | null,
  candidateParentId?: string | null
): Promise<string | null | undefined> => {
  const normalizedParentId = normalizeParentId(candidateParentId);
  if (normalizedParentId === undefined || normalizedParentId === null) {
    return normalizedParentId;
  }

  if (currentWarehouseId && normalizedParentId === currentWarehouseId) {
    throw new Error('Warehouse cannot be its own parent');
  }

  let cursor = await repo.getWarehouse(normalizedParentId);
  if (!cursor || cursor.companyId !== companyId) {
    throw new Error(`Parent warehouse not found: ${normalizedParentId}`);
  }

  const visited = new Set<string>();
  while (cursor) {
    if (visited.has(cursor.id)) break;
    if (cursor.companyId !== companyId) {
      throw new Error(`Parent warehouse not found: ${normalizedParentId}`);
    }
    if (currentWarehouseId && cursor.id === currentWarehouseId) {
      throw new Error('Warehouse hierarchy cannot contain cycles');
    }

    visited.add(cursor.id);
    if (!cursor.parentId) break;
    cursor = await repo.getWarehouse(cursor.parentId);
  }

  return normalizedParentId;
};

export class CreateWarehouseUseCase {
  constructor(private readonly repo: IWarehouseRepository) {}

  async execute(data: CreateWarehouseInput): Promise<Warehouse> {
    const byCode = await this.repo.getWarehouseByCode(data.companyId, data.code);
    if (byCode) {
      throw new Error(`Warehouse code already exists: ${data.code}`);
    }

    const parentId = await resolveValidatedParent(this.repo, data.companyId, null, data.parentId);
    const now = new Date();
    const wh = new Warehouse({
      id: randomUUID(),
      companyId: data.companyId,
      name: data.name,
      code: data.code,
      parentId,
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

    const updatePayload: Partial<Warehouse> = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.parentId !== undefined) {
      updatePayload.parentId = await resolveValidatedParent(
        this.repo,
        current.companyId,
        id,
        data.parentId
      );
    }

    await this.repo.updateWarehouse(id, updatePayload);
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
