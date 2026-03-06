
import React from 'react';
import { useTranslation } from 'react-i18next';

const PosHomePage: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <div className="p-4">
       <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
         {t('modulePlaceholders.pos.title', { defaultValue: 'Point of Sale' })}
       </h1>
    </div>
  );
};

export default PosHomePage;
