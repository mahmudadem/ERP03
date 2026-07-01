import { PrismaClient, Prisma } from '@prisma/client';
import { VendorGroup } from '../../../../domain/purchases/entities/VendorGroup';
import {
  IVendorGroupRepository,
  VendorGroupListOptions,
} from '../../../../repository/interfaces/purchases/IVendorGroupRepository';

export class PrismaVendorGroupRepository implements IVendorGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): VendorGroup {
    return new VendorGroup({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description ?? undefined,
      status: row.status as 'ACTIVE' | 'INACTIVE',
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(group: VendorGroup, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).vendorGroup.create({
      data: {
        id: group.id,
        companyId: group.companyId,
        name: group.name,
        description: group.description ?? null,
        status: group.status,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  }

  async update(group: VendorGroup, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).vendorGroup.update({
      where: { id: group.id },
      data: {
        name: group.name,
        description: group.description ?? null,
        status: group.status,
        updatedAt: group.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<VendorGroup | null> {
    const row = await (this.prisma).vendorGroup.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async getByName(companyId: string, name: string): Promise<VendorGroup | null> {
    const row = await (this.prisma).vendorGroup.findFirst({
      where: { companyId, name },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: VendorGroupListOptions): Promise<VendorGroup[]> {
    const where: any = { companyId };
    if (opts?.status) {
      where.status = opts.status;
    } else if (!opts?.includeInactive) {
      where.status = 'ACTIVE';
    }

    const rows = await (this.prisma).vendorGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma).vendorGroup.deleteMany({
      where: { id, companyId },
    });
  }
}
