import client from './client';

export interface MyPermissionsResponse {
  roleId: string | null;
  roleName: string | null;
  moduleBundles: string[];
  explicitPermissions: string[];
  resolvedPermissions: string[];
  isSuperAdmin: boolean;
}

export const authApi = {
  getMyPermissions: () => 
    client.get<MyPermissionsResponse>('/auth/me/permissions'),
  
  getActiveCompany: () =>
    client.get<{ companyId: string | null }>('/users/me/active-company'),
};
