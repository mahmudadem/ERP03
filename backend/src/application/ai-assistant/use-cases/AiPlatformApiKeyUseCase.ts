import { randomUUID } from 'crypto';
import { ApiError } from '../../../api/errors/ApiError';
import { AiPlatformApiKey } from '../../../domain/ai-assistant/entities/AiPlatformApiKey';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IAiPlatformApiKeyRepository } from '../../../repository/interfaces/ai-assistant/IAiPlatformApiKeyRepository';
import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import {
  ProviderAuthError,
  ProviderError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from '../../../errors/ProviderErrors';

export interface CreateApiKeyInput {
  label: string;
  providerId: string;
  apiKey: string;
  notes?: string;
}

export interface UpdateApiKeyInput {
  label?: string;
  apiKey?: string;
  notes?: string;
}

export class AiPlatformApiKeyUseCase {
  constructor(
    private readonly repo: IAiPlatformApiKeyRepository,
    private readonly providerRepo: IAiProviderRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly httpClient: IHttpClient,
  ) {}

  async list(): Promise<AiPlatformApiKey[]> {
    const keys = await this.repo.list();
    return keys.sort((a, b) => a.label.localeCompare(b.label));
  }

  async listByProvider(providerId: string): Promise<AiPlatformApiKey[]> {
    return this.repo.listByProvider(providerId);
  }

  async getDecryptedKey(id: string): Promise<string> {
    const key = await this.repo.getById(id);
    if (!key) throw ApiError.notFound(`AI platform API key '${id}' not found`);
    return this.encryptionService.decrypt(key.encryptedKey);
  }

  async create(input: CreateApiKeyInput): Promise<AiPlatformApiKey> {
    if (!input.label?.trim()) throw ApiError.badRequest('label is required');
    if (!input.providerId?.trim()) throw ApiError.badRequest('providerId is required');
    if (!input.apiKey?.trim()) throw ApiError.badRequest('apiKey is required');

    const provider = await this.providerRepo.getById(input.providerId);
    if (!provider) throw ApiError.badRequest(`Provider '${input.providerId}' not found`);

    const trimmed = input.apiKey.trim();
    const id = randomUUID();
    const entity = new AiPlatformApiKey(
      id,
      input.label.trim(),
      provider.id,
      provider.name,
      this.encryptionService.encrypt(trimmed),
      AiPlatformApiKey.buildCredentialHint(trimmed),
      undefined,
      'unknown',
      undefined,
      input.notes?.trim() || undefined,
      new Date(),
      new Date(),
    );
    await this.repo.save(entity);
    return entity;
  }

  async update(id: string, input: UpdateApiKeyInput): Promise<AiPlatformApiKey> {
    const existing = await this.repo.getById(id);
    if (!existing) throw ApiError.notFound(`AI platform API key '${id}' not found`);

    const nextLabel = input.label?.trim() || existing.label;
    let nextEncrypted = existing.encryptedKey;
    let nextHint = existing.credentialHint;
    let nextValidationStatus = existing.lastValidationStatus;
    let nextValidationDetail = existing.lastValidationDetail;
    let nextValidatedAt = existing.lastValidatedAt;

    if (input.apiKey && input.apiKey.trim()) {
      const trimmed = input.apiKey.trim();
      nextEncrypted = this.encryptionService.encrypt(trimmed);
      nextHint = AiPlatformApiKey.buildCredentialHint(trimmed);
      // Rotating the key invalidates the previous validation result
      nextValidationStatus = 'unknown';
      nextValidationDetail = undefined;
      nextValidatedAt = undefined;
    }

    const updated = new AiPlatformApiKey(
      existing.id,
      nextLabel,
      existing.providerId,
      existing.providerName,
      nextEncrypted,
      nextHint,
      nextValidatedAt,
      nextValidationStatus,
      nextValidationDetail,
      input.notes !== undefined ? (input.notes.trim() || undefined) : existing.notes,
      existing.createdAt,
      new Date(),
    );
    await this.repo.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.getById(id);
    if (!existing) throw ApiError.notFound(`AI platform API key '${id}' not found`);
    await this.repo.delete(id);
  }

  /**
   * Test that the stored key authenticates against the provider's /models endpoint
   * (or equivalent). Updates the stored validation status so the vault page can
   * show a green/red indicator next to each key.
   */
  async validate(id: string): Promise<AiPlatformApiKey> {
    const existing = await this.repo.getById(id);
    if (!existing) throw ApiError.notFound(`AI platform API key '${id}' not found`);
    const provider = await this.providerRepo.getById(existing.providerId);
    if (!provider) throw ApiError.badRequest(`Provider '${existing.providerId}' no longer exists`);

    const baseUrl = provider.defaultBaseUrl;
    if (!baseUrl) {
      const result = existing.withValidation('unknown', 'Provider has no base URL configured');
      await this.repo.save(result);
      return result;
    }

    const apiKey = this.encryptionService.decrypt(existing.encryptedKey);
    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    if (baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://erp03.local';
      headers['X-Title'] = 'ERP03';
    }

    try {
      await this.httpClient.request<unknown>({
        url,
        method: 'GET',
        headers,
        timeoutMs: 10000,
      });
      const result = existing.withValidation('valid', 'Provider accepted the key');
      await this.repo.save(result);
      return result;
    } catch (err) {
      let detail = 'Validation failed';
      if (err instanceof ProviderAuthError) detail = 'Authentication failed — provider rejected the key';
      else if (err instanceof ProviderRateLimitError) detail = 'Rate-limited — try again later';
      else if (err instanceof ProviderUnavailableError) detail = 'Provider unreachable — check network or endpoint';
      else if (err instanceof ProviderError) detail = err.message.replace(/AI provider error \((\d{3})\):\s*/, 'HTTP $1: ');
      else if (err instanceof Error) detail = err.message.slice(0, 200);
      const result = existing.withValidation('invalid', detail);
      await this.repo.save(result);
      return result;
    }
  }
}
