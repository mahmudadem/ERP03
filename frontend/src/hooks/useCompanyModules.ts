import { useState, useEffect } from 'react';
import { companyModulesApi, CompanyModuleStatus } from '../api/companyModules';
import { useCompanyAccess } from '../context/CompanyAccessContext';

/**
 * Hook to fetch and manage company module installation statuses
 */
export function useCompanyModules() {
  const { companyId } = useCompanyAccess();
  const [modules, setModules] = useState<CompanyModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useCompanyModules] Effect triggered, companyId:', companyId);
    
    if (!companyId) {
      console.log('[useCompanyModules] No companyId, exiting');
      setLoading(false);
      return;
    }

    const fetchModules = async () => {
      try {
        console.log('[useCompanyModules] Fetching modules for company:', companyId);
        setLoading(true);
        const data = await companyModulesApi.list(companyId);
        console.log('[useCompanyModules] Modules fetched:', data);
        setModules(data);
        setError(null);
      } catch (err) {
        console.error('[useCompanyModules] Failed to load company modules:', err);
        setError('Failed to load module status');
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, [companyId]);

  const isModuleInitialized = (moduleCode: string): boolean => {
    const module = modules.find((m) => m.moduleCode === moduleCode);
    return module?.initialized ?? false;
  };

  const getModuleStatus = (moduleCode: string): CompanyModuleStatus | undefined => {
    return modules.find((m) => m.moduleCode === moduleCode);
  };

  return {
    modules,
    loading,
    error,
    isModuleInitialized,
    getModuleStatus,
    refreshModules: () => {
      if (companyId) {
        companyModulesApi.list(companyId).then(setModules);
      }
    },
  };
}
