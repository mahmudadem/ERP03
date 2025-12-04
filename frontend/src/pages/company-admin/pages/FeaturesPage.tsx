
import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { Feature } from '../../../types/company-admin';

const t = (key: string) => key;

const MOCK_FEATURES: Feature[] = [
  { id: '1', name: 'Beta Analytics', description: 'Try the new analytics dashboard (Beta)', status: 'inactive', category: 'General' },
  { id: '2', name: 'Dark Mode', description: 'Enable dark mode for all users', status: 'active', category: 'General' },
  { id: '3', name: 'Strict Approval', description: 'Require 2-step approval for vouchers', status: 'active', category: 'Accounting' },
  { id: '4', name: 'Negative Stock', description: 'Allow inventory to go below zero', status: 'inactive', category: 'Inventory' },
];

export const FeaturesPage: React.FC = () => {
  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.features.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Features' }]}
      />

      <div className="space-y-6">
        {['General', 'Accounting', 'Inventory'].map(cat => {
           const catFeatures = MOCK_FEATURES.filter(f => f.category === cat);
           if (catFeatures.length === 0) return null;

           return (
             <Card key={cat} className="p-6">
                <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">{cat}</h3>
                <div className="space-y-6">
                  {catFeatures.map(feature => (
                    <div key={feature.id} className="flex items-center justify-between">
                       <div>
                         <h4 className="font-medium text-gray-900">{feature.name}</h4>
                         <p className="text-sm text-gray-500">{feature.description}</p>
                       </div>
                       <ToggleSwitch 
                         checked={feature.status === 'active'}
                         onChange={() => {}}
                         label={feature.status === 'active' ? 'Active' : 'Inactive'}
                       />
                    </div>
                  ))}
                </div>
             </Card>
           );
        })}
      </div>
    </CompanyAdminLayout>
  );
};

export default FeaturesPage;
