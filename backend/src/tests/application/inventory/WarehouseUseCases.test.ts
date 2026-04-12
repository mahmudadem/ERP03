import { CreateWarehouseUseCase, GetWarehouseUseCase, UpdateWarehouseUseCase } from '../../../application/inventory/use-cases/WarehouseUseCases';
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { IWarehouseRepository, WarehouseListOptions } from '../../../repository/interfaces/inventory/IWarehouseRepository';

class InMemoryWarehouseRepository implements IWarehouseRepository {
  private readonly warehouses = new Map<string, Warehouse>();

  async createWarehouse(warehouse: Warehouse): Promise<void> {
    this.warehouses.set(warehouse.id, warehouse);
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void> {
    const current = this.warehouses.get(id);
    if (!current) return;

    Object.assign(current, data);
    this.warehouses.set(id, current);
  }

  async getWarehouse(id: string): Promise<Warehouse | null> {
    return this.warehouses.get(id) || null;
  }

  async getCompanyWarehouses(companyId: string, _opts?: WarehouseListOptions): Promise<Warehouse[]> {
    return Array.from(this.warehouses.values()).filter((warehouse) => warehouse.companyId === companyId);
  }

  async getWarehouseByCode(companyId: string, code: string): Promise<Warehouse | null> {
    return (
      Array.from(this.warehouses.values()).find(
        (warehouse) => warehouse.companyId === companyId && warehouse.code === code
      ) || null
    );
  }
}

const makeWarehouse = (overrides: Partial<Warehouse> & { id: string; companyId: string; code: string; name: string }) =>
  new Warehouse({
    id: overrides.id,
    companyId: overrides.companyId,
    name: overrides.name,
    code: overrides.code,
    parentId: overrides.parentId,
    address: overrides.address,
    active: overrides.active ?? true,
    isDefault: overrides.isDefault ?? false,
    createdAt: overrides.createdAt ?? new Date('2026-04-11T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-04-11T00:00:00.000Z'),
  });

describe('Warehouse hierarchy use cases', () => {
  const companyId = 'cmp-1';

  it('creates a child warehouse under an existing parent', async () => {
    const repo = new InMemoryWarehouseRepository();
    const parent = makeWarehouse({
      id: 'wh-parent',
      companyId,
      code: 'MAIN',
      name: 'Main Warehouse',
    });

    await repo.createWarehouse(parent);

    const useCase = new CreateWarehouseUseCase(repo);
    const child = await useCase.execute({
      companyId,
      code: 'A1',
      name: 'Aisle 1',
      parentId: parent.id,
    });

    expect(child.parentId).toBe(parent.id);
  });

  it('blocks assigning a warehouse as its own parent', async () => {
    const repo = new InMemoryWarehouseRepository();
    const warehouse = makeWarehouse({
      id: 'wh-main',
      companyId,
      code: 'MAIN',
      name: 'Main Warehouse',
    });

    await repo.createWarehouse(warehouse);

    const useCase = new UpdateWarehouseUseCase(repo);

    await expect(
      useCase.execute(warehouse.id, {
        parentId: warehouse.id,
      } as Partial<Warehouse>)
    ).rejects.toThrow('Warehouse cannot be its own parent');
  });

  it('blocks hierarchy cycles on update', async () => {
    const repo = new InMemoryWarehouseRepository();
    const parent = makeWarehouse({
      id: 'wh-parent',
      companyId,
      code: 'MAIN',
      name: 'Main Warehouse',
    });
    const child = makeWarehouse({
      id: 'wh-child',
      companyId,
      code: 'A1',
      name: 'Aisle 1',
      parentId: parent.id,
    });

    await repo.createWarehouse(parent);
    await repo.createWarehouse(child);

    const useCase = new UpdateWarehouseUseCase(repo);

    await expect(
      useCase.execute(parent.id, {
        parentId: child.id,
      } as Partial<Warehouse>)
    ).rejects.toThrow('Warehouse hierarchy cannot contain cycles');
  });

  it('returns a warehouse only within the same company scope', async () => {
    const repo = new InMemoryWarehouseRepository();
    const warehouse = makeWarehouse({
      id: 'wh-main',
      companyId,
      code: 'MAIN',
      name: 'Main Warehouse',
    });

    await repo.createWarehouse(warehouse);

    const useCase = new GetWarehouseUseCase(repo);

    await expect(useCase.execute(companyId, warehouse.id)).resolves.toMatchObject({
      id: warehouse.id,
      companyId,
    });
    await expect(useCase.execute('cmp-2', warehouse.id)).resolves.toBeNull();
  });
});
