import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCompanyFeatures } from '../../../hooks/useCompanyAdmin';

const t = (key: string) => key;

export const FeaturesPage: React.FC = () => {
  const { features, activeFeatures, isLoading, toggleFeature, isToggling } = useCompanyFeatures();

  const handleToggle = (featureName: string, currentlyEnabled: boolean) => {
    toggleFeature({ 
      featureName, 
      enabled: !currentlyEnabled 
    });
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.features.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Features' }]}
      />

      <div className="mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Active Features</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isLoading ? 'Loading...' : `${activeFeatures.length} features currently enabled`}
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
          title="No features available" 
          description="No features are available for your subscription plan."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const isEnabled = activeFeatures.includes(feature.id);
            
            return (
              <Card key={feature.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className={`text-sm font-medium ${
                    isEnabled ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleToggle(feature.id, isEnabled)}
                    disabled={isToggling}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
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
