import { httpClient } from '../httpClient';

export const superAdminPermissionsApi = {
  listModulesWithPermissions: () =>
    httpClient<any[]>('/system/permissions/modules'),
  getModulePermissions: (moduleId: string) =>
    httpClient<any>(`/system/permissions/${moduleId}`),
  updateModulePermissions: (moduleId: string, payload: any) =>
    httpClient<void>(`/system/permissions/${moduleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  createModulePermissions: (moduleId: string, payload: any) =>
    httpClient<void>(`/system/permissions/${moduleId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteModulePermissions: (moduleId: string) =>
    httpClient<void>(`/system/permissions/${moduleId}`, {
      method: 'DELETE',
    }),
};
