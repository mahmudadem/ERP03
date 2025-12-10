import client from '../client';

export const superAdminRolesApi = {
  listRoles: (): Promise<any[]> => client.get('/super-admin/role-templates'),
  getRole: (roleId: string): Promise<any> => client.get(`/super-admin/role-templates/${roleId}`),
  createRole: (payload: any): Promise<void> =>
    client.post('/super-admin/role-templates', payload),
  updateRole: (roleId: string, payload: any): Promise<void> =>
    client.put(`/super-admin/role-templates/${roleId}`, payload),
  deleteRole: (roleId: string): Promise<void> =>
    client.delete(`/super-admin/role-templates/${roleId}`),
};
