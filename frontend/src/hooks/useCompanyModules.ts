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
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchModules = async () => {
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
