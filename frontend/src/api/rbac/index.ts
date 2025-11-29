
const API_BASE = '/api/v1';

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
}

export interface CompanyUser {
  userId: string;
  companyId: string;
  roleId: string;
  isOwner?: boolean;
  createdAt: Date;
}

export const rbacApi = {
  async getPermissions(): Promise<Permission[]> {
    const res = await fetch(`${API_BASE}/rbac/permissions`);
    const data = await res.json();
    return data.data;
  },

  async getSystemRoleTemplates(): Promise<SystemRoleTemplate[]> {
    const res = await fetch(`${API_BASE}/rbac/system-role-templates`);
    const data = await res.json();
    return data.data;
  },

  async getCurrentUserPermissions(companyId: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/rbac/current-user-permissions?companyId=${companyId}`);
    const data = await res.json();
    return data.data;
  },

  async listCompanyRoles(companyId: string): Promise<CompanyRole[]> {
    const res = await fetch(`${API_BASE}/rbac/companies/${companyId}/roles`);
    const data = await res.json();
    return data.data;
  },

  async createCompanyRole(companyId: string, role: Partial<CompanyRole>): Promise<CompanyRole> {
    const res = await fetch(`${API_BASE}/rbac/companies/${companyId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role)
    });
    const data = await res.json();
    return data.data;
  },

  async updateCompanyRole(companyId: string, roleId: string, updates: Partial<CompanyRole>): Promise<void> {
    await fetch(`${API_BASE}/rbac/companies/${companyId}/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  },

  async deleteCompanyRole(companyId: string, roleId: string): Promise<void> {
    await fetch(`${API_BASE}/rbac/companies/${companyId}/roles/${roleId}`, {
      method: 'DELETE'
    });
  },

  async listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    const res = await fetch(`${API_BASE}/rbac/companies/${companyId}/users`);
    const data = await res.json();
    return data.data;
  },

  async assignRoleToUser(companyId: string, userId: string, roleId: string): Promise<void> {
    await fetch(`${API_BASE}/rbac/companies/${companyId}/users/${userId}/assign-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId })
    });
  }
};
