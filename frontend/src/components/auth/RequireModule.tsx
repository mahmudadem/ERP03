import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCompanyContext } from '../../hooks/useCompanyContext';

interface RequireModuleProps {
  moduleId: string;
  children: React.ReactNode;
}

export function RequireModule({ moduleId, children }: RequireModuleProps) {
  const { activeCompanyModules } = useCompanyContext();
  const modules = activeCompanyModules || [];

  if (!modules.includes(moduleId)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

export default RequireModule;
