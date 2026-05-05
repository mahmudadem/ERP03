/**
 * CheckProviderHealthUseCase - Tests AI provider connectivity and inference readiness
 *
 * This use case performs two checks:
 * 1. Network check: Calls isAvailable() to test API connectivity
 * 2. Inference check: Sends a safe prompt "Reply with only: provider-ok"
 *    to verify the model can actually generate a response
 *
 * Important:
 * - The inference check consumes real tokens (costs money for paid providers)
 * - This should be called on-demand (e.g., "Test Connection" button), not on every page load
 * - The safe prompt does NOT include any ERP data
 * - The API key is NEVER exposed in the response
 * - Errors are sanitized to prevent information leakage
 * - A cooldown of 60 seconds per company prevents abuse
 */

import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory } from '../providers/ProviderFactory';
import { ProviderError } from '../../../errors/ProviderErrors';
import { ApiError } from '../../../api/errors/ApiError';

export interface ProviderHealthResult {
  ready: boolean;
  networkOk: boolean;
  inferenceOk: boolean;
  provider: string;
  model: string;
  reason?: string;
}

/** Cooldown period in milliseconds between health checks per company */
const HEALTH_CHECK_COOLDOWN_MS = 60_000; // 60 seconds

/** Map of companyId → last health check timestamp */
const lastHealthCheck = new Map<string, number>();

export class CheckProviderHealthUseCase {
  constructor(
    private settingsRepository: IAiSettingsRepository,
    private encryptionService: IEncryptionService,
    private httpClient: IHttpClient,
  ) {}

  async execute(companyId: string): Promise<ProviderHealthResult> {
    // Cooldown check: prevent spamming the health check endpoint
    const lastCheck = lastHealthCheck.get(companyId) || 0;
    const timeSinceLastCheck = Date.now() - lastCheck;
    if (timeSinceLastCheck < HEALTH_CHECK_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((HEALTH_CHECK_COOLDOWN_MS - timeSinceLastCheck) / 1000);
      throw ApiError.custom(
        429,
        `Health check cooldown active. Please wait ${remainingSeconds} seconds before testing again.`,
        'HEALTH_CHECK_COOLDOWN'
      );
    }

    // Get config
    let config = await this.settingsRepository.getConfig(companyId);
    if (!config) {
      config = AiProviderConfig.defaultForCompany(companyId);
    } else {
      config = this.decryptConfig(config);
    }

    // Check if AI is enabled
    if (!config.isEnabled) {
      return {
        ready: false,
        networkOk: false,
        inferenceOk: false,
        provider: config.provider,
        model: config.model || 'unknown',
        reason: 'AI Assistant is not enabled for this company',
      };
    }

    const provider = ProviderFactory.getProvider(config, this.httpClient);

    // Step 1: Network connectivity check
    let networkOk = false;
    let networkError: string | undefined;

    try {
      networkOk = await provider.isAvailable();
    } catch (error) {
      networkError = this.sanitizeError(error);
    }

    // Step 2: Inference check (safe prompt only)
    let inferenceOk = false;
    let inferenceError: string | undefined;

    try {
      const response = await provider.chat({
        messages: [
          { role: 'user', content: 'Reply with only: provider-ok' },
        ],
        maxTokens: 10,
        temperature: 0,
      });

      // The provider responded without error — inference works
      // We don't strictly require the response to contain "provider-ok"
      // because some models add extra text. The fact that it returned
      // a non-error response is sufficient.
      inferenceOk = true;
    } catch (error) {
      inferenceError = this.sanitizeError(error);
    }

    // Determine overall ready status
    const ready = networkOk && inferenceOk;

    // Build reason message (never includes API key or sensitive data)
    let reason: string | undefined;
    if (!networkOk && !inferenceOk) {
      reason = inferenceError || networkError || 'Provider is not responding';
    } else if (!networkOk) {
      reason = networkError || 'Network connectivity check failed';
    } else if (!inferenceOk) {
      reason = inferenceError || 'Inference check failed — the model could not generate a response';
    }

    // Record the health check timestamp for cooldown
    lastHealthCheck.set(companyId, Date.now());

    return {
      ready,
      networkOk,
      inferenceOk,
      provider: config.provider,
      model: config.model || provider.providerName,
      reason,
    };
  }

  /**
   * Reset the health check cooldown for a company (useful for testing).
   */
  static resetCooldown(companyId?: string): void {
    if (companyId) {
      lastHealthCheck.delete(companyId);
    } else {
      lastHealthCheck.clear();
    }
  }

  /**
   * Decrypt the apiKey in an AiProviderConfig after loading from storage.
   */
  private decryptConfig(config: AiProviderConfig): AiProviderConfig {
    if (!config.apiKey) {
      return config;
    }

    if (config.apiKey.startsWith('plain:')) {
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
        `Error: ${(error as Error).message}`
      );
      return config;
    }
  }

  /**
   * Sanitize error messages to prevent API key or endpoint leakage.
   * Returns a generic, user-safe error description.
   */
  private sanitizeError(error: unknown): string {
    if (error instanceof ProviderError) {
      const pe = error as ProviderError;
      // Map to normalized status descriptions — never include raw messages
      const statusCode = (pe as any).statusCode;
      if (statusCode === 401) return 'Authentication failed — check your API key';
      if (statusCode === 429) return 'Rate limit exceeded — try again later';
      if (statusCode === 503) return 'Provider is temporarily unavailable';
      if (statusCode === 502) return 'Provider returned an error response';
      return 'Provider error — please check your configuration';
    }

    if (error instanceof Error) {
      // Don't include raw error messages — they may contain URLs, keys, etc.
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return 'Request timed out — check your network connection';
      }
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        return 'Could not connect to the provider — check the endpoint URL';
      }
      return 'An unexpected error occurred while checking the provider';
    }

    return 'An unknown error occurred';
  }
}