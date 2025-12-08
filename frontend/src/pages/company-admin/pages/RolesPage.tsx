import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { useCompanyRoles } from '../../../hooks/useCompanyAdmin';

const t = (key: string) => key;

export const RolesPage: React.FC = () => {
  const navigate = useNavigate();
  const { roles, isLoading, deleteRole, isDeleting } = useCompanyRoles();
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (roleId: string, roleName: string) => {
    if (window.confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
      setDeletingRoleId(roleId);
      deleteRole(roleId, {
        onSettled: () => setDeletingRoleId(null)
      });
    }
  };

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
             <Input 
               placeholder="Search roles..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRoles.length === 0 ? (
        <EmptyState 
           title={searchTerm ? "No roles match your search" : "No roles found"} 
           description={searchTerm ? "Try adjusting your search terms" : "Get started by creating a new role for your users."}
           action={!searchTerm ? <Button onClick={() => navigate('/company-admin/roles/create')}>{t("companyAdmin.roles.create")}</Button> : undefined}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("companyAdmin.roles.name")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("companyAdmin.roles.description")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t("companyAdmin.roles.permissions")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">System Role</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{role.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{role.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {role.permissions?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    {role.isSystem ? (
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">System</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      className="text-blue-600 hover:text-blue-900 mr-4" 
                      onClick={() => navigate(`/company-admin/roles/${role.id}`)}
                    >
                      {t("companyAdmin.roles.edit")}
                    </button>
                    {!role.isSystem && (
                      <button 
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleDelete(role.id, role.name)}
                        disabled={isDeleting && deletingRoleId === role.id}
                      >
                        {isDeleting && deletingRoleId === role.id ? 'Deleting...' : t("companyAdmin.roles.delete")}
                      </button>
                    )}
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
