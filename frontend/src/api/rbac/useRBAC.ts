import { useMemo } from 'react';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

export const useRBAC = () => {
  const { permissions, isSuperAdmin } = useCompanyAccess();

  const hasPermission = (perm?: string) => {
    if (!perm) return true;
    if (isSuperAdmin) return true;
    return permissions.includes(perm);
  };

  const hasAnyPermission = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.every((p) => permissions.includes(p));
  };

  return useMemo(
    () => ({
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [permissions, isSuperAdmin]
  );
};
