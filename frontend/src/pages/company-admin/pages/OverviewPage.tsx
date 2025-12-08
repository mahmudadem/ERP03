import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useCompanyProfile, useCompanyUsers, useCompanyRoles, useCompanyModules, useCompanyFeatures } from '../../../hooks/useCompanyAdmin';

// Mock translation function
const t = (key: string) => key;

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading } = useCompanyProfile();
  const { users, isLoading: usersLoading } = useCompanyUsers();
  const { roles, isLoading: rolesLoading } = useCompanyRoles();
  const { activeModules, isLoading: modulesLoading } = useCompanyModules();
  const { activeFeatures, isLoading: featuresLoading } = useCompanyFeatures();

  const isLoading = profileLoading || usersLoading || rolesLoading || modulesLoading || featuresLoading;

  const stats = [
    { 
      label: t("companyAdmin.overview.statistics.roles"), 
      value: isLoading ? '...' : roles.length.toString(), 
      icon: '🛡️',
      onClick: () => navigate('/company-admin/roles')
    },
    { 
      label: t("companyAdmin.overview.statistics.users"), 
      value: isLoading ? '...' : users.length.toString(), 
      icon: '👥',
      onClick: () => navigate('/company-admin/users')
    },
    { 
      label: t("companyAdmin.overview.statistics.modules"), 
      value: isLoading ? '...' : activeModules.length.toString(), 
      icon: '📦',
      onClick: () => navigate('/company-admin/modules')
    },
    { 
      label: t("companyAdmin.overview.statistics.features"), 
      value: isLoading ? '...' : activeFeatures.length.toString(), 
      icon: '⚡',
      onClick: () => navigate('/company-admin/features')
    },
  ];

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={profile?.name || t("companyAdmin.overview.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Overview' }]}
        subtitle={profile?.subscriptionPlan ? `${profile.subscriptionPlan} Plan` : undefined}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <Card 
            key={idx} 
            className="p-6 flex items-center gap-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={stat.onClick}
          >
             <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">
               {stat.icon}
             </div>
             <div>
               <p className="text-sm text-gray-500">{stat.label}</p>
               <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
             </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Info */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-bold mb-4">Company Information</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : profile ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Company Name</p>
                  <p className="font-medium">{profile.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subscription Plan</p>
                  <p className="font-medium capitalize">{profile.subscriptionPlan}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Currency</p>
                  <p className="font-medium">{profile.currency}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tax ID</p>
                  <p className="font-medium">{profile.taxId || 'Not set'}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button 
                  variant="secondary" 
                  onClick={() => navigate('/company-admin/settings')}
                >
                  Edit Company Settings
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">No company information available</p>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
             <Button 
               className="w-full justify-start" 
               variant="secondary"
               onClick={() => navigate('/company-admin/users')}
             >
               + Invite New User
             </Button>
             <Button 
               className="w-full justify-start" 
               variant="secondary"
               onClick={() => navigate('/company-admin/roles/create')}
             >
               + Create New Role
             </Button>
             <Button 
               className="w-full justify-start" 
               variant="secondary"
               onClick={() => navigate('/company-admin/bundles')}
             >
               Manage Subscription
             </Button>
             <Button 
               className="w-full justify-start" 
               variant="secondary"
               onClick={() => navigate('/company-admin/modules')}
             >
               Configure Modules
             </Button>
          </div>
        </Card>
      </div>
    </CompanyAdminLayout>
  );
};

export default OverviewPage;
