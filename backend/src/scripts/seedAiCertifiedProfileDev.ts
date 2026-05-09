import { diContainer } from '../infrastructure/di/bindRepositories';
import { AiModelProfile } from '../domain/ai-assistant/entities/AiModelProfile';
import { AI_DATA_FILTER_POLICY_VERSION, AI_TOOL_CONTRACT_VERSION } from '../application/ai-assistant/services/AiModelRoutingGuard';

async function main(): Promise<void> {
  const provider = await diContainer.aiProviderRegistryUseCase.upsertProvider({
    id: 'openai:openai',
    name: 'OpenAI',
    type: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    authType: 'bearer',
    enabled: true,
    supportsTools: true,
    supportsJsonMode: true,
    supportsModelSync: false,
    notes: 'Development seed metadata only. No API keys are stored here.',
  });

  const profile = AiModelProfile.fromJSON({
    id: 'global:openai:gpt-4o:dev',
    scope: 'GLOBAL',
    providerId: provider.id,
    provider: 'openai_compatible',
    modelId: 'gpt-4o',
    modelName: 'gpt-4o',
    displayName: 'GPT-4o Dev Certified Profile',
    baseUrl: provider.defaultBaseUrl,
    endpointFingerprint: AiModelProfile.fingerprintEndpoint(provider.defaultBaseUrl),
    temperature: 0.2,
    maxOutputTokens: 4096,
    jsonMode: true,
    toolMode: 'native_tools',
    timeoutMs: 120000,
    retryPolicy: 'default',
    safetyPolicyId: 'proposal-draft-sandbox-v1',
    systemPromptPolicyId: 'erp-assistant-base-v1',
    dataFilterPolicyId: AI_DATA_FILTER_POLICY_VERSION,
    status: 'recommended',
    enabled: true,
    supportsToolCalling: true,
    supportsStructuredJson: true,
    maxContextTokens: 128000,
    recommendedUseCases: ['general-chat', 'accounting', 'tool-calling'],
    tags: ['dev-seed', 'global-certified'],
    warningLevel: 'none',
    textOnlyMode: false,
    warningMessage: '',
    createdBy: 'dev-seed',
  });

  await diContainer.aiModelProfileRepository.save(profile);

  await diContainer.aiModelCertificationUseCase.recordManualCertification({
    scope: 'GLOBAL',
    modelProfileId: profile.id,
    profileHash: profile.profileHash,
    category: 'ACCOUNTING',
    moduleId: 'accounting',
    score: 90,
    maxScore: 100,
    status: 'CERTIFIED',
    testSuiteVersion: 'manual-dev-seed-v1',
    toolContractVersion: AI_TOOL_CONTRACT_VERSION,
    dataFilterPolicyVersion: AI_DATA_FILTER_POLICY_VERSION,
    summary: 'Development-only manual certification seed. Use for local routing tests, not production trust.',
    testedBy: 'dev-seed',
    approvedBy: 'dev-seed',
    metadata: { devSeed: true },
  });

  console.log(JSON.stringify({
    providerId: provider.id,
    modelProfileId: profile.id,
    profileHash: profile.profileHash,
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
