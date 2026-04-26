import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCompanyFeatures } from '../../../hooks/useCompanyAdmin';
import { useTranslation } from 'react-i18next';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

export const FeaturesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { refreshPermissions } = useCompanyAccess();
  const { features, activeFeatures, isLoading, toggleFeature, isToggling } = useCompanyFeatures();
  const enabledCount = features.filter((feature) => feature.enabled && feature.available !== false).length || activeFeatures.length;

  const handleToggle = (featureName: string, currentlyEnabled: boolean) => {
    toggleFeature({ 
      featureName, 
      enabled: !currentlyEnabled 
    }, {
      onSuccess: () => refreshPermissions()
    });
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.features.title")} 
        breadcrumbs={[{ label: t('companyAdmin.shared.companyAdmin') }, { label: t('companyAdmin.features.title') }]}
      />

      <div className="mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{t('companyAdmin.features.activeFeatures')}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isLoading ? t('companyAdmin.features.loading') : t('companyAdmin.features.enabledCount', { count: enabledCount })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : features.length === 0 ? (
        <EmptyState 
          title={t('companyAdmin.features.noFeatures')} 
          description={t('companyAdmin.features.noFeaturesDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const featureCode = feature.code || feature.id;
            const isEnabled = feature.enabled ?? activeFeatures.includes(featureCode);
            const isBlocked = isEnabled && feature.available === false;
            const canToggle = !isToggling && (isEnabled || feature.available !== false);
             
            return (
              <Card key={featureCode} className={`p-6 ${isBlocked ? 'border-amber-300 bg-amber-50/40' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                    <div className="font-mono text-xs text-gray-400 mt-1">{featureCode}</div>
                    <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
                  </div>
                </div>

                {(isBlocked || (!isEnabled && feature.available === false)) && (
                  <div className="mb-4 rounded border border-amber-200 bg-amber-100 p-3 text-xs text-amber-800">
                    {feature.blockedReason || 'This capability is not currently available.'}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className={`text-sm font-medium ${
                    isBlocked ? 'text-amber-700' : isEnabled ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {isBlocked ? 'Blocked' : isEnabled ? t('companyAdmin.features.enabled') : t('companyAdmin.features.disabled')}
                  </span>
                  <button
                    onClick={() => handleToggle(featureCode, isEnabled)}
                    disabled={!canToggle}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isBlocked ? 'bg-amber-500' : isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    } ${!canToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </CompanyAdminLayout>
  );
};

export default FeaturesPage;
