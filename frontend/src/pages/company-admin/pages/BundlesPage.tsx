import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCompanyBundles } from '../../../hooks/useCompanyAdmin';
import { useTranslation } from 'react-i18next';

export const BundlesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { currentBundle, availableBundles, isLoading, upgradeBundle, isUpgrading } = useCompanyBundles();

  const handleUpgrade = (bundleId: string, bundleName: string) => {
    if (window.confirm(t('companyAdmin.bundles.confirmUpgrade', { bundleName }))) {
      upgradeBundle({ bundleId });
    }
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.bundles.title")} 
        breadcrumbs={[{ label: t('companyAdmin.shared.companyAdmin') }, { label: t('companyAdmin.bundles.subscription') }]}
      />

      {/* Current Bundle */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : currentBundle ? (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">{t('companyAdmin.bundles.currentPlan')}</h2>
          <Card className="p-6 border-2 border-blue-500">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">{currentBundle.name}</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {t('companyAdmin.bundles.currentPlan')}
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{currentBundle.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">{t('companyAdmin.bundles.modulesIncluded')}</p>
                    <p className="text-lg font-semibold">{currentBundle.modules?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('companyAdmin.bundles.featuresIncluded')}</p>
                    <p className="text-lg font-semibold">{currentBundle.features?.length || 0}</p>
                  </div>
                </div>

                {currentBundle.modules && currentBundle.modules.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">{t('companyAdmin.bundles.includedModules')}</p>
                    <div className="flex flex-wrap gap-2">
                      {currentBundle.modules.map(module => (
                        <span key={module} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {module}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Available Bundles */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('companyAdmin.bundles.availablePlans')}</h2>
        {availableBundles.length === 0 ? (
          <EmptyState 
            title={t('companyAdmin.bundles.noUpgradeOptions')} 
            description={t('companyAdmin.bundles.highestPlan')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableBundles.map((bundle) => {
              const isCurrent = bundle.id === currentBundle?.id;
              
              return (
                <Card key={bundle.id} className={`p-6 ${isCurrent ? 'border-2 border-blue-500' : ''}`}>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{bundle.name}</h3>
                      {isCurrent && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {t('companyAdmin.bundles.current')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{bundle.description}</p>
                  </div>

                  {bundle.pricing && (
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">${bundle.pricing.monthly}</span>
                        <span className="text-gray-500">{t('companyAdmin.bundles.perMonth')}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{t('companyAdmin.bundles.annualPrice', {
                        annual: bundle.pricing.annual,
                        savings: Math.round((1 - bundle.pricing.annual / (bundle.pricing.monthly * 12)) * 100)
                      })}</p>
                    </div>
                  )}

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('companyAdmin.bundles.modules')}</span>
                      <span className="font-semibold">{bundle.modules?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('companyAdmin.bundles.features')}</span>
                      <span className="font-semibold">{bundle.features?.length || 0}</span>
                    </div>
                  </div>

                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    className="w-full"
                    disabled={isCurrent || isUpgrading}
                    onClick={() => !isCurrent && handleUpgrade(bundle.id, bundle.name)}
                  >
                    {isCurrent ? t('companyAdmin.bundles.currentPlan') : isUpgrading ? t('companyAdmin.bundles.upgrading') : t('companyAdmin.bundles.upgradeTo', { bundleName: bundle.name })}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CompanyAdminLayout>
  );
};

export default BundlesPage;
