import { PrismaClient, Prisma } from '@prisma/client';
import { PriceList, PriceListLine } from '../../../../domain/sales/entities/PriceList';
import {
  IPriceListRepository,
  PriceListListOptions,
} from '../../../../repository/interfaces/sales/IPriceListRepository';

export class PrismaPriceListRepository implements IPriceListRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): PriceList {
    return new PriceList({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      currency: row.currency,
      status: row.status as 'ACTIVE' | 'INACTIVE',
      validFrom: row.validFrom ?? undefined,
      validTo: row.validTo ?? undefined,
      isDefault: Boolean(row.isDefault),
      lines: (row.lines as PriceListLine[]) ?? [],
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(list: PriceList, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client as any).priceList.create({
      data: {
        id: list.id,
        companyId: list.companyId,
        name: list.name,
        currency: list.currency,
        status: list.status,
        validFrom: list.validFrom ?? null,
        validTo: list.validTo ?? null,
        isDefault: list.isDefault,
        lines: list.lines as any,
        createdBy: list.createdBy,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      },
    });
  }

  async update(list: PriceList, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client as any).priceList.update({
      where: { id: list.id },
      data: {
        name: list.name,
        currency: list.currency,
        status: list.status,
        validFrom: list.validFrom ?? null,
        validTo: list.validTo ?? null,
        isDefault: list.isDefault,
        lines: list.lines as any,
        updatedAt: list.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PriceList | null> {
    const row = await (this.prisma as any).priceList.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async getByName(companyId: string, name: string): Promise<PriceList | null> {
    const row = await (this.prisma as any).priceList.findFirst({
      where: { companyId, name },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: PriceListListOptions): Promise<PriceList[]> {
    const where: any = { companyId };
    if (opts?.currency) where.currency = opts.currency;
    if (opts?.status) {
      where.status = opts.status;
    } else if (!opts?.includeInactive) {
      where.status = 'ACTIVE';
    }

    const rows = await (this.prisma as any).priceList.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async getDefaultForCurrency(companyId: string, currency: string): Promise<PriceList | null> {
    const row = await (this.prisma as any).priceList.findFirst({
      where: { companyId, currency, isDefault: true },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma as any).priceList.deleteMany({
      where: { id, companyId },
    });
  }
}
