import { AiCertificationCategory, isAiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiModelCertificationResult, AiModelCertificationStatus } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile, AiModelScope } from '../../../domain/ai-assistant/entities/AiModelProfile';
import {
  AI_DATA_FILTER_POLICY_VERSION,
  AI_TOOL_CONTRACT_VERSION,
} from './AiModelRoutingGuard';

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

export class AiCertificationEngine {
  run(input: AiCertificationEngineInput): AiModelCertificationResult {
    if (input.profile.profileHash !== input.profileHash) {
      throw new Error('profileHash does not match current model profile hash');
    }
    if (!isAiCertificationCategory(input.category)) {
      throw new Error('Invalid certification category');
    }
    if (input.scope === 'TENANT' && !input.tenantId) {
      throw new Error('TENANT certification requires tenantId');
    }

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

    const failureReasons: string[] = [];
    if (!input.profile.enabled) failureReasons.push('Model profile is disabled');
    if (input.profile.status === 'blocked' || input.profile.status === 'deprecated') {
      failureReasons.push(`Model profile status is ${input.profile.status}`);
    }
    if (!input.profile.dataFilterPolicyId && ['ACCOUNTING', 'FINANCE_REPORTING', 'DATA_FILTERING', 'TOOL_CALLING'].includes(input.category)) {
      failureReasons.push('No dataFilterPolicyId is assigned to the runtime profile');
    }
    if (['TOOL_CALLING', 'ACCOUNTING', 'FINANCE_REPORTING'].includes(input.category) && input.profile.toolMode === 'none') {
      failureReasons.push('Profile toolMode does not support tool workflows');
    }

    const status: AiModelCertificationStatus = failureReasons.length === 0 ? 'WARNING' : 'FAILED';
    return this.createResult(input, {
      score: failureReasons.length === 0 ? 70 : 0,
      maxScore: 100,
      status,
      testSuiteVersion: 'shell-v1',
      toolContractVersion: AI_TOOL_CONTRACT_VERSION,
      dataFilterPolicyVersion: AI_DATA_FILTER_POLICY_VERSION,
      summary: status === 'WARNING'
        ? 'Certification engine shell completed deterministic structural checks only. Deep ERP correctness tests are not implemented yet.'
        : 'Certification engine shell failed deterministic structural checks.',
      failureReasons,
      metadata: { certificationMode: 'engine-shell' },
    });
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
