import { httpClient } from './httpClient';

export const authApi = {
  getMyPermissions: () =>
    httpClient<{
      roleId: string | null;
      roleName: string | null;
      moduleBundles: string[];
      explicitPermissions: string[];
      resolvedPermissions: string[];
      isSuperAdmin: boolean;
    }>('/auth/me/permissions'),
};
