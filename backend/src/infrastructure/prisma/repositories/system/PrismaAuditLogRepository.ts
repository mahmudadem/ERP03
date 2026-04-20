import { PrismaClient } from '@prisma/client';
import { IAuditLogRepository } from '../../../../repository/interfaces/system/IAuditLogRepository';
import { AuditLog } from '../../../../domain/system/entities/AuditLog';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): AuditLog {
    return new AuditLog(
      data.id,
      data.action,
      data.entityType,
      data.entityId,
      data.userId,
      data.timestamp,
      (data.meta as Record<string, any>) || undefined
    );
  }

  async log(entry: AuditLog): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
        timestamp: entry.timestamp,
        meta: entry.meta as any,
      },
    });
  }

  async getLogs(companyId: string, filters?: any): Promise<AuditLog[]> {
    const where: any = { companyId };

    if (filters) {
      if (filters.userId) {
        where.userId = filters.userId;
      }
      if (filters.action) {
        where.action = filters.action;
      }
      if (filters.entityType) {
        where.entityType = filters.entityType;
      }
      if (filters.entityId) {
        where.entityId = filters.entityId;
      }
      if (filters.startDate) {
        where.timestamp = { ...where.timestamp, gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        where.timestamp = { ...where.timestamp, lte: new Date(filters.endDate) };
      }
    }

    const orderBy: any = { timestamp: 'desc' };
    if (filters?.orderBy) {
      orderBy.timestamp = filters.orderBy === 'asc' ? 'asc' : 'desc';
    }

    const data = await this.prisma.auditLog.findMany({
      where,
      orderBy,
      take: filters?.limit ? parseInt(filters.limit, 10) : undefined,
      skip: filters?.offset ? parseInt(filters.offset, 10) : undefined,
    });
    return data.map((d) => this.toDomain(d));
  }
}
