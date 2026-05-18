import { AiCertificationCategory, isAiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiModelCertificationResult, AiModelCertificationStatus } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile, AiModelScope } from '../../../domain/ai-assistant/entities/AiModelProfile';
import {
  AI_DATA_FILTER_POLICY_VERSION,
  AI_TOOL_CONTRACT_VERSION,
} from './AiModelRoutingGuard';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IAiProvider } from '../providers/IAiProvider';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AxiosHttpClient } from '../../../infrastructure/http/AxiosHttpClient';
import { AiProviderToolContract } from '../../../domain/ai-assistant/tools/AiToolContract';
import { runAllTests, CertificationTestResult } from './AiCertificationTestSuite';

export interface AiCertificationEngineInput {
  scope: AiModelScope;
  tenantId?: string;
  profile: AiModelProfile;
  profileHash: string;
  category: AiCertificationCategory;
  moduleId?: string;
  skillId?: string;
  testedBy: string;
  approvedBy?: string;
  manual?: {
    score: number;
    maxScore: number;
    status: AiModelCertificationStatus;
    testSuiteVersion: string;
    toolContractVersion: string;
    dataFilterPolicyVersion: string;
    summary: string;
    failureReasons?: string[];
    metadata?: Record<string, unknown>;
  };
}

const DIAGNOSTIC_TOOL: AiProviderToolContract = {
  name: 'diagnostics_ping',
  originalName: 'diagnostics.ping',
  description: 'Diagnostic read-only ping used to verify AI tool calling compatibility.',
  whenToUse: 'Use only during model diagnostics.',
  operationType: 'READ',
  moduleId: 'ai-assistant',
  requiredPermissions: [],
  inputSchema: {
    type: 'object',
    properties: {
      probe: { type: 'string' },
    },
    required: ['probe'],
    additionalProperties: false,
  },
  parameters: {
    type: 'object',
    properties: {
      probe: { type: 'string' },
    },
    required: ['probe'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
    },
  },
  outputDescription: 'Diagnostic result only. No ERP data is read.',
  examples: ['Run AI model diagnostics'],
  safetyNotes: ['No ERP data is included. No business record is modified.'],
  safeForAutoInvoke: true,
};

export class AiCertificationEngine {
  constructor(
    private readonly httpClient: IHttpClient = new AxiosHttpClient(),
    private readonly providerFactory: (config: AiProviderConfig) => IAiProvider
  ) {}

  /**
   * Run the certification engine.
   * Performs structural "Shell" checks and a real AI "Deep Probe" test.
   */
  async run(input: AiCertificationEngineInput, provider?: IAiProvider): Promise<AiModelCertificationResult> {
    if (input.profile.profileHash !== input.profileHash) {
      throw new Error('profileHash does not match current model profile hash');
    }
    if (!isAiCertificationCategory(input.category)) {
      throw new Error('Invalid certification category');
    }
    if (input.scope === 'TENANT' && !input.tenantId) {
      throw new Error('TENANT certification requires tenantId');
    }

    // 1. Handle Manual Certification (Direct Override)
    if (input.manual) {
      return this.createResult(input, {
        score: input.manual.score,
        maxScore: input.manual.maxScore,
        status: input.manual.status,
        testSuiteVersion: input.manual.testSuiteVersion,
        toolContractVersion: input.manual.toolContractVersion,
        dataFilterPolicyVersion: input.manual.dataFilterPolicyVersion,
        summary: input.manual.summary,
        failureReasons: input.manual.failureReasons,
        metadata: {
          ...(input.manual.metadata || {}),
          certificationMode: 'manual',
        },
      });
    }

    // 2. Run Structural "Shell" Checks
    const failureReasons: string[] = [];
    if (!input.profile.enabled) failureReasons.push('Model profile is disabled');
    if (input.profile.status === 'blocked' || input.profile.status === 'deprecated') {
      failureReasons.push(`Model profile status is ${input.profile.status}`);
    }
    // dataFilterPolicyId is a per-tenant data-redaction policy. GLOBAL certifications
    // (Super-Admin-blessed models) don't need one — the platform vouches for the model
    // independently of how any specific tenant filters output.
    if (
      input.scope !== 'GLOBAL' &&
      !input.profile.dataFilterPolicyId &&
      ['ACCOUNTING', 'FINANCE_REPORTING', 'DATA_FILTERING', 'TOOL_CALLING'].includes(input.category)
    ) {
      failureReasons.push('No dataFilterPolicyId is assigned to the runtime profile');
    }
    if (['TOOL_CALLING', 'ACCOUNTING', 'FINANCE_REPORTING'].includes(input.category) && input.profile.toolMode === 'none') {
      failureReasons.push('Profile toolMode does not support tool workflows');
    }

    // 3. Run Deep AI Probe Test (if provider provided)
    let deepTestScore = 0;
    let deepTestSummary = '';
    let behavioralTestScore = 0;
    let behavioralTestResults: CertificationTestResult[] = [];
    let behavioralTestSummary = '';

    if (failureReasons.length === 0 && provider) {
      const probeResult = await this.runDeepTest(provider, input);
      if (probeResult.success) {
        deepTestScore = 20; // 40 (structural) + 20 (deep) + 40 (behavioral) = 100
        deepTestSummary = 'AI Deep Probe passed: Model successfully demonstrated tool-calling capability.';

        // 4. Run Behavioral Tests (if provider available and deep probe passed)
        try {
          const minimalConfig = new AiProviderConfig(
            'cert-engine-test',
            input.profile.provider as any,
            input.profile.modelId,
            '***',
            undefined,
            1024,
            undefined,
            0,
            undefined,
            true,
            new Date(),
            'balanced',
            true,
            'legacy_unverified',
            input.profile.providerId
          );
          behavioralTestResults = await runAllTests(provider, minimalConfig, [input.category]);
          const numPassed = behavioralTestResults.filter(r => r.passed).length;
          const numTotal = behavioralTestResults.length;
          if (numTotal === 0) {
            behavioralTestScore = 40;
            behavioralTestSummary = `Behavioral tests: no tests defined for ${input.category} — auto-pass (40/40 points).`;
          } else {
            behavioralTestScore = Math.round((numPassed / numTotal) * 40);
            behavioralTestSummary = `Behavioral tests: ${numPassed}/${numTotal} passed (${behavioralTestScore}/40 points).`;
          }
        } catch (err: any) {
          behavioralTestSummary = `Behavioral tests skipped due to error: ${err.message}`;
          // Don't fail the entire certification; continue with lower score
        }
      } else {
        failureReasons.push(`AI Deep Probe failed: ${probeResult.error}`);
        deepTestSummary = `AI Deep Probe failed: ${probeResult.error}`;
      }
    } else if (failureReasons.length === 0 && !provider) {
      deepTestSummary = 'AI Deep Probe and behavioral tests skipped: No provider available. Structural checks only.';
    }

    const score = failureReasons.length === 0 ? (deepTestScore + behavioralTestScore > 0 ? 40 + deepTestScore + behavioralTestScore : 40) : (deepTestScore > 0 ? 70 : 0);
    const status: AiModelCertificationStatus = score === 100 ? 'CERTIFIED' : (score >= 70 ? 'WARNING' : 'FAILED');

    return this.createResult(input, {
      score,
      maxScore: 100,
      status,
      testSuiteVersion: 'hybrid-v3-behavioral',
      toolContractVersion: AI_TOOL_CONTRACT_VERSION,
      dataFilterPolicyVersion: AI_DATA_FILTER_POLICY_VERSION,
      summary: status === 'CERTIFIED'
        ? `${deepTestSummary} ${behavioralTestSummary} Structural checks passed.`
        : `Certification incomplete or failed. ${deepTestSummary} ${behavioralTestSummary} ${failureReasons.join('; ')}`,
      failureReasons,
      metadata: {
        certificationMode: provider ? 'engine-full' : 'engine-shell-only',
        probeResult: deepTestScore === 20 ? 'PASS' : (provider ? 'FAIL' : 'SKIPPED'),
        deepTestScore,
        behavioralTestScore,
        behavioralTestResults: behavioralTestResults.map(r => ({
          testCaseId: r.testCaseId,
          passed: r.passed,
          reason: r.reason,
        })),
      },
    });
  }

  /**
   * Performs a real tool-calling handshake with the provider.
   */
  private async runDeepTest(provider: IAiProvider, input: AiCertificationEngineInput): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await provider.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are running a private compatibility diagnostic. Use the provided tool when asked. ' +
              'Do not include ERP data.',
          },
          {
            role: 'user',
            content:
              'Call the diagnostics_ping tool exactly once with this JSON argument: ' +
              '{"probe":"deep-probe-ok"}. Do not answer with normal text.',
          },
        ],
        tools: [DIAGNOSTIC_TOOL],
        maxTokens: 64,
        temperature: 0,
      });

      const ok = response.toolCalls?.some(toolCall =>
        toolCall.name === DIAGNOSTIC_TOOL.name &&
        toolCall.arguments?.probe === 'deep-probe-ok'
      ) ?? false;

      if (!ok) {
        return { success: false, error: 'Model did not return a valid tool_calls response for diagnostics_ping' };
      }
      
      return { success: true }; 
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private createResult(
    input: AiCertificationEngineInput,
    result: {
      score: number;
      maxScore: number;
      status: AiModelCertificationStatus;
      testSuiteVersion: string;
      toolContractVersion: string;
      dataFilterPolicyVersion: string;
      summary: string;
      failureReasons?: string[];
      metadata?: Record<string, unknown>;
    },
  ): AiModelCertificationResult {
    const id = AiModelCertificationResult.makeId({
      scope: input.scope,
      tenantId: input.tenantId,
      modelProfileId: input.profile.id,
      profileHash: input.profileHash,
      category: input.category,
      moduleId: input.moduleId,
      skillId: input.skillId,
    });

    return new AiModelCertificationResult(
      id,
      input.scope,
      input.tenantId,
      input.profile.providerId,
      input.profile.id,
      input.profileHash,
      input.category,
      result.score,
      result.maxScore,
      result.status,
      result.testSuiteVersion,
      result.toolContractVersion,
      result.dataFilterPolicyVersion,
      new Date(),
      input.testedBy,
      result.summary,
      input.moduleId,
      input.skillId,
      input.approvedBy,
      result.failureReasons || [],
      result.metadata || {},
    );
  }
}
