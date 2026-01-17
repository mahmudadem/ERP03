import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { useCompanyRoles } from '../../../hooks/useCompanyAdmin';
import { Edit2, Trash2, Shield, Search } from 'lucide-react';

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
        title="Role Management" 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Roles' }]}
        action={
          <Button onClick={() => navigate('/company-admin/roles/new')}>
            + Create New Role
          </Button>
        }
      />

      <Card className="p-4 mb-6">
        <div className="flex gap-4 items-center">
           <div className="flex-1 relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <Input 
               placeholder="Search roles..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-10"
             />
           </div>
           <div className="text-sm text-gray-500">
             {filteredRoles.length} roles found
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
           action={!searchTerm ? <Button onClick={() => navigate('/company-admin/roles/new')}>Create Role</Button> : undefined}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${role.isSystem ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                        <Shield size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{role.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {role.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {role.permissions?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {role.isSystem ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        System
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1" 
                        onClick={() => navigate(`/company-admin/roles/${role.id}`)}
                        title="Edit Role"
                      >
                        <Edit2 size={18} />
                      </button>
                      {!role.isSystem && (
                        <button 
                          className="text-gray-400 hover:text-red-600 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => handleDelete(role.id, role.name)}
                          disabled={isDeleting && deletingRoleId === role.id}
                          title="Delete Role"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
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
