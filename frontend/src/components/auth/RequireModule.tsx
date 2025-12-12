import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

interface RequireModuleProps {
  moduleId: string;
  children: ReactNode;
}

export function RequireModule({ moduleId, children }: RequireModuleProps) {
  const { moduleBundles } = useCompanyAccess();
  const modules = moduleBundles || [];

  if (!modules.includes(moduleId)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

export default RequireModule;
