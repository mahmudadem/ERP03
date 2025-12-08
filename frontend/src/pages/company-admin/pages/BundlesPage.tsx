import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCompanyBundles } from '../../../hooks/useCompanyAdmin';

const t = (key: string) => key;

export const BundlesPage: React.FC = () => {
  const { currentBundle, availableBundles, isLoading, upgradeBundle, isUpgrading } = useCompanyBundles();

  const handleUpgrade = (bundleId: string, bundleName: string) => {
    if (window.confirm(`Are you sure you want to upgrade to ${bundleName}?`)) {
      upgradeBundle({ bundleId });
    }
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.bundles.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Subscription' }]}
      />

      {/* Current Bundle */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : currentBundle ? (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
          <Card className="p-6 border-2 border-blue-500">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">{currentBundle.name}</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    Current Plan
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{currentBundle.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Modules Included</p>
                    <p className="text-lg font-semibold">{currentBundle.modules?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Features Included</p>
                    <p className="text-lg font-semibold">{currentBundle.features?.length || 0}</p>
                  </div>
                </div>

                {currentBundle.modules && currentBundle.modules.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Included Modules:</p>
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
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        {availableBundles.length === 0 ? (
          <EmptyState 
            title="No upgrade options available" 
            description="You are already on the highest tier plan."
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
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{bundle.description}</p>
                  </div>

                  {bundle.pricing && (
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">${bundle.pricing.monthly}</span>
                        <span className="text-gray-500">/month</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        or ${bundle.pricing.annual}/year (save {Math.round((1 - bundle.pricing.annual / (bundle.pricing.monthly * 12)) * 100)}%)
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Modules</span>
                      <span className="font-semibold">{bundle.modules?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Features</span>
                      <span className="font-semibold">{bundle.features?.length || 0}</span>
                    </div>
                  </div>

                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    className="w-full"
                    disabled={isCurrent || isUpgrading}
                    onClick={() => !isCurrent && handleUpgrade(bundle.id, bundle.name)}
                  >
                    {isCurrent ? 'Current Plan' : isUpgrading ? 'Upgrading...' : 'Upgrade to ' + bundle.name}
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
