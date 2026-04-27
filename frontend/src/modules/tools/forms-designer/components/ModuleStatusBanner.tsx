import React from 'react';
import { AlertTriangle, Loader2, CheckCircle, ArrowRight } from 'lucide-react';

type ModuleInitStatus = 'loading' | 'not_installed' | 'not_initialized' | 'initializing' | 'ready';

interface Props {
  moduleName: string;
  status: ModuleInitStatus;
  formsCount?: number;
}

const MODULE_LABELS: Record<string, string> = {
  ACCOUNTING: 'Accounting',
  SALES: 'Sales',
  PURCHASE: 'Purchase',
};

export const ModuleStatusBanner: React.FC<Props> = ({ moduleName, status }) => {
  const label = MODULE_LABELS[moduleName] || moduleName;
  const setupPath = `/${moduleName.toLowerCase()}/setup`;

  if (status === 'loading') {
    return null;
  }

  if (status === 'ready') {
    return null;
  }

  if (status === 'initializing') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
        <Loader2 className="animate-spin" size={18} />
        <div>
          <p className="font-bold">Setting up {label}...</p>
          <p className="text-sm text-blue-600">The module is being configured. Forms will be available once setup is complete.</p>
        </div>
      </div>
    );
  }

  if (status === 'not_initialized') {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-bold text-amber-800">{label} Module Not Configured</p>
            <p className="text-sm text-amber-700 mt-1">
              The {label} module is enabled but has not been set up yet. You need to complete the initial configuration before you can customize document forms.
            </p>
          </div>
        </div>
        <a
          href={setupPath}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 transition-colors"
        >
          Initialize {label}
          <ArrowRight size={14} />
        </a>
      </div>
    );
  }

  if (status === 'not_installed') {
    return (
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl">
        <AlertTriangle className="text-slate-500 shrink-0" size={20} />
        <div>
          <p className="font-bold text-slate-700">{label} Module Not Enabled</p>
          <p className="text-sm text-slate-500 mt-1">
            The {label} module is not enabled for this company. Enable it from Company Admin settings to access document forms.
          </p>
        </div>
      </div>
    );
  }

  return null;
};
