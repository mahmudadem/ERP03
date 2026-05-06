import client from '../client';

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
  enabled?: boolean;
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
};

export * from './voucherTypes';
