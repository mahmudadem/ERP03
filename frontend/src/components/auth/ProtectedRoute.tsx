
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { useRBAC } from '../../api/rbac/useRBAC';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredGlobalRole?: 'SUPER_ADMIN';
  requiredModule?: string;
}

export function ProtectedRoute({ children, requiredPermission, requiredGlobalRole, requiredModule }: ProtectedRouteProps) {
  const { isSuperAdmin, loading, companyId, moduleBundles } = useCompanyAccess();
  const companyIdFallback = companyId || localStorage.getItem('activeCompanyId') || '';
  const { hasPermission } = useRBAC();
  const location = useLocation();
  const path = location.pathname.startsWith('/') ? location.pathname : `/${location.pathname}`;
  const isWizardFlow = path.startsWith('/company-wizard') || path.startsWith('/company-selector');
  const activeModules = moduleBundles || [];

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!isWizardFlow && !companyIdFallback) {
    return <Navigate to="/company-selector" replace />;
  }

  // Global role guard
  if (requiredGlobalRole === 'SUPER_ADMIN' && !isSuperAdmin) {
    return <Navigate to="/forbidden" replace />;
  }

  if (requiredModule && !activeModules.includes(requiredModule)) {
    return <Navigate to="/forbidden" replace />;
  }

  // Permission guard (super admins bypass)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
