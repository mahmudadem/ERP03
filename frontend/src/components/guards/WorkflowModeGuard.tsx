import React from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDocumentPolicies } from '../../hooks/useDocumentPolicies';

interface WorkflowModeGuardProps {
  module: 'sales' | 'purchase';
  fallbackPath?: string;
  children: React.ReactElement;
}

export const WorkflowModeGuard: React.FC<WorkflowModeGuardProps> = ({
  module,
  fallbackPath,
  children,
}) => {
  const location = useLocation();
  const { loading, showSalesOperationalDocs, showPurchaseOperationalDocs } = useDocumentPolicies();

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const allowed = module === 'sales' ? showSalesOperationalDocs : showPurchaseOperationalDocs;
  if (!allowed) {
    return <Navigate to={fallbackPath || (module === 'sales' ? '/sales' : '/purchases')} replace state={{ from: location }} />;
  }

  return children;
};
