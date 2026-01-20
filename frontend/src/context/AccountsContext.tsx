import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { accountingApi, AccountDTO } from '../api/accountingApi';

// Account type matching backend (ADR-005 compliant)
export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;             // Alias for classification
  classification: string;
  accountRole: 'HEADER' | 'POSTING' | string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  currency?: string;
  currencyPolicy?: string;
  fixedCurrencyCode?: string | null;
  isActive?: boolean;
  parentId?: string | null;
  hasChildren?: boolean;
  canPost?: boolean;
}

interface AccountsContextValue {
  accounts: Account[];
  validAccounts: Account[];  // Accounts eligible for voucher entry
  isLoading: boolean;
  error: Error | null;
  refreshAccounts: () => void;
  getAccountByCode: (code: string) => Account | undefined;
  getAccountById: (id: string) => Account | undefined;
}

const AccountsContext = createContext<AccountsContextValue | null>(null);

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

interface AccountsProviderProps {
  children: ReactNode;
}

export const AccountsProvider: React.FC<AccountsProviderProps> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [validAccounts, setValidAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchAccounts = useCallback(async (force = false) => {
    // Check cache
    if (!force && Date.now() - lastFetch < CACHE_DURATION && accounts.length > 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use existing accountingApi
      const data = await accountingApi.getAccounts();
      
      const accountList: Account[] = data.map((acc: AccountDTO) => ({
        id: acc.id,
        code: acc.userCode || acc.code || '',
        name: acc.name,
        type: acc.classification || acc.type || '',
        classification: acc.classification || acc.type || '',
        accountRole: (acc.accountRole as any) || 'POSTING',
        status: (acc.status as any) || 'ACTIVE',
        currency: acc.fixedCurrencyCode || acc.currency,
        currencyPolicy: acc.currencyPolicy,
        fixedCurrencyCode: acc.fixedCurrencyCode,
        isActive: acc.status === 'ACTIVE' || acc.active !== false || acc.isActive !== false,
        parentId: acc.parentId,
        hasChildren: acc.hasChildren,
        canPost: acc.canPost
      }));
      
      setAccounts(accountList);
      
      // Filter valid accounts for Voucher Entry:
      // Must be POSTING role, ACTIVE status, and have NO children
      const valid = accountList.filter((acc: Account) => 
        acc.accountRole === 'POSTING' && 
        acc.status === 'ACTIVE' &&
        !acc.hasChildren
      );
      setValidAccounts(valid);
      
      setLastFetch(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Failed to fetch accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [lastFetch, accounts.length]);

  // Initial fetch
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const refreshAccounts = useCallback(() => {
    fetchAccounts(true);
  }, [fetchAccounts]);

  const getAccountByCode = useCallback((code: string): Account | undefined => {
    if (!code) return undefined;
    
    // Strategy 1: Exact code match
    let result = accounts.find(a => a.code === code) || validAccounts.find(a => a.code === code);
    
    // Strategy 2: Try ID match (in case code is actually an ID)
    if (!result) {
      result = accounts.find(a => a.id === code) || validAccounts.find(a => a.id === code);
    }
    
    // Strategy 3: Case-insensitive code match
    if (!result) {
      const lowerCode = code.toLowerCase();
      result = accounts.find(a => a.code.toLowerCase() === lowerCode) || 
               validAccounts.find(a => a.code.toLowerCase() === lowerCode);
    }
    
    // Debug: Log when lookup fails
    if (!result && code) {
      console.warn(`[AccountsContext] getAccountByCode("${code}") FAILED. Available codes:`, 
        accounts.slice(0, 5).map(a => a.code));
    }
    
    return result;
  }, [accounts, validAccounts]);

  const getAccountById = useCallback((id: string): Account | undefined => {
    return accounts.find(a => a.id === id) || validAccounts.find(a => a.id === id);
  }, [accounts, validAccounts]);

  const value: AccountsContextValue = {
    accounts,
    validAccounts,
    isLoading,
    error,
    refreshAccounts,
    getAccountByCode,
    getAccountById
  };

  return (
    <AccountsContext.Provider value={value}>
      {children}
    </AccountsContext.Provider>
  );
};

export const useAccounts = (): AccountsContextValue => {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error('useAccounts must be used within an AccountsProvider');
  }
  return context;
};

export default AccountsContext;
