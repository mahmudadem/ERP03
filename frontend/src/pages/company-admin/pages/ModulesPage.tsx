import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCompanyModules } from '../../../hooks/useCompanyAdmin';
import { useTranslation } from 'react-i18next';

export const ModulesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { modules, activeModules, isLoading, enableModule, disableModule, isEnabling, isDisabling } = useCompanyModules();

  const handleToggle = (moduleName: string, isEnabled: boolean) => {
    if (isEnabled) {
      if (window.confirm(t('companyAdmin.modules.confirmDisable', { moduleName }))) {
        disableModule({ moduleName });
      }
    } else {
      enableModule({ moduleName });
    }
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.modules.title")} 
        breadcrumbs={[{ label: t('companyAdmin.shared.companyAdmin') }, { label: t('companyAdmin.modules.title') }]}
      />

      <div className="mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{t('companyAdmin.modules.activeModules')}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isLoading ? t('companyAdmin.modules.loading') : t('companyAdmin.modules.activeCount', { count: activeModules.length })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : modules.length === 0 ? (
        <EmptyState 
          title={t('companyAdmin.modules.noModules')} 
          description={t('companyAdmin.modules.noModulesDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const isEnabled = activeModules.includes(module.id);
            const isMandatory = module.mandatory;
            
            return (
              <Card key={module.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{module.description}</p>
                  </div>
                  <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${
                    isEnabled 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {isEnabled ? t('companyAdmin.modules.active') : t('companyAdmin.modules.inactive')}
                  </div>
                </div>

                {isMandatory && (
                  <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    <span className="font-medium">{t('companyAdmin.modules.mandatoryModule')}</span> - {t('companyAdmin.modules.cannotBeDisabled')}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button
                    variant={isEnabled ? 'secondary' : 'primary'}
                    className="w-full"
                    onClick={() => handleToggle(module.id, isEnabled)}
                    disabled={isMandatory || isEnabling || isDisabling}
                  >
                    {isEnabling || isDisabling ? t('companyAdmin.modules.processing') : isEnabled ? t('companyAdmin.modules.disableModule') : t('companyAdmin.modules.enableModule')}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </CompanyAdminLayout>
  );
};

export default ModulesPage;
