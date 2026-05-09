import { AiCertificationCategory } from './AiCertificationCategory';
import { AiModelScope } from './AiModelProfile';

export type AiModelCertificationStatus = 'CERTIFIED' | 'WARNING' | 'FAILED' | 'EXPIRED';

export interface AiModelCertificationResultProps {
  id: string;
  scope: AiModelScope;
  tenantId?: string;
  providerId: string;
  modelProfileId: string;
  profileHash: string;
  moduleId?: string;
  skillId?: string;
  category: AiCertificationCategory;
  score: number;
  maxScore: number;
  status: AiModelCertificationStatus;
  testSuiteVersion: string;
  toolContractVersion: string;
  dataFilterPolicyVersion: string;
  testedAt: Date;
  testedBy: string;
  approvedBy?: string;
  summary: string;
  failureReasons?: string[];
  metadata?: Record<string, unknown>;
}

export class AiModelCertificationResult implements AiModelCertificationResultProps {
  constructor(
    public readonly id: string,
    public readonly scope: AiModelScope,
    public readonly tenantId: string | undefined,
    public readonly providerId: string,
    public readonly modelProfileId: string,
    public readonly profileHash: string,
    public readonly category: AiCertificationCategory,
    public readonly score: number,
    public readonly maxScore: number,
    public readonly status: AiModelCertificationStatus,
    public readonly testSuiteVersion: string,
    public readonly toolContractVersion: string,
    public readonly dataFilterPolicyVersion: string,
    public readonly testedAt: Date,
    public readonly testedBy: string,
    public readonly summary: string,
    public readonly moduleId?: string,
    public readonly skillId?: string,
    public readonly approvedBy?: string,
    public readonly failureReasons?: string[],
    public readonly metadata?: Record<string, unknown>,
  ) {
    if (!providerId.trim()) throw new Error('AI certification providerId is required');
    if (!modelProfileId.trim()) throw new Error('AI certification modelProfileId is required');
    if (!profileHash.trim()) throw new Error('AI certification profileHash is required');
    if (scope === 'TENANT' && !tenantId) throw new Error('TENANT certification requires tenantId');
  }

  static makeId(input: {
    scope: AiModelScope;
    tenantId?: string;
    modelProfileId: string;
    profileHash: string;
    category: AiCertificationCategory;
    moduleId?: string;
    skillId?: string;
  }): string {
    const parts = [
      input.scope,
      input.scope === 'TENANT' ? input.tenantId || 'missing-tenant' : 'global',
      input.modelProfileId,
      input.profileHash,
      input.category,
      input.moduleId || 'any-module',
      input.skillId || 'any-skill',
    ];
    return parts.map(part => encodeURIComponent(part)).join(':');
  }

  appliesToTenant(tenantId: string): boolean {
    return this.scope === 'GLOBAL' || (this.scope === 'TENANT' && this.tenantId === tenantId);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      scope: this.scope,
      tenantId: this.tenantId || null,
      providerId: this.providerId,
      modelProfileId: this.modelProfileId,
      profileHash: this.profileHash,
      moduleId: this.moduleId || null,
      skillId: this.skillId || null,
      category: this.category,
      score: this.score,
      maxScore: this.maxScore,
      status: this.status,
      testSuiteVersion: this.testSuiteVersion,
      toolContractVersion: this.toolContractVersion,
      dataFilterPolicyVersion: this.dataFilterPolicyVersion,
      testedAt: this.testedAt.toISOString(),
      testedBy: this.testedBy,
      approvedBy: this.approvedBy || null,
      summary: this.summary,
      failureReasons: this.failureReasons || [],
      metadata: this.metadata || {},
    };
  }

  static fromJSON(data: Record<string, any>): AiModelCertificationResult {
    return new AiModelCertificationResult(
      data.id || AiModelCertificationResult.makeId({
        scope: data.scope || 'GLOBAL',
        tenantId: data.tenantId || undefined,
        modelProfileId: data.modelProfileId || '',
        profileHash: data.profileHash || '',
        category: data.category || 'GENERAL_CHAT',
        moduleId: data.moduleId || undefined,
        skillId: data.skillId || undefined,
      }),
      data.scope || 'GLOBAL',
      data.tenantId || undefined,
      data.providerId || '',
      data.modelProfileId || '',
      data.profileHash || '',
      data.category || 'GENERAL_CHAT',
      Number(data.score ?? 0),
      Number(data.maxScore ?? 0),
      data.status || 'FAILED',
      data.testSuiteVersion || 'unknown',
      data.toolContractVersion || 'unknown',
      data.dataFilterPolicyVersion || 'unknown',
      data.testedAt?.toDate?.() || (data.testedAt ? new Date(data.testedAt) : new Date()),
      data.testedBy || 'unknown',
      data.summary || '',
      data.moduleId || undefined,
      data.skillId || undefined,
      data.approvedBy || undefined,
      Array.isArray(data.failureReasons) ? data.failureReasons : [],
      data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
    );
  }
}
