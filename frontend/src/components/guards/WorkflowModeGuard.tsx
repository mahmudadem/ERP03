import React from 'react';
import { Loader2, Settings, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDocumentPolicies } from '../../hooks/useDocumentPolicies';

interface WorkflowModeGuardProps {
  module: 'sales' | 'purchase';
  fallbackPath?: string;
  children: React.ReactElement;
}

export const WorkflowModeGuard: React.FC<WorkflowModeGuardProps> = ({
  module,
  children,
}) => {
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
    const settingsPath = module === 'sales' ? '/sales/settings' : '/purchases/settings';
    const moduleLabel = module === 'sales' ? 'Sales' : 'Purchases';
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Workflow size={22} />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            This page is hidden in Simple workflow
          </h2>
          <p className="mb-4 text-sm text-slate-700 dark:text-slate-300">
            {moduleLabel} Orders and Delivery Notes are part of the <strong>Operational</strong>{' '}
            workflow. Your company is currently in <strong>Simple</strong> mode, which uses direct
            invoicing only.
          </p>
          <p className="mb-5 text-xs text-slate-600 dark:text-slate-400">
            Switch the workflow mode in {moduleLabel} Settings to enable Quotations → Orders →
            Delivery Notes → Invoices.
          </p>
          <Link
            to={settingsPath}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            <Settings size={14} /> Open {moduleLabel} Settings
          </Link>
        </div>
      </div>
    );
  }

  return children;
};
