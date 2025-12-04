
import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

const t = (key: string) => key;

export const SettingsPage: React.FC = () => {
  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.settings.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Settings' }]}
      />

      <div className="space-y-6">
        {/* Profile Section */}
        <Card className="p-6">
           <h3 className="font-bold text-lg text-gray-900 mb-4 pb-2 border-b">{t("companyAdmin.settings.profile")}</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Input label="Company Name" defaultValue="TechFlow Solutions" />
             <Input label="Tax ID / EIN" defaultValue="12-3456789" />
             <div className="md:col-span-2">
               <Textarea label="Address" rows={3} defaultValue="123 Innovation Dr, Tech City, CA" />
             </div>
             <Select label="Base Currency" options={[{label: 'USD - US Dollar', value: 'USD'}]} defaultValue="USD" />
             <Select label="Fiscal Year Start" options={[{label: 'January 1st', value: '01-01'}]} defaultValue="01-01" />
           </div>
           <div className="mt-4 flex justify-end">
             <Button>Save Profile</Button>
           </div>
        </Card>

        {/* Subscription */}
        <Card className="p-6">
           <div className="flex justify-between items-start mb-4 pb-2 border-b">
              <h3 className="font-bold text-lg text-gray-900">{t("companyAdmin.settings.subscription")}</h3>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
           </div>
           
           <div className="flex items-center justify-between bg-blue-50 p-4 rounded mb-6">
             <div>
               <p className="font-bold text-blue-900">Growth Bundle</p>
               <p className="text-sm text-blue-700">Next billing date: Oct 24, 2024</p>
             </div>
             <div className="text-xl font-bold text-blue-900">$79/mo</div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <h4 className="font-medium text-gray-700 mb-2">Billing Contact</h4>
               <p className="text-sm text-gray-500">John Doe<br/>john@techflow.com</p>
             </div>
             <div>
               <h4 className="font-medium text-gray-700 mb-2">Payment Method</h4>
               <p className="text-sm text-gray-500">Visa ending in 4242</p>
             </div>
           </div>
           
           <div className="mt-6 flex gap-3">
             <Button variant="secondary">View Invoices</Button>
             <Button variant="secondary">Update Payment Method</Button>
           </div>
        </Card>
      </div>
    </CompanyAdminLayout>
  );
};

export default SettingsPage;
