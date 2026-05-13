import { PrismaClient } from '@prisma/client';
import { IAiChatRepository } from '../../../../repository/interfaces/ai-assistant/IAiChatRepository';
import { AiChatMessage, AiChatFeedback } from '../../../../domain/ai-assistant/entities/AiChatMessage';

/**
 * PrismaAiChatRepository
 *
 * SQL implementation for AI chat message persistence.
 * Uses the AiChatMessage model in the Prisma schema.
 */
export class PrismaAiChatRepository implements IAiChatRepository {
  constructor(private prisma: PrismaClient) {}

  async create(message: AiChatMessage): Promise<AiChatMessage> {
    const record = await this.prisma.aiChatMessage.create({
      data: {
        id: message.id,
        companyId: message.companyId,
        userId: message.userId,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        provider: message.provider,
        model: message.model || null,
        tokenCount: message.tokenCount || null,
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
        feedback: message.feedback || null,
        createdAt: message.createdAt,
      },
    });
    return AiChatMessage.fromJSON(record as any);
  }

  async getById(companyId: string, messageId: string): Promise<AiChatMessage | null> {
    const record = await this.prisma.aiChatMessage.findFirst({
      where: { id: messageId, companyId },
    });
    if (!record) return null;
    return AiChatMessage.fromJSON({
      ...record,
      metadata: typeof (record as any).metadata === 'string' ? JSON.parse((record as any).metadata) : (record as any).metadata,
    });
  }

  async updateFeedback(companyId: string, messageId: string, feedback: AiChatFeedback | undefined): Promise<AiChatMessage> {
    const record = await this.prisma.aiChatMessage.update({
      where: { id: messageId },
      data: { feedback: feedback || null },
    });
    return AiChatMessage.fromJSON({
      ...record,
      metadata: typeof (record as any).metadata === 'string' ? JSON.parse((record as any).metadata) : (record as any).metadata,
    });
  }

  async getConversationMessages(
    companyId: string,
    userId: string,
    conversationId: string,
    limit: number = 20
  ): Promise<AiChatMessage[]> {
    const records = await this.prisma.aiChatMessage.findMany({
      where: { companyId, userId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return records.map(r => AiChatMessage.fromJSON({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    }));
  }

  async getRecentConversations(
    companyId: string,
    userId: string,
    limit: number = 10
  ): Promise<AiChatMessage[]> {
    // Use a subquery approach to get the latest message per conversation
    const records = await this.prisma.$queryRaw<Array<any>>`
      SELECT DISTINCT ON ("conversationId") *
      FROM "AiChatMessage"
      WHERE "companyId" = ${companyId} AND "userId" = ${userId}
      ORDER BY "conversationId", "createdAt" DESC
      LIMIT ${limit}
    `;
    return (records || []).map(r => AiChatMessage.fromJSON({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    }));
  }

  async deleteConversation(
    companyId: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    await this.prisma.aiChatMessage.deleteMany({
      where: { companyId, userId, conversationId },
    });
  }

  async countToday(companyId: string): Promise<number> {
    // Get start of today (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Only count role='user' messages — each request creates 1 user + 1 assistant message,
    // but the rate limit is per request, not per message.
    return this.prisma.aiChatMessage.count({
      where: {
        companyId,
        role: 'user',
        createdAt: {
          gte: startOfDay,
        },
      },
    });
  }
}