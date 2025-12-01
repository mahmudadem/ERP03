import client from '../client';

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
  getSystemOverview: (): Promise<SystemOverview> => 
    client.get('/super-admin/overview'),

  getAllUsers: (): Promise<SuperAdminUser[]> => 
    client.get('/super-admin/users'),

  promoteUser: (userId: string): Promise<void> =>
    client.patch(`/super-admin/users/${userId}/promote`),

  demoteUser: (userId: string): Promise<void> =>
    client.patch(`/super-admin/users/${userId}/demote`),

  getAllCompanies: (): Promise<SuperAdminCompany[]> => 
    client.get('/super-admin/companies'),

  startImpersonation: (companyId: string): Promise<{ impersonationToken: string }> =>
    client.post('/impersonate/start', { companyId }),
};
