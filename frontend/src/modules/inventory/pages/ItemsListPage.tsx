import React from 'react';
import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';

const ItemsListPage: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {t('modulePlaceholders.inventory.itemsTitle', { defaultValue: 'Inventory Items' })}
      </h1>
      <Card className="p-6">
        <p className="text-slate-700 dark:text-slate-300">
          {t('modulePlaceholders.inventory.itemsDesc', { defaultValue: 'List of inventory products will go here.' })}
        </p>
      </Card>
    </div>
  );
};

export default ItemsListPage;
