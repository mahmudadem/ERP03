"use strict";
/**
 * AiRateLimiterService - Enforces per-company daily request limits
 *
 * Uses the dailyRequestCount and dailyRequestDate fields in AiProviderConfig
 * to track how many requests a company has made today.
 *
 * Design:
 * - Reads the count from AiProviderConfig (stored in DB, survives restarts)
 * - Automatically resets when the UTC day changes
 * - Increments on each successful request
 * - NOT affected by deleting conversations — the count is independent of messages
 * - Per-company, not per-user
 * - DB-agnostic: uses IAiSettingsRepository for persistence
 *
 * IMPORTANT ARCHITECTURE DECISION:
 * - Rate limiting uses CONFIG-BASED counting (dailyRequestCount in AiProviderConfig)
 * - Usage logging uses SEPARATE analytics (AiUsageLog via IAiUsageLogRepository)
 * - These are complementary but INDEPENDENT systems
 * - The usage log should NEVER be used for rate limiting enforcement
 * - This design prevents rate limit bypasses from conversation deletion
 *   (a bug that was previously fixed — see JOURNAL.md 2026-05-05)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiRateLimiterService = void 0;
const AiProviderConfig_1 = require("../../../domain/ai-assistant/entities/AiProviderConfig");
const ApiError_1 = require("../../../api/errors/ApiError");
class AiRateLimiterService {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }
    /**
     * Check if the company is within their daily request limit.
     * If under the limit, increments the count and saves.
     * Throws ApiError with 429 status if the limit is exceeded.
     *
     * @param companyId - The company ID to check
     * @returns The current count and limit (after incrementing)
     * @throws ApiError 429 if limit is exceeded
     */
    async checkAndIncrement(companyId) {
        // Get or create default config
        let config = await this.settingsRepository.getConfig(companyId);
        if (!config) {
            config = AiProviderConfig_1.AiProviderConfig.defaultForCompany(companyId);
        }
        // Decrypt apiKey if present (needed for provider usage, not rate limiting)
        // Note: encryption is handled by AiSettingsUseCase, not here
        // The config from repository has encrypted apiKey, but we don't need it for rate limiting
        const limit = config.maxRequestsPerDay || 100;
        const currentCount = config.getTodaysRequestCount();
        if (currentCount >= limit) {
            throw ApiError_1.ApiError.custom(429, `Daily AI request limit exceeded (${currentCount}/${limit}). ` +
                `Limit resets at midnight UTC. Adjust the limit in AI Assistant settings.`, 'RATE_LIMIT_EXCEEDED');
        }
        // Increment and save
        config.incrementDailyRequestCount();
        await this.settingsRepository.saveConfig(config);
        return { currentCount: config.dailyRequestCount || 1, limit };
    }
}
exports.AiRateLimiterService = AiRateLimiterService;
//# sourceMappingURL=AiRateLimiterService.js.map