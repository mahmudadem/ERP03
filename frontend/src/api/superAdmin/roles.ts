import { httpClient } from '../httpClient';

export const superAdminRolesApi = {
  listRoles: () => httpClient<any[]>('/system/roles'),
  getRole: (roleId: string) => httpClient<any>(`/system/roles/${roleId}`),
  createRole: (payload: any) =>
    httpClient<void>('/system/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRole: (roleId: string, payload: any) =>
    httpClient<void>(`/system/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
