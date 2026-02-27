import React from 'react';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface ApprovalModeWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const ApprovalModeWidget: React.FC<ApprovalModeWidgetProps> = ({
  showBorder = true,
  showBackground = true
}) => {
  const { settings, isLoading } = useCompanySettings();

  if (isLoading || !settings) return (
     <div className={clsx(
       "flex justify-center items-center rounded-lg h-full w-full select-none transition-all",
       showBackground && "bg-white shadow-sm",
       showBorder && "border border-slate-200"
     )} />
  );

  return (
    <div className={clsx(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg h-full w-full select-none justify-center transition-all",
      showBorder && "border shadow-sm",
      !showBorder && "border-transparent",
      showBackground 
        ? (settings.strictApprovalMode 
            ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" 
            : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400")
        : (settings.strictApprovalMode
            ? "text-indigo-700 dark:text-indigo-400"
            : "text-emerald-700 dark:text-emerald-400")
    )}>
      {settings.strictApprovalMode ? (
        <ShieldAlert className="w-4 h-4 shrink-0" />
      ) : (
        <ShieldCheck className="w-4 h-4 shrink-0" />
      )}
      <div className="flex flex-col truncate hidden sm:flex">
         <span className="text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5 opacity-80">Approval Mode</span>
         <span className="text-[11px] font-black tracking-tight leading-none uppercase truncate">
            {settings.strictApprovalMode ? 'Strict' : 'Flexible'}
         </span>
      </div>
    </div>
  );
};
