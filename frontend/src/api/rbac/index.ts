import client from '../client';

export interface Permission {
  id: string;
  category: string;
  labelEn: string;
  labelAr: string;
  labelTr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  descriptionTr?: string;
}

export interface SystemRoleTemplate {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isCore: boolean;
}

export interface CompanyRole {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  permissions: string[];
  sourceTemplateId?: string;
  isDefaultForNewUsers?: boolean;
  isSystem?: boolean;
}


export interface CompanyUser {
  userId: string;
  companyId: string;
  roleId: string;
  isOwner?: boolean;
  createdAt: Date;
}

export const rbacApi = {
  getPermissions: (): Promise<Permission[]> => {
    return client.get('/tenant/rbac/permissions');
  },

  getSystemRoleTemplates: (): Promise<SystemRoleTemplate[]> => {
    return client.get('/tenant/rbac/system-role-templates');
  },

  getCurrentUserPermissions: (companyId: string): Promise<string[]> => {
    return client.get(`/tenant/rbac/current-user-permissions?companyId=${companyId}`);
  },

  listCompanyRoles: (companyId: string): Promise<CompanyRole[]> => {
    return client.get(`/tenant/rbac/companies/${companyId}/roles`);
  },

  createCompanyRole: (companyId: string, role: Partial<CompanyRole>): Promise<CompanyRole> => {
    return client.post(`/tenant/rbac/companies/${companyId}/roles`, role);
  },

  updateCompanyRole: (companyId: string, roleId: string, updates: Partial<CompanyRole>): Promise<void> => {
    return client.patch(`/tenant/rbac/companies/${companyId}/roles/${roleId}`, updates);
  },

  deleteCompanyRole: (companyId: string, roleId: string): Promise<void> => {
    return client.delete(`/tenant/rbac/companies/${companyId}/roles/${roleId}`);
  },

  listCompanyUsers: (companyId: string): Promise<CompanyUser[]> => {
    return client.get(`/tenant/rbac/companies/${companyId}/users`);
  },

  assignRoleToUser: (companyId: string, userId: string, roleId: string): Promise<void> => {
    return client.post(`/tenant/rbac/companies/${companyId}/users/${userId}/assign-role`, { roleId });
  },

  deleteCompanyUser: (companyId: string, userId: string): Promise<void> => {
    return client.delete(`/tenant/rbac/companies/${companyId}/users/${userId}`);
  }
};


