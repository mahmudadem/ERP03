import { PrismaClient } from '@prisma/client';
import { IAiSettingsRepository } from '../../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { AiProviderConfig } from '../../../../domain/ai-assistant/entities/AiProviderConfig';

/**
 * PrismaAiSettingsRepository
 *
 * SQL implementation for AI provider config persistence.
 * Uses the AiProviderConfig model in the Prisma schema.
 */
export class PrismaAiSettingsRepository implements IAiSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async getConfig(companyId: string): Promise<AiProviderConfig | null> {
    const record = await this.prisma.aiProviderConfig.findUnique({
      where: { companyId },
    });
    if (!record) return null;
    return AiProviderConfig.fromJSON(record as any);
  }

  async saveConfig(config: AiProviderConfig): Promise<void> {
    // Note: Prisma reads individual properties from the entity, not from toJSON().
    // This is intentional — the apiKey is accessed directly for persistence.
    // dailyRequestCount and dailyRequestDate are managed by AiRateLimiterService.
    // ⚠ When adding fields to AiProviderConfig, update BOTH this file AND toPersistenceJSON().
    const allowedRuntimeModesJson = config.allowedRuntimeModes
      ? JSON.stringify(config.allowedRuntimeModes)
      : null;

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
        dailyRequestCount: config.dailyRequestCount ?? 0,
        dailyRequestDate: config.dailyRequestDate || null,
        isEnabled: config.isEnabled,
        mode: config.mode || null,
        providerId: config.providerId || null,
        selectedModelProfileId: config.selectedModelProfileId || null,
        selectedProfileHash: config.selectedProfileHash || null,
        conversationContextMode: config.conversationContextMode || null,
        includePreviousToolResults: config.includePreviousToolResults,
        runtimeMode: config.runtimeMode,
        allowedRuntimeModes: allowedRuntimeModesJson,
        updatedAt: config.updatedAt,
      },
      update: {
        provider: config.provider,
        model: config.model || null,
        apiKey: config.apiKey || null,
        apiEndpoint: config.apiEndpoint || null,
        maxTokensPerRequest: config.maxTokensPerRequest || null,
        maxRequestsPerDay: config.maxRequestsPerDay || null,
        dailyRequestCount: config.dailyRequestCount ?? 0,
        dailyRequestDate: config.dailyRequestDate || null,
        isEnabled: config.isEnabled,
        mode: config.mode || null,
        providerId: config.providerId || null,
        selectedModelProfileId: config.selectedModelProfileId || null,
        selectedProfileHash: config.selectedProfileHash || null,
        conversationContextMode: config.conversationContextMode || null,
        includePreviousToolResults: config.includePreviousToolResults,
        runtimeMode: config.runtimeMode,
        allowedRuntimeModes: allowedRuntimeModesJson,
        updatedAt: config.updatedAt,
      },
    });
  }
}