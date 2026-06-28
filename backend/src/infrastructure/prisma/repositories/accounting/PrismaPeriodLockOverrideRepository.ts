import { PrismaClient, Prisma } from '@prisma/client';
import { PeriodLockOverride } from '../../../../domain/accounting/entities/PeriodLockOverride';
import {
  IPeriodLockOverrideRepository,
  PeriodLockOverrideListOptions,
} from '../../../../repository/interfaces/accounting/IPeriodLockOverrideRepository';

export class PrismaPeriodLockOverrideRepository implements IPeriodLockOverrideRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): PeriodLockOverride {
    return new PeriodLockOverride({
      id: row.id,
      companyId: row.companyId,
      sourceModule: row.sourceModule as 'sales',
      sourceType: row.sourceType as PeriodLockOverride['sourceType'],
      sourceId: row.sourceId,
      sourceNumber: row.sourceNumber,
      documentDate: row.documentDate,
      lockedThroughDate: row.lockedThroughDate,
      reason: row.reason,
      overriddenBy: row.overriddenBy,
      overriddenAt: row.overriddenAt,
      createdAt: row.createdAt,
    });
  }

  async create(override: PeriodLockOverride, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client as any).periodLockOverride.create({
      data: {
        id: override.id,
        companyId: override.companyId,
        sourceModule: override.sourceModule,
        sourceType: override.sourceType,
        sourceId: override.sourceId,
        sourceNumber: override.sourceNumber,
        documentDate: override.documentDate,
        lockedThroughDate: override.lockedThroughDate,
        reason: override.reason,
        overriddenBy: override.overriddenBy,
        overriddenAt: override.overriddenAt,
        createdAt: override.createdAt,
      },
    });
  }

  async listByCompany(
    companyId: string,
    opts?: PeriodLockOverrideListOptions
  ): Promise<PeriodLockOverride[]> {
    const rows = await (this.prisma as any).periodLockOverride.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async findBySource(companyId: string, sourceId: string): Promise<PeriodLockOverride | null> {
    const row = await (this.prisma as any).periodLockOverride.findFirst({
      where: { companyId, sourceId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }
}
