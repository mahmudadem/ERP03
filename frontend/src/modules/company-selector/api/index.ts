import { httpClient } from '../../../api/httpClient';

export interface UserCompany {
  id: string;
  name: string;
  model: string;
  role: string;
  createdAt?: string;
  lastAccessedAt?: string;
}

export const companySelectorApi = {
  getUserCompanies: () => httpClient<UserCompany[]>('/users/me/companies'),
  switchCompany: (companyId: string) =>
    httpClient<void>('/users/me/switch-company', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    }),
  getActiveCompany: () =>
    httpClient<{ activeCompanyId: string | null; company?: any; roleId?: string; isOwner?: boolean }>(
      '/users/me/active-company'
    ),
};
