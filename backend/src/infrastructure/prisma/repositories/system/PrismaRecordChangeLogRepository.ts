import { PrismaClient, Prisma } from '@prisma/client';
import { RecordChangeLog } from '../../../../domain/system/entities/RecordChangeLog';
import {
  IRecordChangeLogRepository,
  RecordChangeLogListFilters,
} from '../../../../repository/interfaces/system/IRecordChangeLogRepository';

export class PrismaRecordChangeLogRepository implements IRecordChangeLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): RecordChangeLog {
    return new RecordChangeLog({
      id: row.id,
      companyId: row.companyId,
      entityType: row.entityType as RecordChangeLog['entityType'],
      entityId: row.entityId,
      entityNumber: row.entityNumber ?? undefined,
      action: row.action as RecordChangeLog['action'],
      changes: (row.changes as any[]) ?? [],
      userId: row.userId,
      userEmail: row.userEmail ?? undefined,
      timestamp: row.timestamp,
      metadata: row.metadata as Record<string, unknown> | undefined,
    });
  }

  async create(entry: RecordChangeLog, _transaction?: unknown): Promise<void> {
    await (this.prisma as any).recordChangeLog.create({
      data: {
        id: entry.id,
        companyId: entry.companyId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityNumber: entry.entityNumber ?? null,
        action: entry.action,
        changes: entry.changes as any,
        userId: entry.userId,
        userEmail: entry.userEmail ?? null,
        timestamp: entry.timestamp,
        metadata: entry.metadata as any ?? undefined,
      },
    });
  }

  async findByEntity(
    companyId: string,
    entityType: string,
    entityId: string
  ): Promise<RecordChangeLog[]> {
    const rows = await (this.prisma as any).recordChangeLog.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { timestamp: 'desc' },
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async list(companyId: string, filters: RecordChangeLogListFilters = {}): Promise<RecordChangeLog[]> {
    const where: any = { companyId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = filters.action;
    if (filters.dateFrom || filters.dateTo) {
      where.timestamp = {};
      if (filters.dateFrom) where.timestamp.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.timestamp.lte = new Date(filters.dateTo);
    }

    const rows = await (this.prisma as any).recordChangeLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }
}
