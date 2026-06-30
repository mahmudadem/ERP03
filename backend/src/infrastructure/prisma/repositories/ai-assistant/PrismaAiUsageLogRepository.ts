import { PrismaClient } from '@prisma/client';
import { IAiUsageLogRepository } from '../../../../repository/interfaces/ai-assistant/IAiUsageLogRepository';
import { AiUsageLog } from '../../../../domain/ai-assistant/entities/AiUsageLog';

/**
 * PrismaAiUsageLogRepository
 *
 * SQL implementation for AI usage log persistence.
 * Uses the AiUsageLog model in the Prisma schema.
 */
export class PrismaAiUsageLogRepository implements IAiUsageLogRepository {
  constructor(private prisma: PrismaClient) {}

  async create(log: AiUsageLog): Promise<AiUsageLog> {
    const record = await this.prisma.aiUsageLog.create({
      data: {
        id: log.id,
        companyId: log.companyId,
        userId: log.userId,
        providerType: log.providerType,
        model: log.model,
        messageCount: log.messageCount,
        promptTokens: log.promptTokens ?? null,
        completionTokens: log.completionTokens ?? null,
        totalTokens: log.totalTokens ?? null,
        status: log.status,
        errorCode: log.errorCode ?? null,
        latencyMs: log.latencyMs ?? null,
        createdAt: log.createdAt,
      },
    });
    return AiUsageLog.fromJSON(record);
  }

  async getByCompany(companyId: string, limit: number = 50, offset: number = 0): Promise<AiUsageLog[]> {
    const records = await this.prisma.aiUsageLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
    return records.map(r => AiUsageLog.fromJSON(r));
  }

  async countTodayByCompany(companyId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return this.prisma.aiUsageLog.count({
      where: {
        companyId,
        createdAt: { gte: startOfDay },
      },
    });
  }

  async countTodayByUser(companyId: string, userId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return this.prisma.aiUsageLog.count({
      where: {
        companyId,
        userId,
        createdAt: { gte: startOfDay },
      },
    });
  }

  async getByUser(companyId: string, userId: string, limit: number = 50): Promise<AiUsageLog[]> {
    const records = await this.prisma.aiUsageLog.findMany({
      where: { companyId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return records.map(r => AiUsageLog.fromJSON(r));
  }
}