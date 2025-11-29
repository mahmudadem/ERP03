import { useMemo } from 'react';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

export const useRBAC = () => {
  const { resolvedPermissions, isSuperAdmin } = useCompanyAccess();

  const hasPermission = (perm?: string) => {
    if (!perm) return true;
    if (isSuperAdmin) return true;
    return resolvedPermissions.includes(perm);
  };

  const hasAnyPermission = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.some((p) => resolvedPermissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.every((p) => resolvedPermissions.includes(p));
  };

  return useMemo(
    () => ({
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [resolvedPermissions, isSuperAdmin]
  );
};
