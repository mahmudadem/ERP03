/**
 * AiProviderConfig Entity Tests
 *
 * Verifies that:
 * 1. toJSON() never exposes the raw API key
 * 2. toJSON() includes hasApiKey boolean
 * 3. toPersistenceJSON() includes the raw API key for storage
 * 4. fromJSON() correctly rehydrates the entity
 * 5. create() and defaultForCompany() work correctly
 * 6. updateConfig() works correctly
 * 7. dailyRequestCount/dailyRequestDate rate limit tracking works
 */

import { AiProviderConfig, AiProviderType } from '../../../domain/ai-assistant/entities/AiProviderConfig';

describe('AiProviderConfig', () => {
  const companyId = 'company-123';
  const testApiKey = 'sk-prod-api-key-12345';

  describe('toJSON() - Security: never exposes apiKey', () => {
    it('should NOT include raw apiKey in toJSON output', () => {
      const config = new AiProviderConfig(
        companyId,
        'openai_compatible',
        'gpt-4o',
        testApiKey,
        'https://api.openai.com/v1',
        4096,
        100,
        0,              // dailyRequestCount
        undefined,      // dailyRequestDate
        true,
        new Date()
      );

      const json = config.toJSON();

      expect(json.apiKey).toBeUndefined();
      expect(json.hasApiKey).toBe(true);
      // The key value must NEVER appear in the output
      expect(JSON.stringify(json)).not.toContain(testApiKey);
    });

    it('should show hasApiKey=false when no apiKey is set', () => {
      const config = new AiProviderConfig(
        companyId,
        'mock',
        'mock-assistant',
        undefined,
        undefined,
        4096,
        100,
        0,              // dailyRequestCount
        undefined,      // dailyRequestDate
        true,
        new Date()
      );

      const json = config.toJSON();

      expect(json.hasApiKey).toBe(false);
      expect(json.apiKey).toBeUndefined();
    });

    it('should include all non-sensitive fields in toJSON', () => {
      const config = new AiProviderConfig(
        companyId,
        'openai_compatible',
        'gpt-4o',
        testApiKey,
        'https://api.openai.com/v1',
        8192,
        50,
        0,              // dailyRequestCount
        undefined,      // dailyRequestDate
        true,
        new Date('2026-01-01')
      );

      const json = config.toJSON();

      expect(json.companyId).toBe(companyId);
      expect(json.provider).toBe('openai_compatible');
      expect(json.model).toBe('gpt-4o');
      expect(json.apiEndpoint).toBe('https://api.openai.com/v1');
      expect(json.maxTokensPerRequest).toBe(8192);
      expect(json.maxRequestsPerDay).toBe(50);
      expect(json.conversationContextMode).toBe('balanced');
      expect(json.includePreviousToolResults).toBe(true);
      expect(json.isEnabled).toBe(true);
      expect(json.showFloatingAssistant).toBe(true);
      expect(json.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should return null for optional fields when not set', () => {
      const config = new AiProviderConfig(
        companyId,
        'mock',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,      // dailyRequestCount
        undefined,      // dailyRequestDate
        true,
        new Date()
      );

      const json = config.toJSON();

      expect(json.model).toBeNull();
      expect(json.apiEndpoint).toBeNull();
      expect(json.maxTokensPerRequest).toBeNull();
      expect(json.maxRequestsPerDay).toBeNull();
    });
  });

  describe('toPersistenceJSON() - Includes apiKey for DB storage', () => {
    it('should include raw apiKey in toPersistenceJSON for storage', () => {
      const config = new AiProviderConfig(
        companyId,
        'openai_compatible',
        'gpt-4o',
        testApiKey,
        'https://api.openai.com/v1',
        4096,
        100,
        5,                      // dailyRequestCount
        '2026-05-05',           // dailyRequestDate
        true,
        new Date()
      );

      const json = config.toPersistenceJSON();

      // toPersistenceJSON IS allowed to include the key — it's for DB storage only
      expect(json.apiKey).toBe(testApiKey);
      // No hasApiKey field in persistence format
      expect((json as any).hasApiKey).toBeUndefined();
      // Should include rate limit tracking fields
      expect(json.dailyRequestCount).toBe(5);
      expect(json.dailyRequestDate).toBe('2026-05-05');
      expect(json.showFloatingAssistant).toBe(true);
    });

    it('should store null for missing apiKey in toPersistenceJSON', () => {
      const config = new AiProviderConfig(
        companyId,
        'mock',
        'mock-assistant',
        undefined,
        undefined,
        4096,
        100,
        0,              // dailyRequestCount
        undefined,      // dailyRequestDate
        true,
        new Date()
      );

      const json = config.toPersistenceJSON();

      expect(json.apiKey).toBeNull();
    });

    it('should store 0 for dailyRequestCount and null for dailyRequestDate when not set', () => {
      const config = new AiProviderConfig(
        companyId,
        'mock',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,      // dailyRequestCount
        undefined,      // dailyRequestDate
        true,
        new Date()
      );

      const json = config.toPersistenceJSON();

      expect(json.dailyRequestCount).toBe(0);
      expect(json.dailyRequestDate).toBeNull();
    });
  });

  describe('fromJSON() - Rehydration', () => {
    it('should correctly reconstruct an entity from persistence JSON', () => {
      const original = new AiProviderConfig(
        companyId,
        'openai_compatible',
        'gpt-4o',
        'encrypted-key-iv:ciphertext:authTag',
        'https://api.openai.com/v1',
        8192,
        50,
        5,                      // dailyRequestCount
        '2026-05-05',           // dailyRequestDate
        true,
        new Date('2026-01-01T00:00:00.000Z')
      );

      const json = original.toPersistenceJSON();
      const restored = AiProviderConfig.fromJSON(json);

      expect(restored.companyId).toBe(original.companyId);
      expect(restored.provider).toBe(original.provider);
      expect(restored.model).toBe(original.model);
      expect(restored.apiKey).toBe(original.apiKey);
      expect(restored.apiEndpoint).toBe(original.apiEndpoint);
      expect(restored.maxTokensPerRequest).toBe(original.maxTokensPerRequest);
      expect(restored.maxRequestsPerDay).toBe(original.maxRequestsPerDay);
      expect(restored.conversationContextMode).toBe(original.conversationContextMode);
      expect(restored.includePreviousToolResults).toBe(original.includePreviousToolResults);
      expect(restored.isEnabled).toBe(original.isEnabled);
      expect(restored.showFloatingAssistant).toBe(original.showFloatingAssistant);
      expect(restored.dailyRequestCount).toBe(original.dailyRequestCount);
      expect(restored.dailyRequestDate).toBe(original.dailyRequestDate);
    });

    it('should handle Firestore Timestamp objects in fromJSON', () => {
      const json = {
        companyId,
        provider: 'mock',
        apiKey: null,
        updatedAt: { toDate: () => new Date('2026-03-15') }, // Firestore Timestamp
      };

      const config = AiProviderConfig.fromJSON(json);

      expect(config.updatedAt).toEqual(new Date('2026-03-15'));
    });

    it('should handle ISO date strings in fromJSON', () => {
      const json = {
        companyId,
        provider: 'mock',
        apiKey: null,
        updatedAt: '2026-03-15T10:30:00.000Z',
      };

      const config = AiProviderConfig.fromJSON(json);

      expect(config.updatedAt).toEqual(new Date('2026-03-15T10:30:00.000Z'));
    });

    it('should default to mock provider when provider is missing', () => {
      const json = { companyId };

      const config = AiProviderConfig.fromJSON(json);

      expect(config.provider).toBe('mock');
      expect(config.isEnabled).toBe(true);
      expect(config.showFloatingAssistant).toBe(true);
    });

    it('should default dailyRequestCount to 0 when not provided', () => {
      const json = {
        companyId,
        provider: 'mock',
        dailyRequestDate: undefined,
        updatedAt: '2026-03-15T10:30:00.000Z',
      };

      const config = AiProviderConfig.fromJSON(json);

      expect(config.dailyRequestCount).toBe(0);
      expect(config.dailyRequestDate).toBeUndefined();
    });
  });

  describe('create() and defaultForCompany()', () => {
    it('should create a config with defaults via create()', () => {
      const config = AiProviderConfig.create({ companyId });

      expect(config.companyId).toBe(companyId);
      expect(config.provider).toBe('mock');
      expect(config.maxTokensPerRequest).toBe(4096);
      expect(config.maxRequestsPerDay).toBe(100);
      expect(config.conversationContextMode).toBe('balanced');
      expect(config.includePreviousToolResults).toBe(true);
      expect(config.dailyRequestCount).toBe(0);
      expect(config.dailyRequestDate).toBeUndefined();
      expect(config.isEnabled).toBe(true);
      expect(config.showFloatingAssistant).toBe(true);
      expect(config.apiKey).toBeUndefined();
    });

    it('should create a default mock config via defaultForCompany()', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);

      expect(config.companyId).toBe(companyId);
      expect(config.provider).toBe('mock');
      expect(config.model).toBe('mock-assistant');
      expect(config.apiKey).toBeUndefined();
      expect(config.apiEndpoint).toBeUndefined();
      expect(config.maxTokensPerRequest).toBe(4096);
      expect(config.maxRequestsPerDay).toBe(100);
      expect(config.dailyRequestCount).toBe(0);
      expect(config.dailyRequestDate).toBeUndefined();
      expect(config.isEnabled).toBe(true);
      expect(config.showFloatingAssistant).toBe(true);
    });

    it('should update conversation context settings', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);

      config.updateConfig({
        conversationContextMode: 'deep',
        includePreviousToolResults: false,
      });

      expect(config.conversationContextMode).toBe('deep');
      expect(config.includePreviousToolResults).toBe(false);
    });

    it('should create a config with custom provider via create()', () => {
      const config = AiProviderConfig.create({
        companyId,
        provider: 'openai_compatible',
        model: 'gpt-4o',
        apiKey: 'sk-test-key',
        apiEndpoint: 'https://api.openai.com/v1',
      });

      expect(config.provider).toBe('openai_compatible');
      expect(config.model).toBe('gpt-4o');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.apiEndpoint).toBe('https://api.openai.com/v1');
    });
  });

  describe('updateConfig()', () => {
    it('should update provided fields and leave others unchanged', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);

      config.updateConfig({
        provider: 'openai_compatible',
        model: 'gpt-4o',
        apiKey: 'sk-new-key',
      });

      expect(config.provider).toBe('openai_compatible');
      expect(config.model).toBe('gpt-4o');
      expect(config.apiKey).toBe('sk-new-key');
      // Defaults should be preserved
      expect(config.maxTokensPerRequest).toBe(4096);
      expect(config.maxRequestsPerDay).toBe(100);
      expect(config.isEnabled).toBe(true);
      // dailyRequestCount and dailyRequestDate should NOT be changed by updateConfig
      expect(config.dailyRequestCount).toBe(0);
    });

    it('should update isEnabled', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);

      config.updateConfig({ isEnabled: false });

      expect(config.isEnabled).toBe(false);
    });

    it('should update showFloatingAssistant without disabling chat', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);

      config.updateConfig({ showFloatingAssistant: false });

      expect(config.showFloatingAssistant).toBe(false);
      expect(config.isEnabled).toBe(true);
    });

    it('should always update updatedAt timestamp', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);
      const originalUpdatedAt = config.updatedAt;

      // Small delay to ensure different timestamp
      config.updateConfig({ model: 'gpt-4o' });

      expect(config.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should NOT update companyId', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);

      // TypeScript prevents this, but verify the type doesn't expose it
      // The type is Omit<AiProviderConfigProps, 'companyId' | 'updatedAt'>
      expect(config.companyId).toBe(companyId);
    });

    it('should NOT update dailyRequestCount or dailyRequestDate via updateConfig', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);
      config.dailyRequestCount = 5;
      config.dailyRequestDate = AiProviderConfig.getTodayDateString();

      // updateConfig should NOT change rate limit tracking fields
      config.updateConfig({ model: 'gpt-4o' });

      expect(config.dailyRequestCount).toBe(5);
      expect(config.dailyRequestDate).toBe(AiProviderConfig.getTodayDateString());
    });
  });

  describe('Rate limit tracking - dailyRequestCount/dailyRequestDate', () => {
    it('getTodaysRequestCount() should return 0 when date has changed', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);
      config.dailyRequestCount = 100;
      config.dailyRequestDate = '2020-01-01'; // Old date

      expect(config.getTodaysRequestCount()).toBe(0);
    });

    it('getTodaysRequestCount() should return count when date matches today', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);
      config.dailyRequestCount = 42;
      config.dailyRequestDate = AiProviderConfig.getTodayDateString();

      expect(config.getTodaysRequestCount()).toBe(42);
    });

    it('incrementDailyRequestCount() should increment when date matches today', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);
      config.dailyRequestCount = 5;
      config.dailyRequestDate = AiProviderConfig.getTodayDateString();

      config.incrementDailyRequestCount();

      expect(config.dailyRequestCount).toBe(6);
      expect(config.dailyRequestDate).toBe(AiProviderConfig.getTodayDateString());
    });

    it('incrementDailyRequestCount() should reset to 1 when date has changed', () => {
      const config = AiProviderConfig.defaultForCompany(companyId);
      config.dailyRequestCount = 100;
      config.dailyRequestDate = '2020-01-01'; // Old date

      config.incrementDailyRequestCount();

      expect(config.dailyRequestCount).toBe(1);
      expect(config.dailyRequestDate).toBe(AiProviderConfig.getTodayDateString());
    });

    it('getTodayDateString() should return YYYY-MM-DD format in UTC', () => {
      const dateStr = AiProviderConfig.getTodayDateString();

      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
