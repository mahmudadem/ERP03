"use strict";
/**
 * IAiUsageLogRepository - Repository Interface
 *
 * DB-agnostic interface for AI usage log persistence.
 * Implementations: FirestoreAiUsageLogRepository, PrismaAiUsageLogRepository
 *
 * IMPORTANT: This repository is for analytics and auditing ONLY.
 * It must NOT be used for rate limiting, which is handled by
 * AiRateLimiterService using config-based counters in AiProviderConfig.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=IAiUsageLogRepository.js.map