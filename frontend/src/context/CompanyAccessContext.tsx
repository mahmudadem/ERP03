import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
   permissionsLoaded: boolean;
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
  const [permissions, setPermissions] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('resolvedPermissions');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* ignore */
    }
    return [];
  });
  const [resolvedPermissions, setResolvedPermissions] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('resolvedPermissions');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* ignore */
    }
    return [];
  });
  const [moduleBundles, setModuleBundles] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('activeModules');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* ignore */
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('resolvedPermissions');
      if (cached) return true;
    } catch (e) {
      /* ignore */
    }
    return false;
  });

  const isSuperAdmin = permissions.includes('*') || resolvedPermissions.includes('*');

  const setCompanyId = (newCompanyId: string) => setCompanyIdState(newCompanyId);

  const loadPermissionsForActiveCompany = async () => {
    if (authLoading || !user) {
      setPermissionsLoaded(resolvedPermissions.length > 0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.getMyPermissions();
      setPermissions(data.resolvedPermissions || []);
      setResolvedPermissions(data.resolvedPermissions || []);
      setModuleBundles((prev) => (data.moduleBundles && data.moduleBundles.length ? data.moduleBundles : prev));
      localStorage.setItem('resolvedPermissions', JSON.stringify(data.resolvedPermissions || []));
      if (data.moduleBundles && data.moduleBundles.length) {
        localStorage.setItem('activeModules', JSON.stringify(data.moduleBundles));
      }
      // roleId and roleName from permissions endpoint are used instead
      setPermissionsLoaded(true);
    } catch (err) {
      console.error('Failed to load permissions', err);
      // Keep previous permissions on error to avoid clearing sidebar
      setPermissions((prev) => prev);
      setResolvedPermissions((prev) => prev);
      setModuleBundles((prev) => prev);
      setPermissionsLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const refreshPermissions = async () => {
    await loadPermissionsForActiveCompany();
  };

  const loadActiveCompany = async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setPermissionsLoaded(true);
      return;
    }
    setLoading(true);
    setPermissionsLoaded(false);
    try {
      const data = await companySelectorApi.getActiveCompany();
      const activeId = data.activeCompanyId || '';
      setCompanyIdState(activeId);
      // roleId, roleName, and isOwner are available in the response but not currently used in context
      // Pre-seed module bundles from the active company record so ProtectedRoute can use them
      const modules = (data.company && Array.isArray((data.company as any).modules)) ? (data.company as any).modules : [];
      setModuleBundles(modules);
      if (modules.length) {
        localStorage.setItem('activeModules', JSON.stringify(modules));
      }
      if (activeId) {
        await loadPermissionsForActiveCompany();
      } else {
        setPermissions([]);
        setResolvedPermissions([]);
        setModuleBundles([]);
        setPermissionsLoaded(false);
      }
    } catch (error) {
      console.error('Failed to load active company', error);
      // Keep existing state to avoid bouncing user; do not blank companyId here
      setPermissionsLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = async (newCompanyId: string) => {
    setLoading(true);
    setPermissionsLoaded(false);
    try {
      await companySelectorApi.switchCompany(newCompanyId);
      await queryClient.clear();
      // Optimistically set the active company so ProtectedRoute doesn't bounce us back
      setCompanyIdState(newCompanyId);
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
        permissionsLoaded,
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
