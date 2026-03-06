import { useState, useEffect } from 'react';
import { rbacApi, CompanyRole } from '../../../api/rbac';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

export default function RolesListPage() {
  const { t } = useTranslation('common');
  const { companyId } = useCompanyAccess();
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, [companyId]);

  const loadRoles = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await rbacApi.listCompanyRoles(companyId);
      setRoles(data);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm(t('rbac.rolesList.confirmDelete'))) return;
    
    try {
      await rbacApi.deleteCompanyRole(companyId, roleId);
      await loadRoles();
      errorHandler.showSuccess(t('rbac.rolesList.messages.deleted'));
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <div className="p-6">{t('rbac.rolesList.loading')}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('rbac.rolesList.title')}</h1>
        <button
          onClick={() => window.location.href = '/settings/rbac/roles/new'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('rbac.rolesList.actions.createRole')}
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('rbac.rolesList.columns.name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('rbac.rolesList.columns.description')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('rbac.rolesList.columns.permissions')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('rbac.rolesList.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles.map(role => (
              <tr key={role.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {role.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {role.description || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {t('rbac.rolesList.permissionsCount', { count: role.permissions.length })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => window.location.href = `/settings/rbac/roles/${role.id}`}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    {t('rbac.rolesList.actions.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    {t('rbac.rolesList.actions.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
