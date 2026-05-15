import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';

export interface IAiModelProfileRepository {
  getById(id: string): Promise<AiModelProfile | null>;
  getByProviderAndModel(provider: string, modelName: string, tenantId?: string): Promise<AiModelProfile | null>;
  list(filters?: { tenantId?: string; scope?: 'GLOBAL' | 'TENANT' }): Promise<AiModelProfile[]>;
  save(profile: AiModelProfile): Promise<void>;
  delete(id: string): Promise<void>;
}
