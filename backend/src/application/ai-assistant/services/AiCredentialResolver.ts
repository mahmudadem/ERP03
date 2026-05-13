/**
 * AiCredentialResolver - Decryption and credential resolution for AI providers
 *
 * Handles:
 * - Decrypting the apiKey in AiProviderConfig after loading from storage
 * - Resolving runtime credentials based on tenant mode (BYOK, CREDITS, DISABLED)
 * - Resolving provider endpoint URLs from the provider registry
 *
 * DESIGN PRINCIPLES:
 * - No silent fallback — each mode has explicit requirements
 * - BYOK: Tenant MUST have their own apiKey
 * - CREDITS: Check credit balance, then use platform runtime credential
 * - DISABLED: Rejected immediately
 */

import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';
import { IAiCreditLedgerRepository } from '../../../repository/interfaces/ai-assistant/IAiCreditLedgerRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ApiError } from '../../../api/errors/ApiError';

export class AiCredentialResolver {
  constructor(
    private encryptionService: IEncryptionService,
    private providerRepository?: IAiProviderRepository,
    private creditLedgerRepository?: IAiCreditLedgerRepository,
  ) {}

  /**
   * Decrypt the apiKey in an AiProviderConfig after loading from storage.
   * Returns the config with plaintext apiKey for provider usage.
   */
  decryptConfig(config: AiProviderConfig): AiProviderConfig {
    if (!config.apiKey) {
      return config;
    }

    // Check if this looks like encrypted data (contains colons from iv:ciphertext:authTag)
    // or is a passthrough plaintext (starts with 'plain:')
    if (config.apiKey.startsWith('plain:')) {
      // Development passthrough — remove prefix and use as plaintext
      const plainKey = config.apiKey.substring(6);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: plainKey,
        updatedAt: config.updatedAt.toISOString(),
      });
    }

    try {
      const decrypted = this.encryptionService.decrypt(config.apiKey);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: decrypted,
        updatedAt: config.updatedAt.toISOString(),
      });
    } catch (error) {
      console.warn(
        `[AI Assistant] Failed to decrypt API key for company ${config.companyId}. ` +
        `The key may be stored in plaintext (pre-encryption). Error: ${(error as Error).message}`
      );
      // Return config as-is — ProviderFactory will fall back to mock if the key is invalid
      return config;
    }
  }

  /**
   * Resolve the API credential based on tenant runtimeMode.
   * No silent fallback — each mode has explicit requirements.
   *
   * - BYOK: Tenant MUST have their own apiKey. No platform fallback.
   * - CREDITS: Check credit balance, then use platform runtime credential.
   * - DISABLED: Rejected inside resolveRuntimeCredential (before isEnabled check).
   */
  async resolveRuntimeCredential(config: AiProviderConfig): Promise<AiProviderConfig> {
    const runtimeMode = config.runtimeMode || 'BYOK';

    // Mock provider never needs credentials — skip resolution entirely
    if (config.provider === 'mock') return config;

    if (runtimeMode === 'DISABLED') {
      throw ApiError.forbidden('AI Assistant is disabled for your company. Contact your administrator.');
    }

    // Resolve provider endpoint from registry if apiEndpoint is missing
    config = await this.resolveProviderEndpoint(config);

    if (runtimeMode === 'BYOK') {
      // Tenant must provide their own API key — no platform fallback
      if (!config.apiKey) {
        throw ApiError.forbidden(
          'No API key configured. Please add your provider API key in AI Settings (Bring Your Own Key mode).'
        );
      }
      return config;
    }

    if (runtimeMode === 'CREDITS') {
      // Credits mode: check credit balance, then use the platform runtime credential from the provider registry
      if (!this.creditLedgerRepository) {
        throw ApiError.internal('Credit system is not configured. Contact support.');
      }

      const ledger = await this.creditLedgerRepository.getByCompanyId(config.companyId);
      if (!ledger || !ledger.hasCredits()) {
        throw ApiError.forbidden('No AI credits remaining. Please purchase more credits or switch to BYOK mode.');
      }

      // Resolve platform credential for CREDITS mode
      if (!this.providerRepository) {
        throw ApiError.internal('Platform runtime credential is not configured. Contact support.');
      }

      try {
        const providers = await this.providerRepository.list();
        const provider = providers.find(p =>
          p.type === config.provider ||
          (p.type === 'openai_compatible' && config.provider === 'openai_compatible')
        );

        if (!provider || !provider.platformRuntimeCredential) {
          throw ApiError.forbidden(
            'Platform AI service is not available. No platform runtime credential configured for this provider. Contact support.'
          );
        }

        // Decrypt the platform runtime credential
        let plainKey: string;
        if (provider.platformRuntimeCredential.startsWith('plain:')) {
          plainKey = provider.platformRuntimeCredential.substring(6);
        } else if (provider.platformRuntimeCredential.includes(':')) {
          plainKey = this.encryptionService.decrypt(provider.platformRuntimeCredential);
        } else {
          plainKey = provider.platformRuntimeCredential;
        }

        // Apply the platform credential to the config
        return AiProviderConfig.fromJSON({
          ...config.toJSON(),
          apiKey: plainKey,
          updatedAt: config.updatedAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw ApiError.internal(
          `Failed to resolve platform runtime credential: ${(error as Error).message}`
        );
      }
    }

    // Unknown mode — treat as BYOK requirement
    if (!config.apiKey) {
      throw ApiError.forbidden('AI configuration error. Please update your AI Settings.');
    }
    return config;
  }

  /**
   * Resolve the provider endpoint URL from the provider registry when apiEndpoint
   * is not explicitly set in config. Uses providerId (preferred) or falls back to
   * provider type matching.
   *
   * IMPORTANT: Mutates config in-place via updateConfig() to avoid the toJSON()
   * round-trip which would lose apiKey and rate-limit fields.
   */
  async resolveProviderEndpoint(config: AiProviderConfig): Promise<AiProviderConfig> {
    // If apiEndpoint is explicitly set, use it — no resolution needed
    if (config.apiEndpoint) return config;

    // Only resolve for openai_compatible providers (others have fixed endpoints)
    if (config.provider !== 'openai_compatible') return config;

    // If no providerRepository is available, we can't resolve
    if (!this.providerRepository) return config;

    try {
      const providers = await this.providerRepository.list();

      // Try exact providerId match first (preferred — avoids type collisions)
      if (config.providerId) {
        const exactMatch = providers.find(p => p.id === config.providerId);
        if (exactMatch?.defaultBaseUrl) {
          config.updateConfig({ apiEndpoint: exactMatch.defaultBaseUrl });
          return config;
        }
      }

      // Fall back to type-based match (legacy behavior)
      const typeMatch = providers.find(p =>
        p.type === config.provider ||
        (p.type === 'openai_compatible' && config.provider === 'openai_compatible')
      );
      if (typeMatch?.defaultBaseUrl) {
        config.updateConfig({ apiEndpoint: typeMatch.defaultBaseUrl });
        return config;
      }
    } catch (error) {
      // Log but don't block — fallback to ProviderFactory defaults
      console.warn(
        `[AI Assistant] Failed to resolve provider endpoint for company ${config.companyId}: ${(error as Error).message}`
      );
    }

    // No resolution possible — ProviderFactory will use hardcoded defaults
    return config;
  }
}