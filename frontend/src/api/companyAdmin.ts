/**
 * Company Admin API Client
 * Handles all API calls for company administration features
 */

import client from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyProfile {
  id: string;
  name: string;
  currency: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  taxId?: string;
  address?: string;
  subscriptionPlan: string;
  modules: string[];
  features: string[];
}

export interface CompanyUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  status: string;
  joinedAt: string;
}

export interface CompanyRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedPermissions?: string[];
}

export interface CompanyModule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  mandatory?: boolean;
}

export interface CompanyBundle {
  id: string;
  name: string;
  tier: string;
  description: string;
  modules: string[];
  features: string[];
  pricing?: {
    monthly: number;
    annual: number;
  };
}

export interface CompanyFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

// ============================================================================
// PROFILE API
// ============================================================================

export const getCompanyProfile = async (): Promise<CompanyProfile> => {
  const response = await client.get('/tenant/company-admin/profile');
  return response as unknown as CompanyProfile;
};

export const updateCompanyProfile = async (
  updates: Partial<CompanyProfile>
): Promise<CompanyProfile> => {
  const response = await client.post('/tenant/company-admin/profile/update', updates);
  return response as unknown as CompanyProfile;
};

// ============================================================================
// USERS API
// ============================================================================

export const listUsers = async (): Promise<CompanyUser[]> => {
  const response = await client.get('/tenant/company-admin/users');
  return response as unknown as CompanyUser[];
};

export const inviteUser = async (payload: {
  email: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
}): Promise<{
  invitationId: string;
  email: string;
  roleId: string;
  status: string;
  invitedAt: string;
  expiresAt: string;
}> => {
  const response = await client.post('/tenant/company-admin/users/invite', payload);
  return response as unknown as {
    invitationId: string;
    email: string;
    roleId: string;
    status: string;
    invitedAt: string;
    expiresAt: string;
  };
};

export const updateUserRole = async (
  userId: string,
  payload: { roleId: string }
): Promise<{
  userId: string;
  companyId: string;
  roleId: string;
  roleName: string;
  updatedAt: string;
}> => {
  const response = await client.post(
    `/tenant/company-admin/users/${userId}/update-role`,
    payload
  );
  return response as unknown as {
    userId: string;
    companyId: string;
    roleId: string;
    roleName: string;
    updatedAt: string;
  };
};

export const disableUser = async (
  userId: string
): Promise<{
  userId: string;
  companyId: string;
  status: string;
  disabledAt: string;
  disabledBy: string;
}> => {
  const response = await client.post(`/tenant/company-admin/users/${userId}/disable`);
  return response as unknown as {
    userId: string;
    companyId: string;
    status: string;
    disabledAt: string;
    disabledBy: string;
  };
};

export const enableUser = async (
  userId: string
): Promise<{
  userId: string;
  companyId: string;
  status: string;
  enabledAt: string;
  enabledBy: string;
}> => {
  const response = await client.post(`/tenant/company-admin/users/${userId}/enable`);
  return response as unknown as {
    userId: string;
    companyId: string;
    status: string;
    enabledAt: string;
    enabledBy: string;
  };
};

export const deleteUser = async (userId: string): Promise<{ success: boolean }> => {
  const response = await client.delete(`/tenant/company-admin/users/${userId}`);
  return response as unknown as { success: boolean };
};

// ============================================================================
// ROLES API
// ============================================================================

export const listRoles = async (): Promise<CompanyRole[]> => {
  const response = await client.get('/tenant/company-admin/roles');
  return response as unknown as CompanyRole[];
};

export const getRole = async (roleId: string): Promise<CompanyRole> => {
  const response = await client.get(`/tenant/company-admin/roles/${roleId}`);
  return response as unknown as CompanyRole;
};

export const createRole = async (payload: {
  name: string;
  description?: string;
  permissions?: string[];
}): Promise<CompanyRole> => {
  const response = await client.post('/tenant/company-admin/roles/create', payload);
  return response as unknown as CompanyRole;
};

export const updateRole = async (
  roleId: string,
  payload: {
    name?: string;
    description?: string;
    permissions?: string[];
  }
): Promise<{ message: string }> => {
  const response = await client.post(`/tenant/company-admin/roles/${roleId}/update`, payload);
  return response as unknown as { message: string };
};

export const deleteRole = async (roleId: string): Promise<{ message: string }> => {
  const response = await client.delete(`/tenant/company-admin/roles/${roleId}`);
  return response as unknown as { message: string };
};

// ============================================================================
// MODULES API
// ============================================================================

export const listModules = async (): Promise<CompanyModule[]> => {
  const response = await client.get('/tenant/company-admin/modules');
  return response as unknown as CompanyModule[];
};

export const listActiveModules = async (): Promise<string[]> => {
  const response = await client.get('/tenant/company-admin/modules/active');
  return response as unknown as string[];
};

export const enableModule = async (payload: {
  moduleName: string;
}): Promise<{ moduleName: string; status: string }> => {
  const response = await client.post('/tenant/company-admin/modules/enable', payload);
  return response as unknown as { moduleName: string; status: string };
};

export const disableModule = async (payload: {
  moduleName: string;
}): Promise<{ moduleName: string; status: string }> => {
  const response = await client.post('/tenant/company-admin/modules/disable', payload);
  return response as unknown as { moduleName: string; status: string };
};

// ============================================================================
// BUNDLES API
// ============================================================================

export const getCurrentBundle = async (): Promise<CompanyBundle> => {
  const response = await client.get('/tenant/company-admin/bundle');
  return response as unknown as CompanyBundle;
};

export const listAvailableBundles = async (): Promise<CompanyBundle[]> => {
  const response = await client.get('/tenant/company-admin/bundle/available');
  return response as unknown as CompanyBundle[];
};

export const upgradeBundle = async (payload: {
  bundleId: string;
}): Promise<{ bundleId: string; status: string }> => {
  const response = await client.post('/tenant/company-admin/bundle/upgrade', payload);
  return response as unknown as { bundleId: string; status: string };
};

// ============================================================================
// FEATURES API
// ============================================================================

export const listFeatures = async (): Promise<CompanyFeature[]> => {
  const response = await client.get('/tenant/company-admin/features');
  return response as unknown as CompanyFeature[];
};

export const listActiveFeatures = async (): Promise<string[]> => {
  const response = await client.get('/tenant/company-admin/features/active');
  return response as unknown as string[];
};

export const toggleFeature = async (payload: {
  featureName: string;
  enabled: boolean;
}): Promise<{
  companyId: string;
  featureName: string;
  enabled: boolean;
  activeFeatures: string[];
}> => {
  const response = await client.post('/tenant/company-admin/features/toggle', payload);
  return response as unknown as {
    companyId: string;
    featureName: string;
    enabled: boolean;
    activeFeatures: string[];
  };
};
