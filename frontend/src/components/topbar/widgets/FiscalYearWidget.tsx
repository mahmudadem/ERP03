import React from 'react';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface FiscalYearWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const FiscalYearWidget: React.FC<FiscalYearWidgetProps> = ({
  showBorder = true,
  showBackground = true
}) => {
  const { t } = useTranslation('common');
  const { company } = useCompanyAccess();

  const fyDate = company?.fiscalYearStart ? new Date(company.fiscalYearStart) : null;
  const fyYear = fyDate && !isNaN(fyDate.getTime()) && fyDate.getFullYear() > 2000 ? fyDate.getFullYear() : new Date().getFullYear();

  return (
    <div className={clsx(
      "flex flex-col justify-center items-center p-1.5 px-3 rounded-lg h-full w-full select-none overflow-hidden transition-all",
      showBackground && "bg-white shadow-sm",
      showBorder && "border border-slate-200"
    )}>
      <span className="text-[9px] text-[var(--color-text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">
        {t('widgets.fiscalYear.label', 'Fiscal Year')}
      </span>
      <span className="text-[12px] font-black tracking-tight text-[var(--color-text-primary)] leading-none">
        {t('widgets.fiscalYear.value', { defaultValue: 'FY {{year}}', year: fyYear })}
      </span>
    </div>
  );
};
