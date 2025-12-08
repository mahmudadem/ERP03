import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCompanyRole, useCompanyRoles } from '../../../hooks/useCompanyAdmin';

const t = (key: string) => key;

export const EditRolePage: React.FC = () => {
  const navigate = useNavigate();
  const { roleId } = useParams<{ roleId: string }>();
  const { data: role, isLoading } = useCompanyRole(roleId!);
  const { updateRole, isUpdating } = useCompanyRoles();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions || [],
      });
    }
  }, [role]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId) return;
    
    updateRole({ roleId, data: formData }, {
      onSuccess: () => {
        navigate('/company-admin/roles');
      }
    });
  };

  if (isLoading) {
    return (
      <CompanyAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CompanyAdminLayout>
    );
  }

  if (!role) {
    return (
      <CompanyAdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Role not found</p>
          <Button onClick={() => navigate('/company-admin/roles')}>
            Back to Roles
          </Button>
        </div>
      </CompanyAdminLayout>
    );
  }

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={`Edit ${role.name}`} 
        breadcrumbs={[
          { label: 'Company Admin' }, 
          { label: 'Roles', href: '/company-admin/roles' }, 
          { label: 'Edit' }
        ]}
      />

      {role.isSystem && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ This is a system role. Some fields cannot be modified.
          </p>
        </div>
      )}

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
              disabled={role.isSystem}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role's responsibilities..."
              disabled={role.isSystem}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions ({formData.permissions.length})
            </label>
            <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
              {formData.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {formData.permissions.map((permission, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No permissions assigned</p>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Permission management will be available in a future update
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/company-admin/roles')}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating || role.isSystem}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </CompanyAdminLayout>
  );
};

export default EditRolePage;
