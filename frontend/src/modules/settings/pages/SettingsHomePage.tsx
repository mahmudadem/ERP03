
import React from 'react';
import { useTranslation } from 'react-i18next';

const SettingsHomePage: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <div className="p-4">
       <h1 className="text-2xl font-bold mb-4">{t('settings.home.title', { defaultValue: 'System Settings' })}</h1>
    </div>
  );
};

export default SettingsHomePage;
