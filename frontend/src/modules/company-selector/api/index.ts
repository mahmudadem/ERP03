import client from '../../../api/client';

export interface UserCompany {
  id: string;
  name: string;
  model: string;
  role: string;
  createdAt?: string;
  lastAccessedAt?: string;
}

export const companySelectorApi = {
  getUserCompanies: async (): Promise<UserCompany[]> => {
    const resp = await client.get<any>('/users/me/companies');
    if (Array.isArray(resp)) return resp;
    if (resp && Array.isArray(resp.data)) return resp.data;
    return [];
  },
  switchCompany: (companyId: string): Promise<void> =>
    client.post('/users/me/switch-company', { companyId }),
  getActiveCompany: (): Promise<{ activeCompanyId: string | null; company?: any; roleId?: string; roleName?: string; isOwner?: boolean }> =>
    client.get('/users/me/active-company'),
};
