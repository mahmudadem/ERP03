import React from 'react';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface BaseCurrencyWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const BaseCurrencyWidget: React.FC<BaseCurrencyWidgetProps> = ({
  showBorder = true,
  showBackground = true
}) => {
  const { t } = useTranslation('common');
  const { company } = useCompanyAccess();

  return (
    <div className={clsx(
      "flex flex-col justify-center items-center p-1.5 px-3 rounded-lg h-full w-full select-none overflow-hidden transition-all",
      showBackground && "bg-white shadow-sm",
      showBorder && "border border-slate-200"
    )}>
      <span className="text-[9px] text-[var(--color-text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">
        {t('widgets.baseCurrency.label', 'Currency')}
      </span>
      <span className="text-[12px] font-black tracking-tight text-[var(--color-text-primary)] leading-none">
        {company?.baseCurrency || t('widgets.baseCurrency.none', 'NONE')}
      </span>
    </div>
  );
};
