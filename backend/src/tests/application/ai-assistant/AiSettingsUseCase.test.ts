/**
 * AiSettingsUseCase Tests
 *
 * Verifies that:
 * 1. getSettings returns safe JSON without apiKey
 * 2. updateSettings encrypts apiKey before saving
 * 3. getSettings decrypts apiKey for internal use but never exposes it
 * 4. Settings update never returns raw apiKey
 * 5. Invalid provider type is rejected
 */

import { AiSettingsUseCase } from '../../../application/ai-assistant/use-cases/AiSettingsUseCase';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory } from '../../../application/ai-assistant/providers/ProviderFactory';

// Mock encryption service
const createMockEncryptionService = (): IEncryptionService => ({
  encrypt: jest.fn((plaintext: string) => `enc:${plaintext}`),
  decrypt: jest.fn((encrypted: string) => encrypted.replace('enc:', '')),
  isAvailable: jest.fn(() => true),
});

// Mock settings repository
const createMockSettingsRepo = (config: AiProviderConfig | null = null): IAiSettingsRepository => ({
  getConfig: jest.fn(() => Promise.resolve(config)),
  saveConfig: jest.fn(() => Promise.resolve()),
});

describe('AiSettingsUseCase', () => {
  let encryptionService: IEncryptionService;

  beforeEach(() => {
    ProviderFactory.clearCache();
    encryptionService = createMockEncryptionService();
  });

  describe('getSettings()', () => {
    it('should return default config when no config exists', async () => {
      const settingsRepo = createMockSettingsRepo(null);
      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      const result = await useCase.getSettings('company-1');

      expect(result.config).toBeDefined();
      expect(result.config.provider).toBe('mock');
      expect(result.config.hasApiKey).toBe(false);
      // Must never include raw apiKey
      expect(result.config.apiKey).toBeUndefined();
    });

    it('should return safe JSON without apiKey', async () => {
      const config = new AiProviderConfig(
        'company-1',
        'openai_compatible',
        'gpt-4o',
        'enc:sk-secret-key-12345', // Simulating encrypted key from DB
        'https://api.openai.com/v1',
        4096,
        100,
        0,              // dailyRequestCount
        undefined,      // dailyRequestDate
        true,
        new Date()
      );
      const settingsRepo = createMockSettingsRepo(config);
      (encryptionService.decrypt as jest.Mock).mockReturnValue('sk-secret-key-12345');

      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      const result = await useCase.getSettings('company-1');

      expect(result.config.hasApiKey).toBe(true);
      expect(result.config.apiKey).toBeUndefined();
      // The key value must NEVER appear in the output
      expect(JSON.stringify(result.config)).not.toContain('sk-secret-key-12345');
    });

    it('should NEVER expose raw apiKey in getSettings response', async () => {
      const secretKey = 'sk-prod-super-secret-key-that-must-never-appear';
      const config = new AiProviderConfig(
        'company-1',
        'openai_compatible',
        'gpt-4o',
        `enc:${secretKey}`, // Encrypted form stored in DB
        'https://api.openai.com/v1',
      );
      const settingsRepo = createMockSettingsRepo(config);
      (encryptionService.decrypt as jest.Mock).mockReturnValue(secretKey);

      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      const result = await useCase.getSettings('company-1');

      const resultStr = JSON.stringify(result.config);
      expect(resultStr).not.toContain(secretKey);
      expect(result.config.hasApiKey).toBe(true);
    });
  });

  describe('updateSettings()', () => {
    it('should encrypt apiKey before saving to repository', async () => {
      const existingConfig = AiProviderConfig.defaultForCompany('company-1');
      const settingsRepo = createMockSettingsRepo(existingConfig);
      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      await useCase.updateSettings({
        companyId: 'company-1',
        provider: 'openai_compatible',
        model: 'gpt-4o',
        apiKey: 'sk-new-secret-key',
      });

      // saveConfig should have been called — the apiKey passed to save
      // should have been encrypted
      expect(settingsRepo.saveConfig).toHaveBeenCalled();
      const savedConfig = (settingsRepo.saveConfig as jest.Mock).mock.calls[0][0] as AiProviderConfig;
      // The saved config should have the encrypted key, not the plaintext
      expect(savedConfig.apiKey).toBe('enc:sk-new-secret-key');
    });

    it('should return safe JSON without apiKey in update response', async () => {
      const existingConfig = AiProviderConfig.defaultForCompany('company-1');
      const settingsRepo = createMockSettingsRepo(existingConfig);
      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      const result = await useCase.updateSettings({
        companyId: 'company-1',
        provider: 'openai_compatible',
        apiKey: 'sk-secret-key',
      });

      expect(result.config.hasApiKey).toBe(true);
      expect(result.config.apiKey).toBeUndefined();
      expect(JSON.stringify(result.config)).not.toContain('sk-secret-key');
    });

    it('should reject invalid provider types with ApiError 400', async () => {
      const settingsRepo = createMockSettingsRepo(null);
      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      await expect(useCase.updateSettings({
        companyId: 'company-1',
        provider: 'invalid_provider' as any,
      })).rejects.toThrow();

      try {
        await useCase.updateSettings({
          companyId: 'company-1',
          provider: 'invalid_provider' as any,
        });
      } catch (error) {
        expect((error as any).statusCode).toBe(400);
      }
    });

    it('should not encrypt apiKey when provider is mock (no key)', async () => {
      const existingConfig = AiProviderConfig.defaultForCompany('company-1');
      existingConfig.updateConfig({ provider: 'mock' });
      const settingsRepo = createMockSettingsRepo(existingConfig);
      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      await useCase.updateSettings({
        companyId: 'company-1',
        provider: 'mock',
      });

      // encryptionService.encrypt should NOT be called because mock has no apiKey
      expect(encryptionService.encrypt).not.toHaveBeenCalled();
    });

    it('should invalidate provider cache after update', async () => {
      const existingConfig = AiProviderConfig.defaultForCompany('company-1');
      const settingsRepo = createMockSettingsRepo(existingConfig);
      const useCase = new AiSettingsUseCase(settingsRepo, encryptionService);

      // Provider cache should be invalidated after update
      const spy = jest.spyOn(ProviderFactory, 'invalidateCompany');

      await useCase.updateSettings({
        companyId: 'company-1',
        provider: 'mock',
      });

      expect(spy).toHaveBeenCalledWith('company-1');
    });
  });
});