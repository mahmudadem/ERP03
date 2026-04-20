import { useState, useEffect, useCallback } from 'react';
import { companyModulesApi, CompanyModuleStatus } from '../api/companyModules';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import {
  COMPANY_MODULES_REFRESH_EVENT,
  CompanyModulesRefreshEventDetail,
} from '../utils/companyModulesEvents';

/**
 * Hook to fetch and manage company module installation statuses
 */
export function useCompanyModules() {
  const { companyId } = useCompanyAccess();
  const [modules, setModules] = useState<CompanyModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    if (!companyId) {
      setModules([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await companyModulesApi.list(companyId);
      setModules(data);
      setError(null);
    } catch (err) {
      setError('Failed to load module status');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    if (!companyId) return;

    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<CompanyModulesRefreshEventDetail | undefined>;
      const targetCompanyId = customEvent.detail?.companyId;

      if (targetCompanyId && targetCompanyId !== companyId) {
        return;
      }

      void fetchModules();
    };

    window.addEventListener(COMPANY_MODULES_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(COMPANY_MODULES_REFRESH_EVENT, handleRefresh);
  }, [companyId, fetchModules]);

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
    refreshModules: fetchModules,
  };
}
