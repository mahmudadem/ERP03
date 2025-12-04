
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Role } from '../../../types/company-admin';

const t = (key: string) => key;

// Mock Data
const MOCK_ROLES: Role[] = [
  { id: '1', name: 'Admin', description: 'Full access to all modules', permissionsCount: 45, createdAt: '2023-01-15' },
  { id: '2', name: 'Manager', description: 'Departmental management access', permissionsCount: 22, createdAt: '2023-02-20' },
  { id: '3', name: 'User', description: 'Standard user access', permissionsCount: 5, createdAt: '2023-03-10' },
];

export const RolesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.roles.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Roles' }]}
        action={
          <Button onClick={() => navigate('/company-admin/roles/create')}>
            + {t("companyAdmin.roles.create")}
          </Button>
        }
      />

      <Card className="p-4 mb-6">
        <div className="flex gap-4">
           <div className="flex-1">
             <Input placeholder="Search roles..." />
           </div>
        </div>
      </Card>

      {MOCK_ROLES.length === 0 ? (
        <EmptyState 
           title="No roles found" 
           description="Get started by creating a new role for your users."
           action={<Button onClick={() => navigate('/company-admin/roles/create')}>{t("companyAdmin.roles.create")}</Button>}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("companyAdmin.roles.name")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("companyAdmin.roles.description")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t("companyAdmin.roles.permissions")}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {MOCK_ROLES.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{role.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{role.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{role.permissionsCount}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-4" onClick={() => navigate(`/company-admin/roles/${role.id}`)}>
                      {t("companyAdmin.roles.edit")}
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      {t("companyAdmin.roles.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CompanyAdminLayout>
  );
};

export default RolesPage;
