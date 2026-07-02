import { PrismaClient, Prisma } from '@prisma/client';
import { CustomerGroup } from '../../../../domain/sales/entities/CustomerGroup';
import {
  ICustomerGroupRepository,
  CustomerGroupListOptions,
} from '../../../../repository/interfaces/sales/ICustomerGroupRepository';

export class PrismaCustomerGroupRepository implements ICustomerGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): CustomerGroup {
    return new CustomerGroup({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description ?? undefined,
      defaultPriceListId: row.defaultPriceListId ?? undefined,
      defaultPaymentTermsDays: row.defaultPaymentTermsDays ?? undefined,
      defaultCreditLimit: row.defaultCreditLimit ?? undefined,
      taxExempt: Boolean(row.taxExempt),
      status: row.status as 'ACTIVE' | 'INACTIVE',
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(group: CustomerGroup, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).customerGroup.create({
      data: {
        id: group.id,
        companyId: group.companyId,
        name: group.name,
        description: group.description ?? null,
        defaultPriceListId: group.defaultPriceListId ?? null,
        defaultPaymentTermsDays: group.defaultPaymentTermsDays ?? null,
        defaultCreditLimit: group.defaultCreditLimit ?? null,
        taxExempt: group.taxExempt,
        status: group.status,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  }

  async update(group: CustomerGroup, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).customerGroup.update({
      where: { id: group.id },
      data: {
        name: group.name,
        description: group.description ?? null,
        defaultPriceListId: group.defaultPriceListId ?? null,
        defaultPaymentTermsDays: group.defaultPaymentTermsDays ?? null,
        defaultCreditLimit: group.defaultCreditLimit ?? null,
        taxExempt: group.taxExempt,
        status: group.status,
        updatedAt: group.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<CustomerGroup | null> {
    const row = await (this.prisma).customerGroup.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async getByName(companyId: string, name: string): Promise<CustomerGroup | null> {
    const row = await (this.prisma).customerGroup.findFirst({
      where: { companyId, name },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: CustomerGroupListOptions): Promise<CustomerGroup[]> {
    const where: Prisma.CustomerGroupWhereInput = { companyId };
    if (opts?.status) {
      where.status = opts.status;
    } else if (!opts?.includeInactive) {
      where.status = 'ACTIVE';
    }

    const rows = await (this.prisma).customerGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma).customerGroup.deleteMany({
      where: { id, companyId },
    });
  }
}
