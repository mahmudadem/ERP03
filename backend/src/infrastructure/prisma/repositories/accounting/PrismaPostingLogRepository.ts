import { PrismaClient, Prisma } from '@prisma/client';
import { PostingLog, LineDecision } from '../../../../domain/accounting/entities/PostingLog';
import { IPostingLogRepository } from '../../../../repository/interfaces/accounting/IPostingLogRepository';

export class PrismaPostingLogRepository implements IPostingLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): PostingLog {
    return new PostingLog({
      id: row.id,
      companyId: row.companyId,
      sourceModule: row.sourceModule,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceDocNumber: row.sourceDocNumber ?? undefined,
      strategy: row.strategy,
      voucherIds: row.voucherIds ?? [],
      decisions: (row.decisions as unknown as LineDecision[]) ?? [],
      warnings: row.warnings ?? [],
      idempotencyKey: row.idempotencyKey ?? undefined,
      postedAt: row.postedAt,
      postedBy: row.postedBy,
    });
  }

  async create(log: PostingLog, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).postingLog.create({
      data: {
        id: log.id,
        companyId: log.companyId,
        sourceModule: log.sourceModule,
        sourceType: log.sourceType,
        sourceId: log.sourceId,
        sourceDocNumber: log.sourceDocNumber ?? null,
        strategy: log.strategy,
        voucherIds: log.voucherIds,
        decisions: log.decisions as unknown as Prisma.InputJsonValue,
        warnings: log.warnings,
        idempotencyKey: log.idempotencyKey ?? null,
        postedAt: log.postedAt,
        postedBy: log.postedBy,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PostingLog | null> {
    const row = await (this.prisma).postingLog.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findBySourceId(companyId: string, sourceId: string): Promise<PostingLog[]> {
    const rows = await (this.prisma).postingLog.findMany({
      where: { companyId, sourceId },
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async listBySource(
    companyId: string,
    filter: { sourceModule?: string; sourceType?: string; limit?: number }
  ): Promise<PostingLog[]> {
    const where: any = { companyId };
    if (filter.sourceModule) where.sourceModule = filter.sourceModule;
    if (filter.sourceType) where.sourceType = filter.sourceType;

    const rows = await (this.prisma).postingLog.findMany({
      where,
      take: filter.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }
}
