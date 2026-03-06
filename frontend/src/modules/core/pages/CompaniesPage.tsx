
import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const CompaniesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
          {t('companies.title', { defaultValue: 'My Companies' })}
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/company-wizard')}>
            {t('companies.createHint', { defaultValue: 'If you do not have a company, click here to create one' })}
          </Button>
          <Button>{t('companies.createNew', { defaultValue: '+ Create New Company' })}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-blue-500">
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {t('companies.sample.name', { defaultValue: 'TechFlow Solutions' })}
          </h3>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-300">
            {t('companies.sample.id', { defaultValue: 'ID: CMP_12345' })}
          </p>
          <div className="mt-4 flex gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
              {t('companies.active', { defaultValue: 'Active' })}
            </span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs rounded font-medium">
              {t('companies.premiumPlan', { defaultValue: 'Premium Plan' })}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CompaniesPage;
