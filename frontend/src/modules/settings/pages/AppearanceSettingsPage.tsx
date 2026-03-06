import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';

const AppearanceSettingsPage: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.appearance.title', { defaultValue: 'Appearance' })}</h1>
      <Card className="p-6">
        <p>{t('settings.appearance.placeholder', { defaultValue: 'Theme configuration settings will appear here.' })}</p>
      </Card>
    </div>
  );
};

export default AppearanceSettingsPage;
