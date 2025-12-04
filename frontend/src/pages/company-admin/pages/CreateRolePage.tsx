
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';

const t = (key: string) => key;

export const CreateRolePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.roles.create")} 
        breadcrumbs={[{ label: 'Roles', href: '/company-admin/roles' }, { label: 'Create' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Basic Information</h3>
            <Input label={t("companyAdmin.roles.name")} placeholder="e.g. Sales Manager" />
            <Textarea label={t("companyAdmin.roles.description")} placeholder="Role description..." rows={3} />
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4">{t("companyAdmin.roles.permissions")}</h3>
            <div className="space-y-4">
               {['Core', 'Accounting', 'Inventory', 'HR', 'POS'].map(module => (
                 <div key={module} className="border-b pb-4 last:border-0">
                   <h4 className="font-medium text-gray-700 mb-2">{module}</h4>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {['View', 'Create', 'Edit', 'Delete', 'Approve'].map(perm => (
                       <label key={perm} className="flex items-center space-x-2">
                         <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                         <span className="text-sm text-gray-600">{perm} {module}</span>
                       </label>
                     ))}
                   </div>
                 </div>
               ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-6">
             <h3 className="font-bold text-gray-900 mb-4">Actions</h3>
             <div className="space-y-3">
               <Button className="w-full" variant="primary">Save Role</Button>
               <Button className="w-full" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
             </div>
          </Card>
        </div>
      </div>
    </CompanyAdminLayout>
  );
};

export default CreateRolePage;
