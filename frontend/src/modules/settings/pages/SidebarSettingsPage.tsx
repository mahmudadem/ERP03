import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';

const SidebarSettingsPage: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.sidebar.title', { defaultValue: 'Menu Configuration' })}</h1>
      <Card className="p-6">
        <p>{t('settings.sidebar.placeholder', { defaultValue: 'Configure visibility of sidebar items here.' })}</p>
      </Card>
    </div>
  );
};

export default SidebarSettingsPage;
