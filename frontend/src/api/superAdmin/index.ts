import client from '../client';
import type { ProviderHealthResponse } from '../aiAssistantApi';

// ===== Types =====

export interface SystemOverview {
  totalUsers: number;
  totalCompanies: number;
  totalVouchers: number;
  totalInventoryItems: number;
  totalRoles: number;
}

export interface SuperAdminUser {
  id: string;
  email: string;
  name?: string;
  globalRole: 'USER' | 'SUPER_ADMIN';
  createdAt?: string;
  pictureUrl?: string;
}

export interface SuperAdminCompany {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string;
  baseCurrency?: string;
}

// New Registry Types
export interface BusinessDomain {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  code?: string;
  name: string;
  description: string;
  version: string;
  lifecycleStatus: 'draft' | 'ready' | 'deprecated' | 'inactive';
  runtimeStatus: 'available' | 'suspended';
  implementationStatus: 'unchecked' | 'passed' | 'failed';
  implementationError?: string;
  implementationCheckedAt?: string | Date;
  releaseNotes?: string;
  dependencies?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  requiredPermissions?: string[];
}

export interface ModuleAvailabilityInfo {
  moduleId: string;
  state: string;
  dbRecord?: Module;
  manifest?: ModuleManifest;
  hasRouter: boolean;
  entitlementsMissing: boolean;
  reason?: string;
}

export interface ModuleAvailabilityReport {
  available: Module[];
  dbOnly: Module[];
  codeOnly: { id: string; manifest: ModuleManifest; hasRouter: boolean }[];
  versionMismatch: { moduleId: string; dbVersion: string; codeVersion: string }[];
  implementationFailed: Module[];
  notReady: Module[];
  implementationUnchecked: Module[];
  suspended: Module[];
}

export interface CreateModulePayload {
  id: string;
  name: string;
  description: string;
  version: string;
  releaseNotes?: string;
}

export interface UpdateModulePayload {
  name?: string;
  description?: string;
  version?: string;
  releaseNotes?: string;
  lifecycleStatus?: Module['lifecycleStatus'];
  runtimeStatus?: Module['runtimeStatus'];
  suspendReason?: string;
  reason?: string;
}

export interface Bundle {
  id: string;
  name: string;
  description: string;
  businessDomains: string[];
  modulesIncluded: string[];
  lifecycleStatus: 'draft' | 'ready' | 'deprecated' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  status: 'active' | 'inactive' | 'deprecated';
  limits: {
    maxCompanies: number;
    maxUsersPerCompany: number;
    maxModulesAllowed: number;
    maxStorageMB: number;
    maxTransactionsPerMonth: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// AI Provider Types
export type AiProviderRegistryType = 'openai' | 'openai_compatible' | 'google_gemini' | 'anthropic' | 'ollama' | 'custom';
export type AiProviderAuthType = 'api_key' | 'bearer' | 'none' | 'custom';

export interface AiProvider {
  id: string;
  name: string;
  type: AiProviderRegistryType;
  defaultBaseUrl: string | null;
  authType: AiProviderAuthType;
  enabled: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  supportsModelSync: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAiProviderPayload {
  id?: string;
  name: string;
  type: AiProviderRegistryType;
  defaultBaseUrl?: string;
  authType?: AiProviderAuthType;
  enabled?: boolean;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
  supportsModelSync?: boolean;
  notes?: string;
}

// AI Certification Types
export type AiCertificationCategory =
  | 'GENERAL_CHAT' | 'ACCOUNTING' | 'FINANCE_REPORTING' | 'SALES'
  | 'PURCHASES' | 'INVENTORY' | 'HR' | 'CRM'
  | 'TOOL_CALLING' | 'DATA_FILTERING' | 'PROPOSAL_DRAFT' | 'ANALYTICS';

export type AiCertificationStatus = 'CERTIFIED' | 'WARNING' | 'FAILED' | 'EXPIRED';

export interface AiCertificationResult {
  id: string;
  scope: 'GLOBAL' | 'TENANT';
  tenantId: string | null;
  providerId: string;
  modelProfileId: string;
  profileHash: string;
  moduleId: string | null;
  skillId: string | null;
  category: AiCertificationCategory;
  score: number;
  maxScore: number;
  status: AiCertificationStatus;
  testSuiteVersion: string;
  toolContractVersion: string;
  dataFilterPolicyVersion: string;
  testedAt: string;
  testedBy: string;
  approvedBy: string | null;
  summary: string;
  failureReasons: string[];
  metadata: Record<string, unknown>;
}

export interface CertifiedProfileEntry {
  profile: Record<string, unknown>;
  certifications: AiCertificationResult[];
}

export interface ManualCertificationPayload {
  profileHash: string;
  category: AiCertificationCategory;
  moduleId?: string;
  skillId?: string;
  score: number;
  maxScore: number;
  status: AiCertificationStatus;
  testSuiteVersion: string;
  toolContractVersion: string;
  dataFilterPolicyVersion: string;
  summary: string;
  failureReasons?: string[];
  metadata?: Record<string, unknown>;
  testedBy?: string;
  approvedBy?: string;
}

export interface RunCertificationPayload {
  profileHash: string;
  category: AiCertificationCategory;
  moduleId?: string;
  skillId?: string;
}

// AI Tool Catalog Types
export interface AiTool {
  name: string;
  namespace: string;
  module: string;
  category: string;
  mode: 'read-only' | 'proposal' | 'write';
  status: 'active' | 'disabled' | 'unavailable' | 'deprecated';
  riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  dataSensitivity: 'low' | 'medium' | 'high';
  description?: string;
  requiredPermissions?: string[];
  requiredModules?: string[];
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  unavailableReason?: string;
  implemented?: boolean;
  enabled?: boolean;
  isExecutable?: boolean;
  isBlocked?: boolean;
  safeForAutoInvoke?: boolean;
  operationType?: string;
  whenToUse?: string;
  safetyNotes?: string[];
  examples?: string[];
  chatKeywords?: string[];
  maxRows?: number;
  maxResults?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiToolEnablementPolicy {
  id: string;
  toolName: string;
  enabled: boolean;
  allowedRoles?: string[];
  allowedCompanies?: string[];
  maxUsagePerDay?: number;
  conditions?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiModelToolPolicy {
  id: string;
  modelId: string;
  modelName: string;
  toolName: string;
  allowed: boolean;
  conditions?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AiModelStatus = 'recommended' | 'tested' | 'experimental' | 'custom' | 'blocked' | 'deprecated' | 'text_only' | 'uncertified' | 'legacy_unverified';
export type AiModelWarningLevel = 'none' | 'info' | 'warning' | 'danger';
export type AiModelDiagnosticStatus = 'never-tested' | 'passed' | 'failed';
export type AiModelRuntimeMode = 'native-tool-calling' | 'text-plan' | 'text-only' | 'unavailable';
export type AiModelScope = 'GLOBAL' | 'TENANT';
export type AiModelToolMode = 'none' | 'text_plan' | 'native_tools' | 'json_only';

export interface AiModelProfile {
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
  lastDiagnosticAt?: string;
  lastDiagnosticCompanyId?: string;
  lastDiagnosticDetail?: string;
  profileHash: string;
  revision: number;
  enabled: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type { ProviderHealthResponse };

export interface UpsertAiModelProfilePayload {
  provider: string;
  modelName: string;
  status: AiModelStatus;
  supportsToolCalling: boolean;
  supportsStructuredJson: boolean;
  maxContextTokens: number;
  recommendedUseCases?: string[];
  tags?: string[];
  warningLevel?: AiModelWarningLevel;
  textOnlyMode: boolean;
  warningMessage?: string;
}

// ===== API Functions =====

export const superAdminApi = {
  // System Overview
  getSystemOverview: (): Promise<SystemOverview> => 
    client.get('/super-admin/overview'),

  // User Management
  getAllUsers: (): Promise<SuperAdminUser[]> => 
    client.get('/super-admin/users'),

  promoteUser: (userId: string): Promise<void> =>
    client.patch(`/super-admin/users/${userId}/promote`),

  demoteUser: (userId: string): Promise<void> =>
    client.patch(`/super-admin/users/${userId}/demote`),

  // Company Management
  getAllCompanies: (): Promise<SuperAdminCompany[]> => 
    client.get('/super-admin/companies'),

  // Impersonation
  startImpersonation: (companyId: string): Promise<{ impersonationToken: string }> =>
    client.post('/impersonate/start', { companyId }),

  // Business Domains
  getBusinessDomains: (): Promise<BusinessDomain[]> =>
    client.get('/super-admin/business-domains'),

  createBusinessDomain: (data: Omit<BusinessDomain, 'createdAt' | 'updatedAt'>): Promise<void> =>
    client.post('/super-admin/business-domains', data),

  updateBusinessDomain: (id: string, data: Partial<Omit<BusinessDomain, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> =>
    client.patch(`/super-admin/business-domains/${id}`, data),

  deleteBusinessDomain: (id: string): Promise<void> =>
    client.delete(`/super-admin/business-domains/${id}`),

  // Permissions
  getPermissions: (): Promise<Permission[]> =>
    client.get('/super-admin/permissions'),

  createPermission: (data: Omit<Permission, 'createdAt' | 'updatedAt'>): Promise<void> =>
    client.post('/super-admin/permissions', data),

  updatePermission: (id: string, data: Partial<Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> =>
    client.patch(`/super-admin/permissions/${id}`, data),

  deletePermission: (id: string): Promise<void> =>
    client.delete(`/super-admin/permissions/${id}`),

  // Modules
  getModules: (): Promise<Module[]> =>
    client.get('/super-admin/modules'),

  createModule: (data: CreateModulePayload): Promise<void> =>
    client.post('/super-admin/modules', data),

  updateModule: (id: string, data: UpdateModulePayload): Promise<void> =>
    client.patch(`/super-admin/modules/${id}`, data),

  deleteModule: (id: string): Promise<void> =>
    client.delete(`/super-admin/modules/${id}`),

  getModuleAvailabilityReport: (): Promise<ModuleAvailabilityReport> =>
    client.get('/super-admin/modules/availability'),

  getModuleAvailability: (id: string): Promise<ModuleAvailabilityInfo> =>
    client.get(`/super-admin/modules/${id}/availability`),

  checkModuleImplementation: (id: string): Promise<any> =>
    client.post(`/super-admin/modules/${id}/check-implementation`),

  // Bundles
  getBundles: (): Promise<Bundle[]> =>
    client.get('/super-admin/bundles'),

  createBundle: (data: Omit<Bundle, 'createdAt' | 'updatedAt'>): Promise<void> =>
    client.post('/super-admin/bundles', data),

  updateBundle: (id: string, data: Partial<Omit<Bundle, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> =>
    client.patch(`/super-admin/bundles/${id}`, data),

  deleteBundle: (id: string): Promise<void> =>
    client.delete(`/super-admin/bundles/${id}`),

  // Plans
  getPlans: (): Promise<Plan[]> =>
    client.get('/super-admin/plans'),

  createPlan: (data: Omit<Plan, 'createdAt' | 'updatedAt'>): Promise<void> =>
    client.post('/super-admin/plans', data),

  updatePlan: (id: string, data: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> =>
    client.patch(`/super-admin/plans/${id}`, data),

  deletePlan: (id: string): Promise<void> =>
    client.delete(`/super-admin/plans/${id}`),

  // Company Entitlements
  getCompanyEntitlements: (companyId: string): Promise<{ modules: string[]; entitlements: any[] }> =>
    client.get(`/super-admin/companies/${companyId}/entitlements`),

  grantModuleToCompany: (companyId: string, moduleKey: string): Promise<void> =>
    client.post(`/super-admin/companies/${companyId}/entitlements/modules`, { moduleKey }),

  revokeModuleFromCompany: (companyId: string, moduleKey: string): Promise<void> =>
    client.delete(`/super-admin/companies/${companyId}/entitlements/modules/${moduleKey}`),

// AI Tool Catalog
  getAiTools: (filters?: { module?: string; category?: string; status?: string; mode?: string }) =>
    client.get('/platform/ai-tools', { params: filters }),

  getAiTool: (toolName: string) =>
    client.get(`/platform/ai-tools/${toolName}`),

  enableAiTool: (toolName: string) =>
    client.patch(`/platform/ai-tools/${toolName}/enable`),

  disableAiTool: (toolName: string) =>
    client.patch(`/platform/ai-tools/${toolName}/disable`),

  updateAiToolKeywords: (toolName: string, keywords: string[]) =>
    client.patch(`/platform/ai-tools/${toolName}/keywords`, { keywords }),

  syncAiToolCatalog: () =>
    client.post('/platform/ai-tools/sync'),

  getAiToolEnablementPolicies: () =>
    client.get('/platform/ai-tool-policies'),

  updateAiToolEnablementPolicy: (toolId: string, data: any) =>
    client.patch(`/platform/ai-tool-policies/${toolId}`, data),

  getAiModelToolPolicies: () =>
    client.get('/platform/ai-model-tool-policies'),

  updateAiModelToolPolicy: (policyId: string, data: any) =>
    client.patch(`/platform/ai-model-tool-policies/${policyId}`, data),

  // AI Providers
  getAiProviders: (): Promise<AiProvider[]> =>
    client.get('/platform/ai-providers'),

  getAiProvider: (providerId: string): Promise<AiProvider> =>
    client.get(`/platform/ai-providers/${encodeURIComponent(providerId)}`),

  createAiProvider: (data: UpsertAiProviderPayload): Promise<AiProvider> =>
    client.post('/platform/ai-providers', data),

  updateAiProvider: (providerId: string, data: Partial<UpsertAiProviderPayload>): Promise<AiProvider> =>
    client.patch(`/platform/ai-providers/${encodeURIComponent(providerId)}`, data),

  enableAiProvider: (providerId: string): Promise<AiProvider> =>
    client.patch(`/platform/ai-providers/${encodeURIComponent(providerId)}/enable`),

  disableAiProvider: (providerId: string): Promise<AiProvider> =>
    client.patch(`/platform/ai-providers/${encodeURIComponent(providerId)}/disable`),

  // AI Model Profiles
  getAiModelProfiles: (filters?: { provider?: string; status?: string; tag?: string }) =>
    client.get('/platform/ai-model-profiles', { params: filters }),

  createAiModelProfile: (data: UpsertAiModelProfilePayload) =>
    client.post('/platform/ai-model-profiles', data),

  updateAiModelProfile: (profileId: string, data: UpsertAiModelProfilePayload) =>
    client.patch(`/platform/ai-model-profiles/${encodeURIComponent(profileId)}`, data),

  deleteAiModelProfile: (profileId: string) =>
    client.delete(`/platform/ai-model-profiles/${encodeURIComponent(profileId)}`),

  syncAiModelProfiles: () =>
    client.post('/platform/ai-model-profiles/sync'),

  runAiModelProfileDiagnostics: (profileId: string, companyId: string): Promise<ProviderHealthResponse> =>
    client.post(
      `/platform/ai-model-profiles/${encodeURIComponent(profileId)}/diagnostics`,
      { companyId },
      { timeout: 180_000 },
    ),

  // AI Certifications
  getAiModelProfileCertifications: (profileId: string): Promise<AiCertificationResult[]> =>
    client.get(`/platform/ai-model-profiles/${encodeURIComponent(profileId)}/certifications`),

  recordGlobalCertification: (profileId: string, data: ManualCertificationPayload): Promise<AiCertificationResult> =>
    client.post(`/platform/ai-model-profiles/${encodeURIComponent(profileId)}/certifications/manual`, data),

  runGlobalCertification: (profileId: string, data: RunCertificationPayload): Promise<AiCertificationResult> =>
    client.post(`/platform/ai-model-profiles/${encodeURIComponent(profileId)}/certifications/run`, data),

  expireCertification: (certificationId: string): Promise<AiCertificationResult> =>
    client.patch(`/platform/ai-certifications/${encodeURIComponent(certificationId)}/expire`),

  listValidCertifiedProfiles: (params?: { scope?: 'GLOBAL' | 'TENANT' | 'ALL'; category?: string; moduleId?: string }): Promise<CertifiedProfileEntry[]> =>
    client.get('/platform/ai-certifications/valid', { params }),
};

export * from './voucherTypes';
