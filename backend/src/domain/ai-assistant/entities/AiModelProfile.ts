import { createHash } from 'crypto';

export type AiModelScope = 'GLOBAL' | 'TENANT';
export type AiModelStatus =
  | 'recommended'
  | 'tested'
  | 'experimental'
  | 'custom'
  | 'blocked'
  | 'deprecated'
  | 'text_only'
  | 'uncertified'
  | 'legacy_unverified';
export type AiModelWarningLevel = 'none' | 'info' | 'warning' | 'danger';
export type AiModelDiagnosticStatus = 'never-tested' | 'passed' | 'failed';
export type AiModelRuntimeMode = 'native-tool-calling' | 'text-plan' | 'text-only' | 'unavailable';
export type AiModelToolMode = 'none' | 'text_plan' | 'native_tools' | 'json_only';

export interface AiModelProfileProps {
  id: string;
  scope: AiModelScope;
  tenantId?: string;
  providerId: string;
  provider: string;
  modelId: string;
  modelName: string;
  displayName: string;
  baseUrl?: string;
  endpointFingerprint: string;
  temperature: number;
  maxOutputTokens: number;
  jsonMode: boolean;
  toolMode: AiModelToolMode;
  timeoutMs: number;
  retryPolicy: string;
  safetyPolicyId?: string;
  systemPromptPolicyId?: string;
  dataFilterPolicyId?: string;
  status: AiModelStatus;
  supportsToolCalling: boolean;
  supportsStructuredJson: boolean;
  maxContextTokens: number;
  recommendedUseCases: string[];
  tags: string[];
  warningLevel: AiModelWarningLevel;
  textOnlyMode: boolean;
  warningMessage: string;
  lastDiagnosticStatus: AiModelDiagnosticStatus;
  lastDiagnosticMode?: AiModelRuntimeMode;
  lastDiagnosticAt?: Date;
  lastDiagnosticCompanyId?: string;
  lastDiagnosticDetail?: string;
  profileHash: string;
  revision: number;
  enabled: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AiModelProfile implements AiModelProfileProps {
  constructor(
    public readonly id: string,
    public readonly provider: string,
    public readonly modelName: string,
    public readonly status: AiModelStatus,
    public readonly supportsToolCalling: boolean,
    public readonly supportsStructuredJson: boolean,
    public readonly maxContextTokens: number,
    public readonly recommendedUseCases: string[] = [],
    public readonly tags: string[] = [],
    public readonly warningLevel: AiModelWarningLevel = 'info',
    public readonly textOnlyMode: boolean = true,
    public readonly warningMessage: string = '',
    public readonly lastDiagnosticStatus: AiModelDiagnosticStatus = 'never-tested',
    public readonly lastDiagnosticMode?: AiModelRuntimeMode,
    public readonly lastDiagnosticAt?: Date,
    public readonly lastDiagnosticCompanyId?: string,
    public readonly lastDiagnosticDetail?: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly scope: AiModelScope = 'GLOBAL',
    public readonly tenantId: string | undefined = undefined,
    public readonly providerId: string = provider,
    public readonly modelId: string = modelName,
    public readonly displayName: string = modelName,
    public readonly baseUrl: string | undefined = undefined,
    public readonly endpointFingerprint: string = AiModelProfile.fingerprintEndpoint(baseUrl || provider),
    public readonly temperature: number = 0.7,
    public readonly maxOutputTokens: number = maxContextTokens,
    public readonly jsonMode: boolean = supportsStructuredJson,
    public readonly toolMode: AiModelToolMode = supportsToolCalling ? 'native_tools' : (textOnlyMode ? 'none' : 'text_plan'),
    public readonly timeoutMs: number = 120000,
    public readonly retryPolicy: string = 'default',
    public readonly safetyPolicyId: string | undefined = undefined,
    public readonly systemPromptPolicyId: string | undefined = undefined,
    public readonly dataFilterPolicyId: string | undefined = undefined,
    public readonly profileHash: string = AiModelProfile.generateProfileHash({
      scope,
      tenantId,
      providerId,
      modelId,
      endpointFingerprint: AiModelProfile.fingerprintEndpoint(baseUrl || provider),
      temperature,
      maxOutputTokens,
      jsonMode: supportsStructuredJson,
      toolMode: supportsToolCalling ? 'native_tools' : (textOnlyMode ? 'none' : 'text_plan'),
      timeoutMs: 120000,
      retryPolicy: 'default',
      safetyPolicyId,
      systemPromptPolicyId,
      dataFilterPolicyId,
    }),
    public readonly revision: number = 1,
    public readonly enabled: boolean = true,
    public readonly createdBy: string | undefined = undefined,
  ) {
    if (!provider.trim()) {
      throw new Error('AI model provider is required');
    }
    if (!modelName.trim()) {
      throw new Error('AI model name is required');
    }
    if (maxContextTokens < 1) {
      throw new Error('AI model maxContextTokens must be greater than zero');
    }
    if (scope === 'TENANT' && !tenantId) {
      throw new Error('TENANT AI model profiles require tenantId');
    }
  }

  static makeId(provider: string, modelName: string): string {
    const safeProvider = encodeURIComponent(provider.trim().toLowerCase());
    const safeModelName = encodeURIComponent(modelName.trim().toLowerCase());
    return `${safeProvider}:${safeModelName}`;
  }

  static makeRuntimeId(input: {
    scope: AiModelScope;
    tenantId?: string;
    providerId: string;
    modelId: string;
    endpointFingerprint: string;
  }): string {
    const parts = [
      input.scope.toLowerCase(),
      input.scope === 'TENANT' ? input.tenantId || 'missing-tenant' : 'global',
      input.providerId,
      input.modelId,
      input.endpointFingerprint,
    ];
    return parts.map(part => encodeURIComponent(part.trim().toLowerCase())).join(':');
  }

  static fingerprintEndpoint(endpoint: string | null | undefined): string {
    const normalized = (endpoint || '').trim().toLowerCase().replace(/\/+$/, '');
    return createHash('sha256').update(normalized || 'default').digest('hex').slice(0, 16);
  }

  static generateProfileHash(input: {
    scope: AiModelScope;
    tenantId?: string;
    providerId: string;
    modelId: string;
    endpointFingerprint: string;
    temperature: number;
    maxOutputTokens: number;
    jsonMode: boolean;
    toolMode: AiModelToolMode;
    timeoutMs: number;
    retryPolicy: string;
    safetyPolicyId?: string;
    systemPromptPolicyId?: string;
    dataFilterPolicyId?: string;
  }): string {
    const runtimeIdentity = {
      scope: input.scope,
      tenantId: input.scope === 'TENANT' ? input.tenantId || null : null,
      providerId: input.providerId.trim().toLowerCase(),
      modelId: input.modelId.trim(),
      endpointFingerprint: input.endpointFingerprint,
      temperature: Number(input.temperature),
      maxOutputTokens: Number(input.maxOutputTokens),
      jsonMode: Boolean(input.jsonMode),
      toolMode: input.toolMode,
      timeoutMs: Number(input.timeoutMs),
      retryPolicy: input.retryPolicy || 'default',
      safetyPolicyId: input.safetyPolicyId || null,
      systemPromptPolicyId: input.systemPromptPolicyId || null,
      dataFilterPolicyId: input.dataFilterPolicyId || null,
    };
    return createHash('sha256').update(JSON.stringify(runtimeIdentity)).digest('hex');
  }

  withDiagnostics(input: {
    status: AiModelDiagnosticStatus;
    mode: AiModelRuntimeMode;
    companyId: string;
    detail?: string;
  }): AiModelProfile {
    return new AiModelProfile(
      this.id,
      this.provider,
      this.modelName,
      this.status,
      this.supportsToolCalling,
      this.supportsStructuredJson,
      this.maxContextTokens,
      this.recommendedUseCases,
      this.tags,
      this.warningLevel,
      this.textOnlyMode,
      this.warningMessage,
      input.status,
      input.mode,
      new Date(),
      input.companyId,
      input.detail,
      this.createdAt,
      new Date(),
      this.scope,
      this.tenantId,
      this.providerId,
      this.modelId,
      this.displayName,
      this.baseUrl,
      this.endpointFingerprint,
      this.temperature,
      this.maxOutputTokens,
      this.jsonMode,
      this.toolMode,
      this.timeoutMs,
      this.retryPolicy,
      this.safetyPolicyId,
      this.systemPromptPolicyId,
      this.dataFilterPolicyId,
      this.profileHash,
      this.revision,
      this.enabled,
      this.createdBy,
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      scope: this.scope,
      tenantId: this.tenantId,
      providerId: this.providerId,
      provider: this.provider,
      modelId: this.modelId,
      modelName: this.modelName,
      displayName: this.displayName,
      baseUrl: this.baseUrl,
      endpointFingerprint: this.endpointFingerprint,
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
      jsonMode: this.jsonMode,
      toolMode: this.toolMode,
      timeoutMs: this.timeoutMs,
      retryPolicy: this.retryPolicy,
      safetyPolicyId: this.safetyPolicyId,
      systemPromptPolicyId: this.systemPromptPolicyId,
      dataFilterPolicyId: this.dataFilterPolicyId,
      status: this.status,
      supportsToolCalling: this.supportsToolCalling,
      supportsStructuredJson: this.supportsStructuredJson,
      maxContextTokens: this.maxContextTokens,
      recommendedUseCases: this.recommendedUseCases,
      tags: this.tags,
      warningLevel: this.warningLevel,
      textOnlyMode: this.textOnlyMode,
      warningMessage: this.warningMessage,
      lastDiagnosticStatus: this.lastDiagnosticStatus,
      lastDiagnosticMode: this.lastDiagnosticMode,
      lastDiagnosticAt: this.lastDiagnosticAt?.toISOString(),
      lastDiagnosticCompanyId: this.lastDiagnosticCompanyId,
      lastDiagnosticDetail: this.lastDiagnosticDetail,
      profileHash: this.profileHash,
      revision: this.revision,
      enabled: this.enabled,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiModelProfile {
    const scope = data.scope || 'GLOBAL';
    const provider = data.provider || data.providerId || '';
    const modelName = data.modelName || data.modelId || '';
    const providerId = data.providerId || provider;
    const modelId = data.modelId || modelName;
    const baseUrl = data.baseUrl || undefined;
    const endpointFingerprint = data.endpointFingerprint || AiModelProfile.fingerprintEndpoint(baseUrl || provider);
    const temperature = Number(data.temperature ?? 0.7);
    const maxContextTokens = Number(data.maxContextTokens || data.maxOutputTokens || 4096);
    const maxOutputTokens = Number(data.maxOutputTokens || maxContextTokens);
    const supportsToolCalling = data.supportsToolCalling === true;
    const supportsStructuredJson = data.supportsStructuredJson === true || data.jsonMode === true;
    const textOnlyMode = data.textOnlyMode !== false;
    const toolMode = data.toolMode || (supportsToolCalling ? 'native_tools' : (textOnlyMode ? 'none' : 'text_plan'));
    const timeoutMs = Number(data.timeoutMs || 120000);
    const retryPolicy = data.retryPolicy || 'default';
    const profileHash = data.profileHash || AiModelProfile.generateProfileHash({
      scope,
      tenantId: data.tenantId || undefined,
      providerId,
      modelId,
      endpointFingerprint,
      temperature,
      maxOutputTokens,
      jsonMode: supportsStructuredJson,
      toolMode,
      timeoutMs,
      retryPolicy,
      safetyPolicyId: data.safetyPolicyId || undefined,
      systemPromptPolicyId: data.systemPromptPolicyId || undefined,
      dataFilterPolicyId: data.dataFilterPolicyId || undefined,
    });

    return new AiModelProfile(
      data.id || AiModelProfile.makeRuntimeId({ scope, tenantId: data.tenantId || undefined, providerId, modelId, endpointFingerprint }),
      provider,
      modelName,
      data.status || 'custom',
      supportsToolCalling,
      supportsStructuredJson,
      maxContextTokens,
      Array.isArray(data.recommendedUseCases) ? data.recommendedUseCases : [],
      Array.isArray(data.tags) ? data.tags : [],
      data.warningLevel || 'info',
      textOnlyMode,
      data.warningMessage || '',
      data.lastDiagnosticStatus || 'never-tested',
      data.lastDiagnosticMode,
      data.lastDiagnosticAt?.toDate?.() || (data.lastDiagnosticAt ? new Date(data.lastDiagnosticAt) : undefined),
      data.lastDiagnosticCompanyId,
      data.lastDiagnosticDetail,
      data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
      data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : new Date()),
      scope,
      data.tenantId || undefined,
      providerId,
      modelId,
      data.displayName || modelName,
      baseUrl,
      endpointFingerprint,
      temperature,
      maxOutputTokens,
      supportsStructuredJson,
      toolMode,
      timeoutMs,
      retryPolicy,
      data.safetyPolicyId || undefined,
      data.systemPromptPolicyId || undefined,
      data.dataFilterPolicyId || undefined,
      profileHash,
      Number(data.revision || 1),
      data.enabled !== false,
      data.createdBy || undefined,
    );
  }
}
