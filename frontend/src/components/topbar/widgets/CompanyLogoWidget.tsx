import React from 'react';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useTranslation } from 'react-i18next';

export const CompanyLogoWidget: React.FC = () => {
  const { t } = useTranslation('common');
  const { company } = useCompanyAccess();
  
  return (
    <div className="h-10 w-10 rounded-lg border border-transparent shadow-sm bg-white flex items-center justify-center overflow-hidden shrink-0">
      {company?.logoUrl && company.logoUrl.trim() !== '' ? (
        <img src={company.logoUrl} alt={t('widgets.company.logoAlt', 'Company Logo')} className="max-h-full max-w-full object-contain p-0.5 pointer-events-none" />
      ) : (
        <div className="h-full w-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg select-none">
          {company?.name?.charAt(0) || '?'}
        </div>
      )}
    </div>
  );
};
