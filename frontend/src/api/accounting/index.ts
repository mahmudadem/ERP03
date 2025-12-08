import client from '../client';

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
    getAccounts: (): Promise<Account[]> => client.get('/tenant/accounting/accounts'),
    getAccount: (id: string): Promise<Account> => client.get(`/tenant/accounting/accounts/${id}`),
    createAccount: (payload: NewAccountInput): Promise<Account> => client.post('/tenant/accounting/accounts', payload),
    updateAccount: (id: string, payload: UpdateAccountInput): Promise<Account> => client.put(`/tenant/accounting/accounts/${id}`, payload),
    deactivateAccount: (id: string): Promise<void> => client.delete(`/tenant/accounting/accounts/${id}`),
};

