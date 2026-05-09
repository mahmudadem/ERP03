import { AiProviderRegistryUseCase } from '../../../application/ai-assistant/use-cases/AiProviderRegistryUseCase';
import { AiProvider } from '../../../domain/ai-assistant/entities/AiProvider';
import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';

class InMemoryProviderRepo implements IAiProviderRepository {
  providers = new Map<string, AiProvider>();
  async getById(id: string) { return this.providers.get(id) ?? null; }
  async list() { return Array.from(this.providers.values()); }
  async save(provider: AiProvider) { this.providers.set(provider.id, provider); }
  async delete(id: string) { this.providers.delete(id); }
}

describe('AiProviderRegistryUseCase', () => {
  it('creates and updates provider metadata without secrets', async () => {
    const repo = new InMemoryProviderRepo();
    const useCase = new AiProviderRegistryUseCase(repo);

    const created = await useCase.upsertProvider({
      name: 'OpenAI',
      type: 'openai',
      defaultBaseUrl: 'https://api.openai.com/v1',
      authType: 'bearer',
      supportsTools: true,
      supportsJsonMode: true,
      supportsModelSync: false,
    });
    const updated = await useCase.upsertProvider({
      id: created.id,
      name: 'OpenAI',
      type: 'openai',
      defaultBaseUrl: 'https://api.openai.com/v1',
      authType: 'bearer',
      enabled: false,
      supportsTools: true,
      supportsJsonMode: true,
      supportsModelSync: true,
    });

    expect(created.id).toBe('openai:openai');
    expect(updated.enabled).toBe(false);
    expect(updated.supportsModelSync).toBe(true);
    expect(JSON.stringify(updated.toJSON()).toLowerCase()).not.toContain('key');
  });

  it('can enable and disable providers', async () => {
    const repo = new InMemoryProviderRepo();
    const useCase = new AiProviderRegistryUseCase(repo);
    const provider = await useCase.upsertProvider({
      name: 'OpenRouter',
      type: 'openai_compatible',
      enabled: true,
    });

    const disabled = await useCase.setEnabled(provider.id, false);
    const enabled = await useCase.setEnabled(provider.id, true);

    expect(disabled.enabled).toBe(false);
    expect(enabled.enabled).toBe(true);
  });
});
