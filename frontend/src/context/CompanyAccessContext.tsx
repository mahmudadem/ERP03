
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { rbacApi } from '../api/rbac';
import { queryClient } from '../queryClient';
import { companySelectorApi } from '../modules/company-selector/api';

export interface CompanyAccessContextValue {
  companyId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  loading: boolean;
  setCompanyId: (companyId: string) => void;
  loadActiveCompany: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  refreshPermissions: (companyId?: string) => Promise<void>;
}

const CompanyAccessContext = createContext<CompanyAccessContextValue | undefined>(undefined);

export function CompanyAccessProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyIdState] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const isSuperAdmin = permissions.includes('*');

  const refreshPermissions = async (targetCompanyId?: string) => {
    const target = targetCompanyId || companyId;
    if (!target) {
      setPermissions([]);
      return;
    }

    setLoading(true);
    try {
      const perms = await rbacApi.getCurrentUserPermissions(target);
      setPermissions(perms);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const setCompanyId = (newCompanyId: string) => {
    setCompanyIdState(newCompanyId);
  };

  const loadActiveCompany = async () => {
    try {
      const data = await companySelectorApi.getActiveCompany();
      const activeId = data.activeCompanyId || '';
      setCompanyIdState(activeId);
      setRoleId(data.roleId || null);
      setIsOwner(!!data.isOwner);
      if (activeId) {
        await refreshPermissions(activeId);
      } else {
        setPermissions([]);
      }
    } catch (error) {
      console.error('Failed to load active company', error);
      setCompanyIdState('');
      setPermissions([]);
      setRoleId(null);
      setIsOwner(false);
    }
  };

  const switchCompany = async (newCompanyId: string) => {
    await companySelectorApi.switchCompany(newCompanyId);
    await queryClient.clear();
    setCompanyIdState('');
    setPermissions([]);
    setRoleId(null);
    setIsOwner(false);
    localStorage.setItem('activeCompanyId', newCompanyId);
    await loadActiveCompany();
  };

  useEffect(() => {
    refreshPermissions();
  }, [companyId]);

  useEffect(() => {
    loadActiveCompany();
  }, []);

  useEffect(() => {
    const handler = async (e: StorageEvent) => {
      if (e.key === 'activeCompanyId') {
        await queryClient.clear();
        await loadActiveCompany();
        window.location.href = '/';
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <CompanyAccessContext.Provider
      value={{
        companyId,
        permissions,
        isSuperAdmin,
        loading,
        setCompanyId,
        loadActiveCompany,
        switchCompany,
        refreshPermissions
      }}
    >
      {children}
    </CompanyAccessContext.Provider>
  );
}

export function useCompanyAccess() {
  const context = useContext(CompanyAccessContext);
  if (!context) {
    throw new Error('useCompanyAccess must be used within CompanyAccessProvider');
  }
  return context;
}
