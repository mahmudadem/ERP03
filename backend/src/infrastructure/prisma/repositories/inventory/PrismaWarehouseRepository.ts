import { PrismaClient } from '@prisma/client';
import { IWarehouseRepository, WarehouseListOptions } from '../../../../repository/interfaces/inventory/IWarehouseRepository';
import { Warehouse } from '../../../../domain/inventory/entities/Warehouse';

export class PrismaWarehouseRepository implements IWarehouseRepository {
  constructor(private prisma: PrismaClient) {}

  async createWarehouse(warehouse: Warehouse): Promise<void> {
    await this.prisma.warehouse.create({
      data: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        companyId: warehouse.companyId,
        parentId: warehouse.parentId || null,
        address: warehouse.address || null,
        active: warehouse.active,
        isDefault: warehouse.isDefault,
        createdAt: warehouse.createdAt,
        updatedAt: warehouse.updatedAt,
      } as any,
    });
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void> {
    await this.prisma.warehouse.update({
      where: { id },
      data: data as any,
    });
  }

  async getWarehouse(id: string): Promise<Warehouse | null> {
    const record = await this.prisma.warehouse.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyWarehouses(companyId: string, opts?: WarehouseListOptions): Promise<Warehouse[]> {
    const where: any = { companyId };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    const records = await this.prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getWarehouseByCode(companyId: string, code: string): Promise<Warehouse | null> {
    const record = await this.prisma.warehouse.findFirst({
      where: { companyId, code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  private toDomain(record: any): Warehouse {
    return new Warehouse({
      id: record.id,
      companyId: record.companyId,
      name: record.name,
      code: record.code,
      parentId: record.parentId ?? null,
      address: record.address ?? undefined,
      active: record.active,
      isDefault: record.isDefault,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
