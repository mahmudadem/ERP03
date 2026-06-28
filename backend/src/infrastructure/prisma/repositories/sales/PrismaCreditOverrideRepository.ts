import { PrismaClient, Prisma } from '@prisma/client';
import { CreditOverride } from '../../../../domain/sales/entities/CreditOverride';
import {
  ICreditOverrideRepository,
  CreditOverrideListOptions,
} from '../../../../repository/interfaces/sales/ICreditOverrideRepository';

export class PrismaCreditOverrideRepository implements ICreditOverrideRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): CreditOverride {
    return new CreditOverride({
      id: row.id,
      companyId: row.companyId,
      customerId: row.customerId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceNumber: row.sourceNumber,
      creditLimit: row.creditLimit,
      currentExposure: row.currentExposure,
      orderAmount: row.orderAmount,
      projectedExposure: row.projectedExposure,
      reason: row.reason,
      overriddenBy: row.overriddenBy,
      overriddenAt: row.overriddenAt,
      createdAt: row.createdAt,
    });
  }

  async create(override: CreditOverride, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client as any).creditOverride.create({
      data: {
        id: override.id,
        companyId: override.companyId,
        customerId: override.customerId,
        sourceType: override.sourceType,
        sourceId: override.sourceId,
        sourceNumber: override.sourceNumber,
        creditLimit: override.creditLimit,
        currentExposure: override.currentExposure,
        orderAmount: override.orderAmount,
        projectedExposure: override.projectedExposure,
        reason: override.reason,
        overriddenBy: override.overriddenBy,
        overriddenAt: override.overriddenAt,
        createdAt: override.createdAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<CreditOverride | null> {
    const row = await (this.prisma as any).creditOverride.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: CreditOverrideListOptions): Promise<CreditOverride[]> {
    const where: any = { companyId };
    if (opts?.customerId) where.customerId = opts.customerId;
    if (opts?.sourceId) where.sourceId = opts.sourceId;

    const rows = await (this.prisma as any).creditOverride.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }
}
