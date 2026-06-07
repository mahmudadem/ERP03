import React from 'react';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface ApprovalModeWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
  compact?: boolean;
}

export const ApprovalModeWidget: React.FC<ApprovalModeWidgetProps> = ({
  showBorder = true,
  showBackground = true,
  compact = false
}) => {
  const { t } = useTranslation('common');
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
      "flex items-center gap-2 rounded-lg h-full w-full select-none justify-center transition-all",
      !compact && "px-3 py-1.5",
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
      {!compact && (settings.strictApprovalMode ? (
        <ShieldAlert className="w-4 h-4 shrink-0" />
      ) : (
        <ShieldCheck className="w-4 h-4 shrink-0" />
      ))}
      <div className={clsx("flex flex-col truncate", compact ? "flex" : "hidden sm:flex")}>
         {!compact && (
           <span className="text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5 opacity-80">
              {t('widgets.approvalMode.label', 'Approval Mode')}
           </span>
         )}
         <span className={clsx("font-black tracking-tight leading-none uppercase truncate", compact ? "text-[11px]" : "text-[11px]")}>
            {settings.strictApprovalMode
              ? t('widgets.approvalMode.strict', 'Strict')
              : t('widgets.approvalMode.flexible', 'Flexible')}
         </span>
      </div>
    </div>
  );
};
