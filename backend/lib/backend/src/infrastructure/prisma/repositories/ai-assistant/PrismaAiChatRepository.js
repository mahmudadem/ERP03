"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAiChatRepository = void 0;
const AiChatMessage_1 = require("../../../../domain/ai-assistant/entities/AiChatMessage");
/**
 * PrismaAiChatRepository
 *
 * SQL implementation for AI chat message persistence.
 * Uses the AiChatMessage model in the Prisma schema.
 */
class PrismaAiChatRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(message) {
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
                createdAt: message.createdAt,
            },
        });
        return AiChatMessage_1.AiChatMessage.fromJSON(record);
    }
    async getConversationMessages(companyId, userId, conversationId, limit = 20) {
        const records = await this.prisma.aiChatMessage.findMany({
            where: { companyId, userId, conversationId },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
        return records.map(r => AiChatMessage_1.AiChatMessage.fromJSON(Object.assign(Object.assign({}, r), { metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata })));
    }
    async getRecentConversations(companyId, userId, limit = 10) {
        // Use a subquery approach to get the latest message per conversation
        const records = await this.prisma.$queryRaw `
      SELECT DISTINCT ON ("conversationId") *
      FROM "AiChatMessage"
      WHERE "companyId" = ${companyId} AND "userId" = ${userId}
      ORDER BY "conversationId", "createdAt" DESC
      LIMIT ${limit}
    `;
        return (records || []).map(r => AiChatMessage_1.AiChatMessage.fromJSON(Object.assign(Object.assign({}, r), { metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata })));
    }
    async deleteConversation(companyId, userId, conversationId) {
        await this.prisma.aiChatMessage.deleteMany({
            where: { companyId, userId, conversationId },
        });
    }
    async countToday(companyId) {
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
exports.PrismaAiChatRepository = PrismaAiChatRepository;
//# sourceMappingURL=PrismaAiChatRepository.js.map