import client from '../client';

export const superAdminPermissionsApi = {
  listModulesWithPermissions: (): Promise<any[]> =>
    client.get('/system/permissions/modules'),
  getModulePermissions: (moduleId: string): Promise<any> =>
    client.get(`/system/permissions/${moduleId}`),
  updateModulePermissions: (moduleId: string, payload: any): Promise<void> =>
    client.put(`/system/permissions/${moduleId}`, payload),
  createModulePermissions: (moduleId: string, payload: any): Promise<void> =>
    client.post(`/system/permissions/${moduleId}`, payload),
  deleteModulePermissions: (moduleId: string): Promise<void> =>
    client.delete(`/system/permissions/${moduleId}`),
};
