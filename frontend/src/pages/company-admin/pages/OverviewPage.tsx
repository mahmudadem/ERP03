
import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

// Mock translation function
const t = (key: string) => key;

export const OverviewPage: React.FC = () => {
  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.overview.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Overview' }]}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: t("companyAdmin.overview.statistics.roles"), value: '5', icon: '🛡️' },
          { label: t("companyAdmin.overview.statistics.users"), value: '24', icon: '👥' },
          { label: t("companyAdmin.overview.statistics.modules"), value: '4', icon: '📦' },
          { label: t("companyAdmin.overview.statistics.features"), value: '12', icon: '⚡' },
        ].map((stat, idx) => (
          <Card key={idx} className="p-6 flex items-center gap-4">
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
        {/* Recent Activity Placeholder */}
        <Card className="lg:col-span-2 p-6 h-80">
          <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
          <div className="flex flex-col items-center justify-center h-full text-gray-400 border-2 border-dashed border-gray-100 rounded">
            <p>Activity timeline visualization placeholder</p>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 h-80">
          <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
             <Button className="w-full justify-start" variant="secondary">+ Invite New User</Button>
             <Button className="w-full justify-start" variant="secondary">+ Create New Role</Button>
             <Button className="w-full justify-start" variant="secondary">Manage Subscription</Button>
             <Button className="w-full justify-start" variant="secondary">View Audit Logs</Button>
          </div>
        </Card>
      </div>
    </CompanyAdminLayout>
  );
};

export default OverviewPage;
