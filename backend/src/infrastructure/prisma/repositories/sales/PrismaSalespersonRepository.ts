import { PrismaClient, Prisma } from '@prisma/client';
import { Salesperson } from '../../../../domain/sales/entities/Salesperson';
import {
  ISalespersonRepository,
  SalespersonListOptions,
} from '../../../../repository/interfaces/sales/ISalespersonRepository';

export class PrismaSalespersonRepository implements ISalespersonRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): Salesperson {
    return new Salesperson({
      id: row.id,
      companyId: row.companyId,
      code: row.code,
      name: row.name,
      email: row.email ?? undefined,
      defaultCommissionPct: row.defaultCommissionPct,
      commissionPayableAccountId: row.commissionPayableAccountId ?? undefined,
      status: row.status as 'ACTIVE' | 'INACTIVE',
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(salesperson: Salesperson, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).salesperson.create({
      data: {
        id: salesperson.id,
        companyId: salesperson.companyId,
        code: salesperson.code,
        name: salesperson.name,
        email: salesperson.email ?? null,
        defaultCommissionPct: salesperson.defaultCommissionPct,
        commissionPayableAccountId: salesperson.commissionPayableAccountId ?? null,
        status: salesperson.status,
        createdBy: salesperson.createdBy,
        createdAt: salesperson.createdAt,
        updatedAt: salesperson.updatedAt,
      },
    });
  }

  async update(salesperson: Salesperson, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).salesperson.update({
      where: { id: salesperson.id },
      data: {
        code: salesperson.code,
        name: salesperson.name,
        email: salesperson.email ?? null,
        defaultCommissionPct: salesperson.defaultCommissionPct,
        commissionPayableAccountId: salesperson.commissionPayableAccountId ?? null,
        status: salesperson.status,
        updatedAt: salesperson.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<Salesperson | null> {
    const row = await (this.prisma).salesperson.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async getByCode(companyId: string, code: string): Promise<Salesperson | null> {
    const row = await (this.prisma).salesperson.findFirst({
      where: { companyId, code },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: SalespersonListOptions): Promise<Salesperson[]> {
    const where: any = { companyId };
    if (opts?.status) {
      where.status = opts.status;
    } else if (!opts?.includeInactive) {
      where.status = 'ACTIVE';
    }

    const rows = await (this.prisma).salesperson.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma).salesperson.deleteMany({
      where: { id, companyId },
    });
  }
}
