"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAiSettingsRepository = void 0;
const AiProviderConfig_1 = require("../../../../domain/ai-assistant/entities/AiProviderConfig");
/**
 * PrismaAiSettingsRepository
 *
 * SQL implementation for AI provider config persistence.
 * Uses the AiProviderConfig model in the Prisma schema.
 */
class PrismaAiSettingsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getConfig(companyId) {
        const record = await this.prisma.aiProviderConfig.findUnique({
            where: { companyId },
        });
        if (!record)
            return null;
        return AiProviderConfig_1.AiProviderConfig.fromJSON(record);
    }
    async saveConfig(config) {
        var _a, _b;
        // Note: Prisma reads individual properties from the entity, not from toJSON().
        // This is intentional — the apiKey is accessed directly for persistence.
        // dailyRequestCount and dailyRequestDate are managed by AiRateLimiterService.
        await this.prisma.aiProviderConfig.upsert({
            where: { companyId: config.companyId },
            create: {
                companyId: config.companyId,
                provider: config.provider,
                model: config.model || null,
                apiKey: config.apiKey || null,
                apiEndpoint: config.apiEndpoint || null,
                maxTokensPerRequest: config.maxTokensPerRequest || null,
                maxRequestsPerDay: config.maxRequestsPerDay || null,
                dailyRequestCount: (_a = config.dailyRequestCount) !== null && _a !== void 0 ? _a : 0,
                dailyRequestDate: config.dailyRequestDate || null,
                isEnabled: config.isEnabled,
                updatedAt: config.updatedAt,
            },
            update: {
                provider: config.provider,
                model: config.model || null,
                apiKey: config.apiKey || null,
                apiEndpoint: config.apiEndpoint || null,
                maxTokensPerRequest: config.maxTokensPerRequest || null,
                maxRequestsPerDay: config.maxRequestsPerDay || null,
                dailyRequestCount: (_b = config.dailyRequestCount) !== null && _b !== void 0 ? _b : 0,
                dailyRequestDate: config.dailyRequestDate || null,
                isEnabled: config.isEnabled,
                updatedAt: config.updatedAt,
            },
        });
    }
}
exports.PrismaAiSettingsRepository = PrismaAiSettingsRepository;
//# sourceMappingURL=PrismaAiSettingsRepository.js.map