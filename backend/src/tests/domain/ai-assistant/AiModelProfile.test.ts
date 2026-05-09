import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';

describe('AiModelProfile', () => {
  it('creates Firestore-safe IDs for provider model names that contain path separators', () => {
    const id = AiModelProfile.makeId('openai_compatible', 'google/gemma-4-31b-it:free');

    expect(id).toBe('openai_compatible:google%2Fgemma-4-31b-it%3Afree');
    expect(id).not.toContain('/');
  });

  it('changes profileHash when runtime settings change', () => {
    const base = AiModelProfile.fromJSON({
      scope: 'GLOBAL',
      providerId: 'provider-openai',
      provider: 'openai_compatible',
      modelId: 'gpt-4o',
      modelName: 'gpt-4o',
      endpointFingerprint: AiModelProfile.fingerprintEndpoint('https://api.openai.com/v1'),
      temperature: 0.2,
      maxOutputTokens: 4096,
      jsonMode: true,
      toolMode: 'native_tools',
      timeoutMs: 120000,
      retryPolicy: 'default',
      status: 'recommended',
      supportsToolCalling: true,
      supportsStructuredJson: true,
      maxContextTokens: 4096,
    });

    const changed = AiModelProfile.fromJSON({
      ...base.toJSON(),
      profileHash: undefined,
      temperature: 0.7,
    });

    expect(changed.profileHash).not.toBe(base.profileHash);
  });

  it('uses provider and endpoint fingerprint in profileHash identity', () => {
    const openAiHash = AiModelProfile.generateProfileHash({
      scope: 'GLOBAL',
      providerId: 'openai',
      modelId: 'gpt-4o',
      endpointFingerprint: AiModelProfile.fingerprintEndpoint('https://api.openai.com/v1'),
      temperature: 0.2,
      maxOutputTokens: 4096,
      jsonMode: true,
      toolMode: 'native_tools',
      timeoutMs: 120000,
      retryPolicy: 'default',
    });
    const gatewayHash = AiModelProfile.generateProfileHash({
      scope: 'GLOBAL',
      providerId: 'custom-gateway',
      modelId: 'gpt-4o',
      endpointFingerprint: AiModelProfile.fingerprintEndpoint('https://gateway.example.com/v1'),
      temperature: 0.2,
      maxOutputTokens: 4096,
      jsonMode: true,
      toolMode: 'native_tools',
      timeoutMs: 120000,
      retryPolicy: 'default',
    });

    expect(gatewayHash).not.toBe(openAiHash);
  });
});
