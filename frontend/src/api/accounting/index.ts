/**
 * Accounting API Interface
 * 
 * Defines the frontend contract for Account management, mirroring the
 * new backend Account entity structure.
 */

import client from '../client';

// Enums
export type AccountRole = 'HEADER' | 'POSTING';
export type AccountClassification = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type BalanceNature = 'DEBIT' | 'CREDIT' | 'BOTH';
export type BalanceEnforcement = 'ALLOW_ABNORMAL' | 'WARN_ABNORMAL' | 'BLOCK_ABNORMAL';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type CurrencyPolicy = 'INHERIT' | 'FIXED' | 'OPEN' | 'RESTRICTED';

// Main Account Entity
export interface Account {
    id: string;
    companyId: string;
    
    // Identity
    systemCode: string;
    userCode: string;
    
    // Core
    name: string;
    description?: string | null;
    
    // Semantics
    accountRole: AccountRole;
    classification: AccountClassification;
    balanceNature: BalanceNature;
    balanceEnforcement: BalanceEnforcement;
    
    // Hierarchy
    parentId?: string | null;
    
    // Currency
    currencyPolicy: CurrencyPolicy;
    fixedCurrencyCode?: string | null;
    allowedCurrencyCodes?: string[];
    
    // Lifecycle
    status: AccountStatus;
    isProtected: boolean;
    replacedByAccountId?: string | null;
    
    // Computed Flags
    isUsed?: boolean;
    hasChildren?: boolean;
    
    // Audit
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    updatedBy?: string;

    // Approval Policy
    requiresApproval?: boolean;
    requiresCustodyConfirmation?: boolean;
    custodianUserId?: string | null;
    
    // Legacy mapping (virtual/compat)
    code: string;       // maps to userCode
    type: string;       // maps to classification
    isActive: boolean;  // maps to status=ACTIVE
    currency?: string | null; // maps to fixedCurrencyCode
}

// Creation Input
export interface NewAccountInput {
    userCode: string;
    name: string;
    description?: string;
    classification: string;
    parentId?: string | null;
    status?: string;
    
    // Advanced settings
    accountRole?: string;
    balanceNature?: string;
    balanceEnforcement?: string;
    currencyPolicy?: string;
    fixedCurrencyCode?: string | null;
    allowedCurrencyCodes?: string[];
    
    // Approval Policy
    requiresApproval?: boolean;
    requiresCustodyConfirmation?: boolean;
    custodianUserId?: string | null;
    
    // Legacy support fields (optional)
    code?: string;
    type?: string;
    currency?: string;
    isActive?: boolean;
}

// Update Input
export interface UpdateAccountInput {
    userCode?: string;
    name?: string;
    description?: string;
    classification?: string;
    parentId?: string | null;
    
    status?: string;
    accountRole?: string;
    balanceNature?: string;
    balanceEnforcement?: string;
    currencyPolicy?: string;
    fixedCurrencyCode?: string | null;
    allowedCurrencyCodes?: string[];
    replacedByAccountId?: string | null;
    
    // Approval Policy
    requiresApproval?: boolean;
    requiresCustodyConfirmation?: boolean;
    custodianUserId?: string | null;
    
    // Legacy support fields
    code?: string;
    type?: string;
    isActive?: boolean;
    currency?: string;
}

export const accountingApi = {
    getAccounts: (): Promise<Account[]> => client.get('/tenant/accounting/accounts'),
    getAccount: (id: string): Promise<Account> => client.get(`/tenant/accounting/accounts/${id}`),
    createAccount: (payload: NewAccountInput): Promise<Account> => client.post('/tenant/accounting/accounts', payload),
    updateAccount: (id: string, payload: UpdateAccountInput): Promise<Account> => client.put(`/tenant/accounting/accounts/${id}`, payload),
    deactivateAccount: (id: string): Promise<void> => client.delete(`/tenant/accounting/accounts/${id}`),
};
