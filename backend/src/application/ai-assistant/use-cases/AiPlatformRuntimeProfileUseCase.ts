import { ApiError } from '../../../api/errors/ApiError';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import {
  AiPlatformRuntimeInterval,
  AiPlatformRuntimeProfile,
  AiPlatformRuntimeProfileStatus,
} from '../../../domain/ai-assistant/entities/AiPlatformRuntimeProfile';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { IAiPlatformRuntimeProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiPlatformRuntimeProfileRepository';
import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';

export interface UpsertAiPlatformRuntimeProfileInput {
  id?: string;
  providerId: string;
  modelProfileId: string;
  apiKey?: string;
  status?: AiPlatformRuntimeProfileStatus;
  maxRequestsPerInterval?: number;
  requestInterval?: AiPlatformRuntimeInterval;
  notes?: string;
}

export class AiPlatformRuntimeProfileUseCase {
  constructor(
    private readonly runtimeProfileRepository: IAiPlatformRuntimeProfileRepository,
    private readonly providerRepository: IAiProviderRepository,
    private readonly modelProfileRepository: IAiModelProfileRepository,
    private readonly encryptionService: IEncryptionService,
  ) {}

  async listProfiles(): Promise<AiPlatformRuntimeProfile[]> {
    return (await this.runtimeProfileRepository.list()).sort((a, b) =>
      `${a.providerName} ${a.modelDisplayName}`.localeCompare(`${b.providerName} ${b.modelDisplayName}`)
    );
  }

  async getProfile(id: string): Promise<AiPlatformRuntimeProfile> {
    const profile = await this.runtimeProfileRepository.getById(id);
    if (!profile) throw ApiError.notFound(`AI runtime profile '${id}' not found`);
    return profile;
  }

  async upsertProfile(input: UpsertAiPlatformRuntimeProfileInput): Promise<AiPlatformRuntimeProfile> {
    this.validateInput(input);

    const provider = await this.providerRepository.getById(input.providerId);
    if (!provider) throw ApiError.notFound(`AI provider '${input.providerId}' not found`);

    const modelProfile = await this.modelProfileRepository.getById(input.modelProfileId);
    if (!modelProfile) throw ApiError.notFound(`AI model profile '${input.modelProfileId}' not found`);
    if (modelProfile.scope !== 'GLOBAL') {
      throw ApiError.badRequest('Only GLOBAL model profiles can be used for platform AI runtime');
    }
    if (modelProfile.providerId !== provider.id) {
      throw ApiError.badRequest('Selected model profile does not belong to the selected provider');
    }

    const id = input.id || AiPlatformRuntimeProfile.makeId(provider.id, modelProfile.id);
    const existing = await this.runtimeProfileRepository.getById(id);

    if (existing && (existing.providerId !== provider.id || existing.modelProfileId !== modelProfile.id)) {
      throw ApiError.badRequest('Provider/model pair cannot be changed for an existing runtime profile. Create a new profile instead.');
    }

    let encryptedCredential = existing?.encryptedCredential;
    let credentialHint = existing?.credentialHint;
    if (input.apiKey !== undefined) {
      const trimmed = input.apiKey.trim();
      if (!trimmed) {
        encryptedCredential = undefined;
        credentialHint = undefined;
      } else {
        encryptedCredential = this.encryptApiKey(trimmed);
        credentialHint = AiPlatformRuntimeProfile.buildCredentialHint(trimmed);
      }
    }

    const status = input.status || existing?.status || 'paused';
    if (status === 'active' && !encryptedCredential) {
      throw ApiError.badRequest('An API key is required before a runtime profile can be activated');
    }

    const maxRequestsPerInterval = typeof input.maxRequestsPerInterval === 'number'
      ? (input.maxRequestsPerInterval > 0 ? input.maxRequestsPerInterval : undefined)
      : existing?.maxRequestsPerInterval;

    const profile = new AiPlatformRuntimeProfile(
      id,
      provider.id,
      provider.type,
      provider.name,
      modelProfile.id,
      modelProfile.modelId,
      modelProfile.displayName || modelProfile.modelName,
      encryptedCredential,
      credentialHint,
      status,
      maxRequestsPerInterval,
      input.requestInterval || existing?.requestInterval || 'day',
      existing?.currentWindowRequestCount || 0,
      existing?.currentWindowStartedAt,
      existing?.totalSuccessfulRequests || 0,
      existing?.lastUsedAt,
      existing?.lastFailureAt,
      existing?.lastFailureReason,
      input.notes?.trim() || existing?.notes,
      existing?.createdAt || new Date(),
      new Date(),
    );

    await this.runtimeProfileRepository.save(profile);
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    await this.getProfile(id);
    await this.runtimeProfileRepository.delete(id);
  }

  private encryptApiKey(apiKey: string): string {
    // Never fall back to plaintext: a leaked platform key compromises every credits-mode tenant.
    return this.encryptionService.encrypt(apiKey);
  }

  private validateInput(input: UpsertAiPlatformRuntimeProfileInput): void {
    if (!input.providerId || typeof input.providerId !== 'string') {
      throw ApiError.badRequest('providerId is required');
    }
    if (!input.modelProfileId || typeof input.modelProfileId !== 'string') {
      throw ApiError.badRequest('modelProfileId is required');
    }
    const statuses: AiPlatformRuntimeProfileStatus[] = ['active', 'paused', 'disabled'];
    if (input.status && !statuses.includes(input.status)) {
      throw ApiError.badRequest(`status must be one of: ${statuses.join(', ')}`);
    }
    const intervals: AiPlatformRuntimeInterval[] = ['minute', 'hour', 'day', 'month'];
    if (input.requestInterval && !intervals.includes(input.requestInterval)) {
      throw ApiError.badRequest(`requestInterval must be one of: ${intervals.join(', ')}`);
    }
    if (input.maxRequestsPerInterval !== undefined) {
      const value = Number(input.maxRequestsPerInterval);
      if (!Number.isFinite(value) || value < 0) {
        throw ApiError.badRequest('maxRequestsPerInterval must be a non-negative number');
      }
    }
  }
}
