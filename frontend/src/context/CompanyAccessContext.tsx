import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { queryClient } from '../queryClient';
import { companySelectorApi } from '../modules/company-selector/api';
import { authApi } from '../api/auth';
import { useAuth } from './AuthContext';

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
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyIdState] = useState<string>(() => localStorage.getItem('activeCompanyId') || '');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [resolvedPermissions, setResolvedPermissions] = useState<string[]>([]);
  const [moduleBundles, setModuleBundles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const isSuperAdmin = permissions.includes('*') || resolvedPermissions.includes('*');

  const setCompanyId = (newCompanyId: string) => setCompanyIdState(newCompanyId);

  const loadPermissionsForActiveCompany = async () => {
    if (authLoading || !user) return;
    setLoading(true);
    try {
      const data = await authApi.getMyPermissions();
      setPermissions(data.resolvedPermissions || []);
      setResolvedPermissions(data.resolvedPermissions || []);
      setModuleBundles((prev) => (data.moduleBundles && data.moduleBundles.length ? data.moduleBundles : prev));
      setRoleId(data.roleId || null);
      setRoleName(data.roleName || null);
    } catch (err) {
      console.error('Failed to load permissions', err);
      setPermissions([]);
      setResolvedPermissions([]);
      setModuleBundles((prev) => prev);
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
    if (authLoading || !user) return;
    setLoading(true);
    try {
      const data = await companySelectorApi.getActiveCompany();
      const activeId = data.activeCompanyId || '';
      setCompanyIdState(activeId);
      setRoleId(data.roleId || null);
      setRoleName(data.roleName || null);
      setIsOwner(!!data.isOwner);
      // Pre-seed module bundles from the active company record so ProtectedRoute can use them
      const modules = (data.company && Array.isArray((data.company as any).modules)) ? (data.company as any).modules : [];
      setModuleBundles(modules);
      if (activeId) {
        await loadPermissionsForActiveCompany();
      } else {
        setPermissions([]);
        setResolvedPermissions([]);
        setModuleBundles([]);
      }
    } catch (error) {
      console.error('Failed to load active company', error);
      // Keep existing state to avoid bouncing user; do not blank companyId here
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = async (newCompanyId: string) => {
    setLoading(true);
    try {
      await companySelectorApi.switchCompany(newCompanyId);
      await queryClient.clear();
      // Optimistically set the active company so ProtectedRoute doesn't bounce us back
      setCompanyIdState(newCompanyId);
      setPermissions([]);
      setResolvedPermissions([]);
      setModuleBundles([]);
      setRoleId(null);
      setRoleName(null);
      setIsOwner(false);
      localStorage.setItem('activeCompanyId', newCompanyId);
      await loadActiveCompany();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      refreshPermissions();
    }
  }, [companyId, authLoading, user]);

  useEffect(() => {
    loadActiveCompany();
  }, [authLoading, user]);

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
