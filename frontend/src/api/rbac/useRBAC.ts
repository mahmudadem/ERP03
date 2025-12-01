import { useMemo } from 'react';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

export const useRBAC = () => {
  const { resolvedPermissions, isSuperAdmin } = useCompanyAccess();

  let cachedPerms: string[] = [];
  try {
    const raw = localStorage.getItem('resolvedPermissions');
    if (raw) cachedPerms = JSON.parse(raw);
  } catch (e) {
    cachedPerms = [];
  }

  const effectivePermissions = resolvedPermissions.length ? resolvedPermissions : cachedPerms;

  const hasPermission = (perm?: string) => {
    if (!perm) return true;
    if (isSuperAdmin) return true;
    if (effectivePermissions.includes('*')) return true;
    return effectivePermissions.includes(perm);
  };

  const hasAnyPermission = (perms: string[]) => {
    if (isSuperAdmin || effectivePermissions.includes('*')) return true;
    return perms.some((p) => effectivePermissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]) => {
    if (isSuperAdmin || effectivePermissions.includes('*')) return true;
    return perms.every((p) => effectivePermissions.includes(p));
  };

  return useMemo(
    () => ({
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [effectivePermissions, isSuperAdmin]
  );
};
