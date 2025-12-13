
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
  const { isSuperAdmin, loading, companyId, moduleBundles, resolvedPermissions } = useCompanyAccess();
  const companyIdFallback = companyId || localStorage.getItem('activeCompanyId') || '';
  const { hasPermission } = useRBAC();
  const location = useLocation();
  const path = location.pathname.startsWith('/') ? location.pathname : `/${location.pathname}`;
  const isWizardFlow = path.startsWith('/company-wizard') || path.startsWith('/company-selector');
  const isSuperAdminRoute = path.startsWith('/super-admin');
  let persistedModules: string[] = [];
  try {
    const raw = localStorage.getItem('activeModules');
    if (raw) persistedModules = JSON.parse(raw);
  } catch (e) {
    persistedModules = [];
  }

  const activeModules = (() => {
    const list = moduleBundles && moduleBundles.length ? moduleBundles : persistedModules;
    return Array.from(
      new Set(
        (list || []).flatMap((m) => (m === 'financial' ? ['accounting'] : [m]))
      )
    );
  })();
  const hasWildcard = resolvedPermissions.includes('*') || isSuperAdmin;

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  // Super Admins and super admin routes don't need a company - they manage the system
  if (!isWizardFlow && !isSuperAdminRoute && !companyIdFallback && !isSuperAdmin) {
    return <Navigate to="/company-selector" replace />;
  }

  // Global role guard
  if (requiredGlobalRole === 'SUPER_ADMIN' && !isSuperAdmin) {
    return <Navigate to="/forbidden" replace />;
  }

  if (requiredModule && !hasWildcard && !activeModules.includes(requiredModule)) {
    return <Navigate to="/forbidden" replace />;
  }

  // Permission guard (super admins bypass)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
