/**
 * AiRateLimiterService - Enforces per-company daily and per-user burst request limits
 *
 * Two-tier rate limiting:
 * 1. Per-user burst limit (in-memory sliding window)
 *    - Prevents a single user from flooding the AI with rapid requests
 *    - Default: 20 messages per 60-second window per user
 *    - Returns 429 with code RATE_LIMIT_BURST and retryAfter seconds
 *    - In-memory: resets on server restart (acceptable for burst limiting)
 *
 * 2. Per-company daily limit (persisted in AiProviderConfig)
 *    - Prevents a company from exceeding their daily quota
 *    - Default: 100 requests per day per company
 *    - Returns 429 with code RATE_LIMIT_EXCEEDED
 *    - Persists across restarts via config storage
 *
 * Rate Limit Precedence:
 * - Burst limit is checked FIRST (cheaper, in-memory)
 * - Daily limit is checked SECOND (requires DB read/write)
 * - This minimizes DB operations for users hitting burst limits
 */

import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ApiError } from '../../../api/errors/ApiError';

interface BurstEntry {
  timestamps: number[];
}

export interface RateLimitResult {
  /** Which limit was checked */
  type: 'burst' | 'daily';
  /** Current count after increment (daily only) */
  currentCount?: number;
  /** The limit that was checked */
  limit: number;
  /** Seconds until the limit resets (burst only) */
  retryAfter?: number;
}

export class AiRateLimiterService {
  // In-memory burst rate tracking: key = "companyId:userId" → BurstEntry
  private static burstMap = new Map<string, BurstEntry>();

  // Default burst limit: 20 messages per 60-second window
  private static readonly DEFAULT_BURST_LIMIT = 20;
  private static readonly DEFAULT_BURST_WINDOW_MS = 60_000; // 60 seconds

  constructor(
    private settingsRepository: IAiSettingsRepository,
  ) {}

  /**
   * Check per-user burst limit (in-memory sliding window).
   * Throws 429 with RATE_LIMIT_BURST if exceeded.
   */
  private checkBurstLimit(companyId: string, userId: string): RateLimitResult {
    const key = `${companyId}:${userId}`;
    const now = Date.now();
    const windowMs = AiRateLimiterService.DEFAULT_BURST_WINDOW_MS;
    const limit = AiRateLimiterService.DEFAULT_BURST_LIMIT;

    let entry = AiRateLimiterService.burstMap.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      AiRateLimiterService.burstMap.set(key, entry);
    }

    // Remove timestamps outside the sliding window
    entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

    if (entry.timestamps.length >= limit) {
      // Calculate how long until the oldest timestamp expires
      const oldestInWindow = entry.timestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

      throw ApiError.custom(
        429,
        `You're sending messages too quickly. Please wait ${retryAfter} seconds before trying again.`,
        'RATE_LIMIT_BURST',
      );
    }

    // Record this request
    entry.timestamps.push(now);

    return {
      type: 'burst',
      limit,
      retryAfter: 0,
    };
  }

  /**
   * Check per-company daily limit (persisted in AiProviderConfig).
   * Throws 429 with RATE_LIMIT_EXCEEDED if exceeded.
   */
  private async checkDailyLimit(companyId: string): Promise<RateLimitResult> {
    // Get or create default config
    let config = await this.settingsRepository.getConfig(companyId);
    if (!config) {
      config = AiProviderConfig.defaultForCompany(companyId);
    }

    const limit = config.maxRequestsPerDay || 100;
    const currentCount = config.getTodaysRequestCount();

    if (currentCount >= limit) {
      throw ApiError.custom(
        429,
        `Daily AI request limit exceeded (${currentCount}/${limit}). ` +
        `Limit resets at midnight UTC. Adjust the limit in AI Assistant settings.`,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // Increment and save
    config.incrementDailyRequestCount();
    await this.settingsRepository.saveConfig(config);

    return {
      type: 'daily',
      currentCount: config.dailyRequestCount || 1,
      limit,
    };
  }

  /**
   * Check both burst and daily rate limits.
   * Burst is checked first (cheaper, in-memory).
   * Daily is checked second (requires DB read/write).
   *
   * @param companyId - The company to check daily limits for
   * @param userId - The user to check burst limits for
   * @returns RateLimitResult with info about which limit was checked
   * @throws ApiError 429 with RATE_LIMIT_BURST (burst) or RATE_LIMIT_EXCEEDED (daily)
   */
  async checkAndIncrement(companyId: string, userId?: string): Promise<RateLimitResult> {
    // 1. Check burst limit first (in-memory, cheap)
    if (userId) {
      const burstResult = this.checkBurstLimit(companyId, userId);
      // If burst passes, continue to daily check
      // (burst timestamps are already recorded in the map)
    }

    // 2. Check daily limit (persisted, requires DB)
    const dailyResult = await this.checkDailyLimit(companyId);

    return dailyResult;
  }

  /**
   * Clear burst rate limit entries (useful for testing).
   */
  static clearBurstMap(): void {
    AiRateLimiterService.burstMap.clear();
  }
}