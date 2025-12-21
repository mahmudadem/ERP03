
import { ReactNode } from 'react';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { permissions, isSuperAdmin } = useCompanyAccess();
  
  // Check if user has permission:
  // 1. Super admin has all permissions
  // 2. User has wildcard (*) permission
  // 3. User has specific permission
  const hasPermission = isSuperAdmin || 
                       permissions.includes('*') || 
                       permissions.includes(permission);
  
  if (hasPermission) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}
