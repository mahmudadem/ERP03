import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { queryClient } from '../queryClient';
import { companySelectorApi } from '../modules/company-selector/api';
import { authApi } from '../api/auth';
import { useAuth } from './AuthContext';

export interface CompanyData {
  id: string;
  name: string;
  baseCurrency?: string;
  fiscalYearStart?: string;
  logoUrl?: string;
  modules?: string[];
}

export interface CompanyAccessContextValue {
  companyId: string;
  company: CompanyData | null;
  permissions: string[];
  resolvedPermissions: string[];
  moduleBundles: string[];
  isSuperAdmin: boolean;
  isOwner: boolean;
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
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isSuperAdminState, setIsSuperAdminState] = useState<boolean>(false);
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

  const isSuperAdmin = isSuperAdminState || permissions.includes('*') || resolvedPermissions.includes('*');
  const isOwnerOrWildcard = isSuperAdmin || isOwner;

  const setCompanyId = (newCompanyId: string) => setCompanyIdState(newCompanyId);

  const loadPermissionsForActiveCompany = useCallback(async () => {
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
      setIsOwner(!!data.isOwner);
      setIsSuperAdminState(!!data.isSuperAdmin);
      setModuleBundles((prev) => (data.moduleBundles && data.moduleBundles.length ? data.moduleBundles : prev));
      localStorage.setItem('resolvedPermissions', JSON.stringify(data.resolvedPermissions || []));
      if (data.moduleBundles && data.moduleBundles.length) {
        localStorage.setItem('activeModules', JSON.stringify(data.moduleBundles));
      }
      setPermissionsLoaded(true);
    } catch (err) {
      console.error('Failed to load permissions', err);
      setPermissions((prev) => prev);
      setResolvedPermissions((prev) => prev);
      setModuleBundles((prev) => prev);
      setPermissionsLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, resolvedPermissions.length]);

  const refreshPermissions = useCallback(async () => {
    await loadPermissionsForActiveCompany();
  }, [loadPermissionsForActiveCompany]);

  const loadActiveCompany = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setPermissionsLoaded(true);
      return;
    }
    
    setLoading(true);
    setPermissionsLoaded(false);
    
    try {
      const permData = await authApi.getMyPermissions();
      const isUserSuperAdmin = !!permData.isSuperAdmin;
      setIsSuperAdminState(isUserSuperAdmin);
      
      if (isUserSuperAdmin) {
        setPermissions(permData.resolvedPermissions || []);
        setResolvedPermissions(permData.resolvedPermissions || []);
        setIsOwner(false);
        setModuleBundles([]);
        setCompanyIdState('');
        setCompany(null);
        localStorage.setItem('resolvedPermissions', JSON.stringify(permData.resolvedPermissions || []));
        setPermissionsLoaded(true);
        setLoading(false);
        return;
      }
      
      const data = await companySelectorApi.getActiveCompany();
      const activeId = data.activeCompanyId || '';
      setCompanyIdState(activeId);
      if (data.company) {
        setCompany({
          id: activeId,
          name: data.company.name || 'Unknown Company',
          baseCurrency: data.company.baseCurrency || 'USD',
          fiscalYearStart: data.company.fiscalYearStart,
          logoUrl: data.company.logoUrl,
          modules: data.company.modules,
        });
      } else {
        setCompany(null);
      }
      const isOwnerFlag = !!(data as any).isOwner;
      setIsOwner(isOwnerFlag);
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
      setPermissionsLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, loadPermissionsForActiveCompany]);

  const switchCompany = useCallback(async (newCompanyId: string) => {
    setLoading(true);
    setPermissionsLoaded(false);
    try {
      await companySelectorApi.switchCompany(newCompanyId);
      await queryClient.clear();
      setCompanyIdState(newCompanyId);
      localStorage.setItem('activeCompanyId', newCompanyId);
      await loadActiveCompany();
    } finally {
      setLoading(false);
    }
  }, [loadActiveCompany]);

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

  const contextValue = useMemo((): CompanyAccessContextValue => {
    console.debug('[CompanyAccessContext] rendering new value', { companyId, loading, permissionsLoaded });
    return {
      companyId,
      company,
      permissions,
      resolvedPermissions,
      moduleBundles,
      isSuperAdmin: isSuperAdminState,
      isOwner: isOwnerOrWildcard,
      loading,
      permissionsLoaded,
      setCompanyId,
      loadActiveCompany,
      switchCompany,
      refreshPermissions,
      loadPermissionsForActiveCompany,
    };
  }, [
    companyId,
    company,
    permissions,
    resolvedPermissions,
    moduleBundles,
    isSuperAdminState,
    isOwnerOrWildcard,
    loading,
    permissionsLoaded,
    setCompanyId,
    loadActiveCompany,
    switchCompany,
    refreshPermissions,
    loadPermissionsForActiveCompany
  ]);

  return (
    <CompanyAccessContext.Provider value={contextValue}>
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
