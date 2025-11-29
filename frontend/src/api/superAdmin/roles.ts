import { httpClient } from '../httpClient';

export const superAdminRolesApi = {
  listRoles: () => httpClient<any[]>('/system/rbac/roles'),
  getRole: (roleId: string) => httpClient<any>(`/system/rbac/roles/${roleId}`),
  createRole: (payload: any) =>
    httpClient<void>('/system/rbac/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRole: (roleId: string, payload: any) =>
    httpClient<void>(`/system/rbac/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
