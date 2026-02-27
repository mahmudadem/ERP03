import React from 'react';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { clsx } from 'clsx';

interface FiscalYearWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const FiscalYearWidget: React.FC<FiscalYearWidgetProps> = ({
  showBorder = true,
  showBackground = true
}) => {
  const { company } = useCompanyAccess();

  const fyDate = company?.fiscalYearStart ? new Date(company.fiscalYearStart) : null;
  const fyYear = fyDate && !isNaN(fyDate.getTime()) && fyDate.getFullYear() > 2000 ? fyDate.getFullYear() : new Date().getFullYear();

  return (
    <div className={clsx(
      "flex flex-col justify-center items-center p-1.5 px-3 rounded-lg h-full w-full select-none overflow-hidden transition-all",
      showBackground && "bg-white shadow-sm",
      showBorder && "border border-slate-200"
    )}>
      <span className="text-[9px] text-[var(--color-text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">Fiscal Year</span>
      <span className="text-[12px] font-black tracking-tight text-[var(--color-text-primary)] leading-none">{`FY ${fyYear}`}</span>
    </div>
  );
};
