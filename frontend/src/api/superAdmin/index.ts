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
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bundle {
  id: string;
  name: string;
  description: string;
  businessDomains: string[];
  modulesIncluded: string[];
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

  createModule: (data: Omit<Module, 'createdAt' | 'updatedAt'>): Promise<void> =>
    client.post('/super-admin/modules', data),

  updateModule: (id: string, data: Partial<Omit<Module, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> =>
    client.patch(`/super-admin/modules/${id}`, data),

  deleteModule: (id: string): Promise<void> =>
    client.delete(`/super-admin/modules/${id}`),

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
};

export * from './voucherTypes';
