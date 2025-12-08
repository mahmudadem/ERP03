/**
 * Company Admin React Query Hooks
 * Provides data fetching and mutation hooks for company administration
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import * as companyAdminApi from '../api/companyAdmin';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const companyAdminKeys = {
  all: ['company-admin'] as const,
  profile: () => [...companyAdminKeys.all, 'profile'] as const,
  users: () => [...companyAdminKeys.all, 'users'] as const,
  roles: () => [...companyAdminKeys.all, 'roles'] as const,
  role: (id: string) => [...companyAdminKeys.roles(), id] as const,
  modules: () => [...companyAdminKeys.all, 'modules'] as const,
  activeModules: () => [...companyAdminKeys.modules(), 'active'] as const,
  bundles: () => [...companyAdminKeys.all, 'bundles'] as const,
  currentBundle: () => [...companyAdminKeys.bundles(), 'current'] as const,
  availableBundles: () => [...companyAdminKeys.bundles(), 'available'] as const,
  features: () => [...companyAdminKeys.all, 'features'] as const,
  activeFeatures: () => [...companyAdminKeys.features(), 'active'] as const,
};

// ============================================================================
// PROFILE HOOKS
// ============================================================================

export const useCompanyProfile = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: companyAdminKeys.profile(),
    queryFn: companyAdminApi.getCompanyProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: companyAdminApi.updateCompanyProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(companyAdminKeys.profile(), data);
      toast.success('Company profile updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update company profile');
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
};

// ============================================================================
// USERS HOOKS
// ============================================================================

export const useCompanyUsers = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: companyAdminKeys.users(),
    queryFn: companyAdminApi.listUsers,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const inviteMutation = useMutation({
    mutationFn: companyAdminApi.inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.users() });
      toast.success('User invited successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to invite user');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      companyAdminApi.updateUserRole(userId, { roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.users() });
      toast.success('User role updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update user role');
    },
  });

  const disableMutation = useMutation({
    mutationFn: companyAdminApi.disableUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.users() });
      toast.success('User disabled successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to disable user');
    },
  });

  const enableMutation = useMutation({
    mutationFn: companyAdminApi.enableUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.users() });
      toast.success('User enabled successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to enable user');
    },
  });

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    inviteUser: inviteMutation.mutate,
    isInviting: inviteMutation.isPending,
    updateUserRole: updateRoleMutation.mutate,
    isUpdatingRole: updateRoleMutation.isPending,
    disableUser: disableMutation.mutate,
    isDisabling: disableMutation.isPending,
    enableUser: enableMutation.mutate,
    isEnabling: enableMutation.isPending,
  };
};

// ============================================================================
// ROLES HOOKS
// ============================================================================

export const useCompanyRoles = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: companyAdminKeys.roles(),
    queryFn: companyAdminApi.listRoles,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: companyAdminApi.createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.roles() });
      toast.success('Role created successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create role');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: any }) =>
      companyAdminApi.updateRole(roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.roles() });
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update role');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: companyAdminApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.roles() });
      toast.success('Role deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete role');
    },
  });

  return {
    roles: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createRole: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateRole: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteRole: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
};

export const useCompanyRole = (roleId: string) => {
  return useQuery({
    queryKey: companyAdminKeys.role(roleId),
    queryFn: () => companyAdminApi.getRole(roleId),
    enabled: !!roleId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// ============================================================================
// MODULES HOOKS
// ============================================================================

export const useCompanyModules = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: companyAdminKeys.modules(),
    queryFn: companyAdminApi.listModules,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const activeQuery = useQuery({
    queryKey: companyAdminKeys.activeModules(),
    queryFn: companyAdminApi.listActiveModules,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const enableMutation = useMutation({
    mutationFn: companyAdminApi.enableModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.modules() });
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.activeModules() });
      toast.success('Module enabled successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to enable module');
    },
  });

  const disableMutation = useMutation({
    mutationFn: companyAdminApi.disableModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.modules() });
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.activeModules() });
      toast.success('Module disabled successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to disable module');
    },
  });

  return {
    modules: query.data || [],
    activeModules: activeQuery.data || [],
    isLoading: query.isLoading || activeQuery.isLoading,
    isError: query.isError || activeQuery.isError,
    error: query.error || activeQuery.error,
    refetch: () => {
      query.refetch();
      activeQuery.refetch();
    },
    enableModule: enableMutation.mutate,
    isEnabling: enableMutation.isPending,
    disableModule: disableMutation.mutate,
    isDisabling: disableMutation.isPending,
  };
};

// ============================================================================
// BUNDLES HOOKS
// ============================================================================

export const useCompanyBundles = () => {
  const queryClient = useQueryClient();

  const currentQuery = useQuery({
    queryKey: companyAdminKeys.currentBundle(),
    queryFn: companyAdminApi.getCurrentBundle,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const availableQuery = useQuery({
    queryKey: companyAdminKeys.availableBundles(),
    queryFn: companyAdminApi.listAvailableBundles,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const upgradeMutation = useMutation({
    mutationFn: companyAdminApi.upgradeBundle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.currentBundle() });
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.profile() });
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.modules() });
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.features() });
      toast.success('Bundle upgraded successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to upgrade bundle');
    },
  });

  return {
    currentBundle: currentQuery.data,
    availableBundles: availableQuery.data || [],
    isLoading: currentQuery.isLoading || availableQuery.isLoading,
    isError: currentQuery.isError || availableQuery.isError,
    error: currentQuery.error || availableQuery.error,
    refetch: () => {
      currentQuery.refetch();
      availableQuery.refetch();
    },
    upgradeBundle: upgradeMutation.mutate,
    isUpgrading: upgradeMutation.isPending,
  };
};

// ============================================================================
// FEATURES HOOKS
// ============================================================================

export const useCompanyFeatures = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: companyAdminKeys.features(),
    queryFn: companyAdminApi.listFeatures,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const activeQuery = useQuery({
    queryKey: companyAdminKeys.activeFeatures(),
    queryFn: companyAdminApi.listActiveFeatures,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const toggleMutation = useMutation({
    mutationFn: companyAdminApi.toggleFeature,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.features() });
      queryClient.invalidateQueries({ queryKey: companyAdminKeys.activeFeatures() });
      toast.success('Feature toggled successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to toggle feature');
    },
  });

  return {
    features: query.data || [],
    activeFeatures: activeQuery.data || [],
    isLoading: query.isLoading || activeQuery.isLoading,
    isError: query.isError || activeQuery.isError,
    error: query.error || activeQuery.error,
    refetch: () => {
      query.refetch();
      activeQuery.refetch();
    },
    toggleFeature: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  };
};
