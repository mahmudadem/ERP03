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

import { AiUsageLog } from '../../../domain/ai-assistant/entities/AiUsageLog';

export interface IAiUsageLogRepository {
  /**
   * Save a usage log entry.
   */
  create(log: AiUsageLog): Promise<AiUsageLog>;

  /**
   * Get usage logs for a company, ordered by most recent first.
   * @param companyId - The company ID
   * @param limit - Maximum number of logs to return
   * @param offset - Number of logs to skip (for pagination)
   */
  getByCompany(companyId: string, limit?: number, offset?: number): Promise<AiUsageLog[]>;

  /**
   * Count usage logs for a company today (UTC).
   * Used for analytics dashboards, NOT for rate limiting.
   */
  countTodayByCompany(companyId: string): Promise<number>;

  /**
   * Count usage logs for a specific user today (UTC).
   * Used for per-user analytics, NOT for rate limiting.
   */
  countTodayByUser(companyId: string, userId: string): Promise<number>;

  /**
   * Get usage logs for a specific user in a company.
   */
  getByUser(companyId: string, userId: string, limit?: number): Promise<AiUsageLog[]>;
}