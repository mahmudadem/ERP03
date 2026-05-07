"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAiUsageLogRepository = void 0;
const AiUsageLog_1 = require("../../../../domain/ai-assistant/entities/AiUsageLog");
/**
 * PrismaAiUsageLogRepository
 *
 * SQL implementation for AI usage log persistence.
 * Uses the AiUsageLog model in the Prisma schema.
 */
class PrismaAiUsageLogRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(log) {
        var _a, _b, _c, _d, _e;
        const record = await this.prisma.aiUsageLog.create({
            data: {
                id: log.id,
                companyId: log.companyId,
                userId: log.userId,
                providerType: log.providerType,
                model: log.model,
                messageCount: log.messageCount,
                promptTokens: (_a = log.promptTokens) !== null && _a !== void 0 ? _a : null,
                completionTokens: (_b = log.completionTokens) !== null && _b !== void 0 ? _b : null,
                totalTokens: (_c = log.totalTokens) !== null && _c !== void 0 ? _c : null,
                status: log.status,
                errorCode: (_d = log.errorCode) !== null && _d !== void 0 ? _d : null,
                latencyMs: (_e = log.latencyMs) !== null && _e !== void 0 ? _e : null,
                createdAt: log.createdAt,
            },
        });
        return AiUsageLog_1.AiUsageLog.fromJSON(record);
    }
    async getByCompany(companyId, limit = 50, offset = 0) {
        const records = await this.prisma.aiUsageLog.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
        });
        return records.map(r => AiUsageLog_1.AiUsageLog.fromJSON(r));
    }
    async countTodayByCompany(companyId) {
        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        return this.prisma.aiUsageLog.count({
            where: {
                companyId,
                createdAt: { gte: startOfDay },
            },
        });
    }
    async countTodayByUser(companyId, userId) {
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
    async getByUser(companyId, userId, limit = 50) {
        const records = await this.prisma.aiUsageLog.findMany({
            where: { companyId, userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return records.map(r => AiUsageLog_1.AiUsageLog.fromJSON(r));
    }
}
exports.PrismaAiUsageLogRepository = PrismaAiUsageLogRepository;
//# sourceMappingURL=PrismaAiUsageLogRepository.js.map