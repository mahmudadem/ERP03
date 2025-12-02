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
  getMyPermissions: async (): Promise<MyPermissionsResponse> => {
    const resp = await client.get<any>('/auth/me/permissions') as any;
    if (resp && resp.success && resp.data) {
      return resp.data as MyPermissionsResponse;
    }
    return resp as MyPermissionsResponse;
  },
  
  getActiveCompany: () =>
    client.get<{ companyId: string | null }>('/users/me/active-company'),
};
