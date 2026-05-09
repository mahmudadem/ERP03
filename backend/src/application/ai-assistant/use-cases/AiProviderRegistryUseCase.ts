import { ApiError } from '../../../api/errors/ApiError';
import {
  AiProvider,
  AiProviderAuthType,
  AiProviderRegistryType,
} from '../../../domain/ai-assistant/entities/AiProvider';
import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';

export interface UpsertAiProviderInput {
  id?: string;
  name: string;
  type: AiProviderRegistryType;
  defaultBaseUrl?: string;
  authType?: AiProviderAuthType;
  enabled?: boolean;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
  supportsModelSync?: boolean;
  notes?: string;
}

export class AiProviderRegistryUseCase {
  constructor(private readonly providerRepository: IAiProviderRepository) {}

  async listProviders(): Promise<AiProvider[]> {
    return (await this.providerRepository.list())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProvider(id: string): Promise<AiProvider> {
    const provider = await this.providerRepository.getById(id);
    if (!provider) throw ApiError.notFound(`AI provider '${id}' not found`);
    return provider;
  }

  async upsertProvider(input: UpsertAiProviderInput): Promise<AiProvider> {
    this.validateProviderInput(input);
    const now = new Date();
    const id = input.id || AiProvider.makeId(input.type, input.name);
    const existing = await this.providerRepository.getById(id);
    const provider = new AiProvider(
      id,
      input.name.trim(),
      input.type,
      input.defaultBaseUrl?.trim() || undefined,
      input.authType || existing?.authType || 'api_key',
      input.enabled ?? existing?.enabled ?? true,
      input.supportsTools ?? existing?.supportsTools ?? false,
      input.supportsJsonMode ?? existing?.supportsJsonMode ?? false,
      input.supportsModelSync ?? existing?.supportsModelSync ?? false,
      input.notes?.trim() || undefined,
      existing?.createdAt ?? now,
      now,
    );
    await this.providerRepository.save(provider);
    return provider;
  }

  async setEnabled(id: string, enabled: boolean): Promise<AiProvider> {
    const existing = await this.getProvider(id);
    const provider = new AiProvider(
      existing.id,
      existing.name,
      existing.type,
      existing.defaultBaseUrl,
      existing.authType,
      enabled,
      existing.supportsTools,
      existing.supportsJsonMode,
      existing.supportsModelSync,
      existing.notes,
      existing.createdAt,
      new Date(),
    );
    await this.providerRepository.save(provider);
    return provider;
  }

  private validateProviderInput(input: UpsertAiProviderInput): void {
    if (!input || typeof input !== 'object') throw ApiError.badRequest('Request body is required');
    if (!input.name || typeof input.name !== 'string') throw ApiError.badRequest('name is required');
    const types = ['openai', 'openai_compatible', 'google_gemini', 'anthropic', 'ollama', 'custom'];
    if (!types.includes(input.type)) throw ApiError.badRequest(`type must be one of: ${types.join(', ')}`);
    const authTypes = ['api_key', 'bearer', 'none', 'custom'];
    if (input.authType && !authTypes.includes(input.authType)) {
      throw ApiError.badRequest(`authType must be one of: ${authTypes.join(', ')}`);
    }
  }
}
