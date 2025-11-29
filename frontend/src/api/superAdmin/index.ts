import { httpClient } from '../httpClient';

export interface SystemOverview {
  totalUsers: number;
  totalCompanies: number;
  totalVouchers: number;
  totalInventoryItems: number;
  totalRoles: number;
}

export interface SuperAdminUser {
  id: string;
  email: string;
  name?: string;
  globalRole: 'USER' | 'SUPER_ADMIN';
  createdAt?: string;
  pictureUrl?: string;
}

export interface SuperAdminCompany {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string;
  baseCurrency?: string;
}

export const superAdminApi = {
  getSystemOverview: () => httpClient<SystemOverview>('/system/overview'),

  getAllUsers: () => httpClient<SuperAdminUser[]>('/system/users'),

  promoteUser: (userId: string) =>
    httpClient<void>(`/system/users/${userId}/promote`, { method: 'PATCH' }),

  demoteUser: (userId: string) =>
    httpClient<void>(`/system/users/${userId}/demote`, { method: 'PATCH' }),

  getAllCompanies: () => httpClient<SuperAdminCompany[]>('/system/companies'),

  startImpersonation: (companyId: string) =>
    httpClient<{ impersonationToken: string }>(`/system/impersonate/start`, {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    }),
};
