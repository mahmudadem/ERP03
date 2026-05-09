import { AiProvider } from '../../../domain/ai-assistant/entities/AiProvider';

export interface IAiProviderRepository {
  getById(id: string): Promise<AiProvider | null>;
  list(): Promise<AiProvider[]>;
  save(provider: AiProvider): Promise<void>;
  delete(id: string): Promise<void>;
}
