import client from '../client';

export const superAdminRolesApi = {
  listRoles: (): Promise<any[]> => client.get('/system/roles'),
  getRole: (roleId: string): Promise<any> => client.get(`/system/roles/${roleId}`),
  createRole: (payload: any): Promise<void> =>
    client.post('/system/roles', payload),
  updateRole: (roleId: string, payload: any): Promise<void> =>
    client.put(`/system/roles/${roleId}`, payload),
};
