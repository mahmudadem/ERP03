
import { ReactNode } from 'react';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { permissions, isSuperAdmin } = useCompanyAccess();
  
  if (isSuperAdmin || permissions.includes(permission)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}
