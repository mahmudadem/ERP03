import { AiPlatformApiKey } from '../../../domain/ai-assistant/entities/AiPlatformApiKey';

export interface IAiPlatformApiKeyRepository {
  getById(id: string): Promise<AiPlatformApiKey | null>;
  list(): Promise<AiPlatformApiKey[]>;
  listByProvider(providerId: string): Promise<AiPlatformApiKey[]>;
  save(key: AiPlatformApiKey): Promise<void>;
  delete(id: string): Promise<void>;
}
