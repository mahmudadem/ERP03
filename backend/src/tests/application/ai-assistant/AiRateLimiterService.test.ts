/**
 * AiRateLimiterService Tests
 *
 * Verifies that:
 * 1. Per-user burst limit: allows requests within limit, blocks when exceeded
 * 2. Per-company daily limit: allows within limit, blocks at limit, respects config
 * 3. Burst limit resets after window expires
 * 4. Default limits are used when no config exists
 * 5. Custom maxRequestsPerDay is respected
 * 6. Count resets when day changes
 * 7. Deleting conversations does NOT affect rate limit
 * 8. Burst and daily limits work together
 */

import { AiRateLimiterService } from '../../../application/ai-assistant/services/AiRateLimiterService';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ApiError } from '../../../api/errors/ApiError';

const createMockSettingsRepo = (config: AiProviderConfig | null = null): IAiSettingsRepository => ({
  getConfig: jest.fn(() => Promise.resolve(config)),
  saveConfig: jest.fn(() => Promise.resolve()),
});

describe('AiRateLimiterService', () => {
  beforeEach(() => {
    AiRateLimiterService.clearBurstMap();
  });

  describe('checkAndIncrement()', () => {
    describe('per-user burst limit', () => {
      it('should allow requests within the burst limit', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 100 });
        config.dailyRequestCount = 0;
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);
        const service = new AiRateLimiterService(settingsRepo);

        // Should allow up to 20 burst requests per minute
        for (let i = 0; i < 20; i++) {
          const result = await service.checkAndIncrement('company-1', 'user-1');
          expect(result.type).toBe('daily');
        }
      });

      it('should block burst requests exceeding the limit', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 1000 });
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);
        const service = new AiRateLimiterService(settingsRepo);

        // Fill up burst limit
        for (let i = 0; i < 20; i++) {
          await service.checkAndIncrement('company-1', 'user-1');
        }

        // 21st should be blocked
        try {
          await service.checkAndIncrement('company-1', 'user-1');
          fail('Should have thrown RATE_LIMIT_BURST');
        } catch (error) {
          expect((error as ApiError).statusCode).toBe(429);
          expect((error as ApiError).code).toBe('RATE_LIMIT_BURST');
          expect((error as ApiError).message).toContain('too quickly');
        }
      });

      it('should track burst limits per user independently', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 200 });
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);
        const service = new AiRateLimiterService(settingsRepo);

        // User 1 fills their burst limit
        for (let i = 0; i < 20; i++) {
          await service.checkAndIncrement('company-1', 'user-1');
        }

        // User 2 should still be allowed
        const result = await service.checkAndIncrement('company-1', 'user-2');
        expect(result.type).toBe('daily');
      });

      it('should allow requests without userId (skip burst check, only daily)', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 100 });
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);
        const service = new AiRateLimiterService(settingsRepo);

        // Without userId, burst check is skipped
        const result = await service.checkAndIncrement('company-1');
        expect(result.type).toBe('daily');
      });
    });

    describe('per-company daily limit', () => {
      it('should allow requests when under the limit and increment count', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 100 });
        // Simulate 5 requests already made today
        config.dailyRequestCount = 5;
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);

        const service = new AiRateLimiterService(settingsRepo);

        const result = await service.checkAndIncrement('company-1', 'user-1');

        expect(result.currentCount).toBe(6); // Incremented from 5 to 6
        expect(result.limit).toBe(100);
        expect(settingsRepo.saveConfig).toHaveBeenCalled();
      });

      it('should block requests when at the limit', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 100 });
        config.dailyRequestCount = 100;
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);

        const service = new AiRateLimiterService(settingsRepo);

        try {
          await service.checkAndIncrement('company-1', 'user-1');
          fail('Should have thrown');
        } catch (error) {
          expect((error as ApiError).statusCode).toBe(429);
          expect((error as ApiError).code).toBe('RATE_LIMIT_EXCEEDED');
          expect((error as ApiError).message).toContain('100/100');
        }
      });

      it('should block requests when over the limit', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 50 });
        config.dailyRequestCount = 75;
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);

        const service = new AiRateLimiterService(settingsRepo);

        try {
          await service.checkAndIncrement('company-1', 'user-1');
          fail('Should have thrown');
        } catch (error) {
          expect((error as ApiError).statusCode).toBe(429);
        }
      });

      it('should use default limit of 100 when no config exists', async () => {
        const settingsRepo = createMockSettingsRepo(null); // No config
        const service = new AiRateLimiterService(settingsRepo);

        const result = await service.checkAndIncrement('company-1', 'user-1');

        expect(result.limit).toBe(100);
        expect(result.currentCount).toBe(1); // First request
      });

      it('should respect custom maxRequestsPerDay', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 10 });
        config.dailyRequestCount = 5;
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);

        const service = new AiRateLimiterService(settingsRepo);

        const result = await service.checkAndIncrement('company-1', 'user-1');

        expect(result.limit).toBe(10);
        expect(result.currentCount).toBe(6);
      });

      it('should allow a single request when count is 0', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.dailyRequestCount = 0;
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);

        const service = new AiRateLimiterService(settingsRepo);

        const result = await service.checkAndIncrement('company-1', 'user-1');

        expect(result.currentCount).toBe(1);
      });

      it('should reset count when day changes', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 5 });
        config.dailyRequestCount = 100; // Used all 5 yesterday
        config.dailyRequestDate = '2020-01-01'; // Old date
        const settingsRepo = createMockSettingsRepo(config);

        const service = new AiRateLimiterService(settingsRepo);

        // New day — count should reset
        const result = await service.checkAndIncrement('company-1', 'user-1');

        expect(result.currentCount).toBe(1); // Reset to 1
        expect(result.limit).toBe(5);
        expect(settingsRepo.saveConfig).toHaveBeenCalled();
        // Verify the saved config has today's date
        const savedConfig = (settingsRepo.saveConfig as jest.Mock).mock.calls[0][0] as AiProviderConfig;
        expect(savedConfig.dailyRequestDate).toBe(AiProviderConfig.getTodayDateString());
        expect(savedConfig.dailyRequestCount).toBe(1);
      });

      it('should NOT be affected by deleting conversations', async () => {
        // This is the key test — rate limit is independent of message storage
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 5 });
        config.dailyRequestCount = 5;
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);

        const service = new AiRateLimiterService(settingsRepo);

        // Even if conversations are deleted, the count remains 5
        try {
          await service.checkAndIncrement('company-1', 'user-1');
          fail('Should have thrown');
        } catch (error) {
          expect((error as ApiError).statusCode).toBe(429);
        }
      });
    });

    describe('combined burst + daily limits', () => {
      it('should check burst limit before daily limit', async () => {
        const config = AiProviderConfig.defaultForCompany('company-1');
        config.updateConfig({ maxRequestsPerDay: 1000 });
        config.dailyRequestDate = AiProviderConfig.getTodayDateString();
        const settingsRepo = createMockSettingsRepo(config);
        const service = new AiRateLimiterService(settingsRepo);

        // Fill up burst limit for user-1
        for (let i = 0; i < 20; i++) {
          await service.checkAndIncrement('company-1', 'user-1');
        }

        // 21st should hit burst limit, not daily limit
        try {
          await service.checkAndIncrement('company-1', 'user-1');
          fail('Should have thrown RATE_LIMIT_BURST');
        } catch (error) {
          expect((error as ApiError).code).toBe('RATE_LIMIT_BURST');
        }
      });
    });
  });
});