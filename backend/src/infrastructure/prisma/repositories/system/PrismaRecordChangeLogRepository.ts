import { PrismaClient, Prisma } from '@prisma/client';
import { RecordChangeLog, FieldChange } from '../../../../domain/system/entities/RecordChangeLog';
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
      changes: (row.changes as unknown as FieldChange[]) ?? [],
      userId: row.userId,
      userEmail: row.userEmail ?? undefined,
      timestamp: row.timestamp,
      metadata: row.metadata as Record<string, unknown> | undefined,
    });
  }

  async create(entry: RecordChangeLog, _transaction?: unknown): Promise<void> {
    await (this.prisma).recordChangeLog.create({
      data: {
        id: entry.id,
        companyId: entry.companyId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityNumber: entry.entityNumber ?? null,
        action: entry.action,
        changes: entry.changes as unknown as Prisma.InputJsonValue,
        userId: entry.userId,
        userEmail: entry.userEmail ?? null,
        timestamp: entry.timestamp,
        metadata: (entry.metadata ?? undefined) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findByEntity(
    companyId: string,
    entityType: string,
    entityId: string
  ): Promise<RecordChangeLog[]> {
    const rows = await (this.prisma).recordChangeLog.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { timestamp: 'desc' },
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async list(companyId: string, filters: RecordChangeLogListFilters = {}): Promise<RecordChangeLog[]> {
    const where: Prisma.RecordChangeLogWhereInput = { companyId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = filters.action;
    if (filters.dateFrom || filters.dateTo) {
      where.timestamp = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    const rows = await (this.prisma).recordChangeLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }
}
