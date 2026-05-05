import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const {
    data: modules = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['companyModules', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await companyModulesApi.list(companyId);
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const error = queryError ? 'Failed to load module status' : null;

  useEffect(() => {
    if (!companyId) return;

    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<CompanyModulesRefreshEventDetail | undefined>;
      const targetCompanyId = customEvent.detail?.companyId;

      if (targetCompanyId && targetCompanyId !== companyId) {
        return;
      }

      void refetch();
    };

    window.addEventListener(COMPANY_MODULES_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(COMPANY_MODULES_REFRESH_EVENT, handleRefresh);
  }, [companyId, refetch]);

  const refreshModules = useCallback(() => {
    void refetch();
  }, [refetch]);

  const isModuleInstalled = useCallback((moduleCode: string): boolean => {
    return modules.some((m) => m.moduleCode === moduleCode);
  }, [modules]);

  const isModuleInitialized = useCallback((moduleCode: string): boolean => {
    const module = modules.find((m) => m.moduleCode === moduleCode);
    return module?.initialized ?? false;
  }, [modules]);

  const getModuleStatus = useCallback((moduleCode: string): CompanyModuleStatus | undefined => {
    return modules.find((m) => m.moduleCode === moduleCode);
  }, [modules]);

  return {
    modules,
    loading,
    error,
    isModuleInstalled,
    isModuleInitialized,
    getModuleStatus,
    refreshModules,
  };
}
