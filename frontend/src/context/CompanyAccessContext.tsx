import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { queryClient } from '../queryClient';
import { companySelectorApi } from '../modules/company-selector/api';
import { authApi } from '../api/auth';

export interface CompanyAccessContextValue {
  companyId: string;
  permissions: string[];
  resolvedPermissions: string[];
  moduleBundles: string[];
  isSuperAdmin: boolean;
  loading: boolean;
  setCompanyId: (companyId: string) => void;
  loadActiveCompany: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  loadPermissionsForActiveCompany: () => Promise<void>;
}

const CompanyAccessContext = createContext<CompanyAccessContextValue | undefined>(undefined);

export function CompanyAccessProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyIdState] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [resolvedPermissions, setResolvedPermissions] = useState<string[]>([]);
  const [moduleBundles, setModuleBundles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const isSuperAdmin = permissions.includes('*') || resolvedPermissions.includes('*');

  const setCompanyId = (newCompanyId: string) => setCompanyIdState(newCompanyId);

  const loadPermissionsForActiveCompany = async () => {
    setLoading(true);
    try {
      const data = await authApi.getMyPermissions();
      setPermissions(data.resolvedPermissions || []);
      setResolvedPermissions(data.resolvedPermissions || []);
      setModuleBundles(data.moduleBundles || []);
      setRoleId(data.roleId || null);
      setRoleName(data.roleName || null);
    } catch (err) {
      console.error('Failed to load permissions', err);
      setPermissions([]);
      setResolvedPermissions([]);
      setModuleBundles([]);
      setRoleId(null);
      setRoleName(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshPermissions = async () => {
    await loadPermissionsForActiveCompany();
  };

  const loadActiveCompany = async () => {
    try {
      const data = await companySelectorApi.getActiveCompany();
      const activeId = data.activeCompanyId || '';
      setCompanyIdState(activeId);
      setRoleId(data.roleId || null);
      setRoleName(data.roleName || null);
      setIsOwner(!!data.isOwner);
      if (activeId) {
        await loadPermissionsForActiveCompany();
      } else {
        setPermissions([]);
        setResolvedPermissions([]);
        setModuleBundles([]);
      }
    } catch (error) {
      console.error('Failed to load active company', error);
      setCompanyIdState('');
      setPermissions([]);
      setResolvedPermissions([]);
      setModuleBundles([]);
      setRoleId(null);
      setRoleName(null);
      setIsOwner(false);
    }
  };

  const switchCompany = async (newCompanyId: string) => {
    await companySelectorApi.switchCompany(newCompanyId);
    await queryClient.clear();
    setCompanyIdState('');
    setPermissions([]);
    setResolvedPermissions([]);
    setModuleBundles([]);
    setRoleId(null);
    setRoleName(null);
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
        resolvedPermissions,
        moduleBundles,
        isSuperAdmin,
        loading,
        setCompanyId,
        loadActiveCompany,
        switchCompany,
        refreshPermissions,
        loadPermissionsForActiveCompany,
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
