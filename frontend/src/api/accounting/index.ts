import { httpClient } from '../httpClient';

export interface Account {
    id: string;
    companyId: string;
    code: string;
    name: string;
    type: string;
    parentId?: string | null;
    isActive: boolean;
    isProtected: boolean;
    currency?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface NewAccountInput {
    code: string;
    name: string;
    type: string;
    parentId?: string | null;
    currency?: string | null;
}

export interface UpdateAccountInput {
    code?: string;
    name?: string;
    type?: string;
    parentId?: string | null;
    isActive?: boolean;
    currency?: string | null;
}

export const accountingApi = {
    // Accounts
    getAccounts: () => httpClient<Account[]>('/accounting/accounts'),
    getAccount: (id: string) => httpClient<Account>(`/accounting/accounts/${id}`),
    createAccount: (payload: NewAccountInput) => httpClient<Account>('/accounting/accounts', { method: 'POST', body: JSON.stringify(payload) }),
    updateAccount: (id: string, payload: UpdateAccountInput) => httpClient<Account>(`/accounting/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deactivateAccount: (id: string) => httpClient<void>(`/accounting/accounts/${id}`, { method: 'DELETE' }),
};
