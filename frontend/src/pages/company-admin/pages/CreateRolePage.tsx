import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCompanyRoles } from '../../../hooks/useCompanyAdmin';

const t = (key: string) => key;

export const CreateRolePage: React.FC = () => {
  const navigate = useNavigate();
  const { createRole, isCreating } = useCompanyRoles();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRole(formData, {
      onSuccess: () => {
        navigate('/company-admin/roles');
      }
    });
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.roles.createTitle")} 
        breadcrumbs={[
          { label: 'Company Admin' }, 
          { label: 'Roles', href: '/company-admin/roles' }, 
          { label: 'Create' }
        ]}
      />

      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Finance Manager"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Choose a descriptive name for this role
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role's responsibilities and access level..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-3">
                Permissions can be configured after the role is created
              </p>
              <div className="text-xs text-gray-500">
                Available permissions will be displayed in the edit screen
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/company-admin/roles')}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Card>
    </CompanyAdminLayout>
  );
};

export default CreateRolePage;
