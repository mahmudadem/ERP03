/**
 * Accounts Context
 * 
 * Provides cached account data to the application.
 * Fetches valid accounts once and caches for performance.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Account type matching backend
export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  currency: string;
  isActive: boolean;
  parentId?: string | null;
  isParent?: boolean;
}

interface AccountsContextValue {
  accounts: Account[];
  validAccounts: Account[];  // Leaf accounts only (for voucher entry)
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
      // Fetch all accounts (using existing endpoint)
      const response = await fetch('/api/v1/tenant/accounting/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setAccounts(data.data);
        
        // Filter valid accounts client-side (leaf accounts = no children, active)
        // For now, consider all active accounts as valid
        // Later: backend will provide pre-filtered list
        const valid = data.data.filter((acc: Account) => acc.isActive !== false);
        setValidAccounts(valid);
        
        setLastFetch(Date.now());
      }
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
    return accounts.find(a => a.code === code) || validAccounts.find(a => a.code === code);
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
