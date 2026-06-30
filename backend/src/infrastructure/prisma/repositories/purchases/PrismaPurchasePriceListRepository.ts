import { PrismaClient, Prisma } from '@prisma/client';
import { PurchasePriceList, PurchasePriceListLine } from '../../../../domain/purchases/entities/PurchasePriceList';
import {
  IPurchasePriceListRepository,
  PurchasePriceListListOptions,
} from '../../../../repository/interfaces/purchases/IPurchasePriceListRepository';

export class PrismaPurchasePriceListRepository implements IPurchasePriceListRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): PurchasePriceList {
    return new PurchasePriceList({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      currency: row.currency,
      status: row.status as 'ACTIVE' | 'INACTIVE',
      validFrom: row.validFrom ?? undefined,
      validTo: row.validTo ?? undefined,
      isDefault: Boolean(row.isDefault),
      lines: (row.lines as PurchasePriceListLine[]) ?? [],
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(list: PurchasePriceList, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).purchasePriceList.create({
      data: {
        id: list.id,
        companyId: list.companyId,
        name: list.name,
        currency: list.currency,
        status: list.status,
        validFrom: list.validFrom ?? null,
        validTo: list.validTo ?? null,
        isDefault: list.isDefault,
        lines: list.lines as unknown as Prisma.InputJsonValue,
        createdBy: list.createdBy,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      },
    });
  }

  async update(list: PurchasePriceList, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).purchasePriceList.update({
      where: { id: list.id },
      data: {
        name: list.name,
        currency: list.currency,
        status: list.status,
        validFrom: list.validFrom ?? null,
        validTo: list.validTo ?? null,
        isDefault: list.isDefault,
        lines: list.lines as unknown as Prisma.InputJsonValue,
        updatedAt: list.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PurchasePriceList | null> {
    const row = await (this.prisma).purchasePriceList.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async getByName(companyId: string, name: string): Promise<PurchasePriceList | null> {
    const row = await (this.prisma).purchasePriceList.findFirst({
      where: { companyId, name },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: PurchasePriceListListOptions): Promise<PurchasePriceList[]> {
    const where: any = { companyId };
    if (opts?.currency) where.currency = opts.currency;
    if (opts?.status) {
      where.status = opts.status;
    } else if (!opts?.includeInactive) {
      where.status = 'ACTIVE';
    }

    const rows = await (this.prisma).purchasePriceList.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async getDefaultForCurrency(companyId: string, currency: string): Promise<PurchasePriceList | null> {
    const row = await (this.prisma).purchasePriceList.findFirst({
      where: { companyId, currency, isDefault: true },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma).purchasePriceList.deleteMany({
      where: { id, companyId },
    });
  }
}
