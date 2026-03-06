import React from 'react';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface CompanyLogoNameWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const CompanyLogoNameWidget: React.FC<CompanyLogoNameWidgetProps> = ({
  showBorder = true,
  showBackground = true
}) => {
  const { t } = useTranslation('common');
  const { company } = useCompanyAccess();
  
  return (
    <div className={clsx(
      "flex items-center gap-3 p-1.5 px-3 rounded-lg h-full w-full select-none overflow-hidden transition-all",
      showBackground && "bg-white shadow-sm",
      showBorder && "border border-slate-200"
    )}>
      <div className="h-7 w-7 rounded-md border border-transparent bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
        {company?.logoUrl && company.logoUrl.trim() !== '' ? (
          <img src={company.logoUrl} alt={t('widgets.company.logoAlt', 'Company Logo')} className="max-h-full max-w-full object-contain p-0.5 pointer-events-none" />
        ) : (
          <div className="h-full w-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
            {company?.name?.charAt(0) || '?'}
          </div>
        )}
      </div>
      <span className="text-[13px] font-black tracking-tight text-[var(--color-text-primary)] leading-none truncate">{company?.name || t('widgets.company.none', 'No Company')}</span>
    </div>
  );
};
