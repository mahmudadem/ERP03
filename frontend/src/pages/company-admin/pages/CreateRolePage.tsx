import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCompanyRoles } from '../../../hooks/useCompanyAdmin';
import { useTranslation } from 'react-i18next';

export const CreateRolePage: React.FC = () => {
  const { t } = useTranslation('common');
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
        title={t('companyAdmin.roles.createTitle', { defaultValue: 'Create Role' })} 
        breadcrumbs={[
          { label: t('companyAdmin.shared.companyAdmin', { defaultValue: 'Company Admin' }) }, 
          { label: t('companyAdmin.shared.roles', { defaultValue: 'Roles' }), href: '/company-admin/roles' }, 
          { label: t('companyAdmin.shared.create', { defaultValue: 'Create' }) }
        ]}
      />

      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('companyAdmin.roles.roleNameRequired', { defaultValue: 'Role Name *' })}
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('companyAdmin.roles.roleNamePlaceholder', { defaultValue: 'e.g., Finance Manager' })}
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              {t('companyAdmin.roles.roleNameHint', { defaultValue: 'Choose a descriptive name for this role' })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('companyAdmin.roles.description', { defaultValue: 'Description' })}
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('companyAdmin.roles.descriptionPlaceholder', { defaultValue: `Describe the role's responsibilities and access level...` })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('companyAdmin.roles.permissions', { defaultValue: 'Permissions' })}
            </label>
            <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-3">
                {t('companyAdmin.roles.permissionsAfterCreate', { defaultValue: 'Permissions can be configured after the role is created' })}
              </p>
              <div className="text-xs text-gray-500">
                {t('companyAdmin.roles.permissionsShownInEdit', { defaultValue: 'Available permissions will be displayed in the edit screen' })}
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
              {t('companyAdmin.shared.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating
                ? t('companyAdmin.roles.creating', { defaultValue: 'Creating...' })
                : t('companyAdmin.roles.createRole', { defaultValue: 'Create Role' })}
            </Button>
          </div>
        </form>
      </Card>
    </CompanyAdminLayout>
  );
};

export default CreateRolePage;
