import React from 'react';
import { clsx } from 'clsx';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';

export const CompanyInfoWidget: React.FC = () => {
  const { company } = useCompanyAccess();
  const { settings, isLoading: settingsLoading } = useCompanySettings();

  const fyDate = company?.fiscalYearStart ? new Date(company.fiscalYearStart) : null;
  const fyYear = fyDate && !isNaN(fyDate.getTime()) && fyDate.getFullYear() > 2000 ? fyDate.getFullYear() : new Date().getFullYear();

  return (
    <div className="flex flex-col justify-center select-none bg-white p-1.5 px-3 rounded-lg border border-slate-200 shadow-sm h-10 w-fit">
      <span className="text-[14px] font-black tracking-tight text-[var(--color-text-primary)] leading-none mb-2">{company?.name || 'No Company'}</span>
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-widest leading-none">
          {company?.baseCurrency || 'CUR: NONE'} • {`FY ${fyYear}`}
        </span>
        {!settingsLoading && settings && (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)] opacity-50" />
            <span className={clsx(
              "text-[9px] px-1.5 py-[1px] rounded flex items-center gap-1 font-bold uppercase tracking-widest leading-none",
              settings.strictApprovalMode 
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" 
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            )}>
              {settings.strictApprovalMode ? 'STRICT' : 'FLEXIBLE'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
