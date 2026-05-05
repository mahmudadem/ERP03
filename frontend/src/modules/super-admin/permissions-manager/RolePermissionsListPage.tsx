import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { superAdminRolesApi } from '../../../api/superAdmin/roles';
import { Button } from '../../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { errorHandler } from '../../../services/errorHandler';
import { clsx } from 'clsx';
import {
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminModal,
  SuperAdminPage,
  SuperAdminPanel,
  SuperAdminSearchInput,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
  tableSortHeaderClass,
  SortIcon,
} from '../components/SuperAdminPage';
import { useSuperAdminTable } from '../hooks/useSuperAdminTable';

const RolePermissionsListPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRole, setNewRole] = useState({ id: '', name: '', description: '' });
  const navigate = useNavigate();

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await superAdminRolesApi.listRoles();
      setRoles(data);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const {
    data: filteredRoles,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: roles,
    searchFields: ['name', 'id'],
    initialSort: { field: 'name', direction: 'asc' },
  });

  const handleCreate = async () => {
    try {
      await superAdminRolesApi.createRole(newRole);
      setShowCreateModal(false);
      setNewRole({ id: '', name: '', description: '' });
      errorHandler.showSuccess(t('superAdmin.roleTemplates.messages.created', { defaultValue: 'Role template created successfully' }));
      await loadRoles();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading && roles.length === 0) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.roleTemplates.loading', { defaultValue: 'Loading...' })} /></SuperAdminPage>;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.roleTemplates.title', { defaultValue: 'System Role Templates' })}
        description={t('superAdmin.roleTemplates.subtitle', { defaultValue: 'Manage system-wide role templates' })}
        meta="Permissions"
        actions={
        <Button onClick={() => setShowCreateModal(true)}>
          + {t('superAdmin.roleTemplates.actions.createRoleTemplate', { defaultValue: 'Create Role Template' })}
        </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SuperAdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('superAdmin.roleTemplates.searchPlaceholder', { defaultValue: 'Search roles...' })}
          />
        </div>

        {roles.length === 0 && !loading ? (
          <SuperAdminPanel>
            <SuperAdminEmptyState title={t('superAdmin.roleTemplates.empty', { defaultValue: 'No role templates found. Create your first role template to get started.' })} />
          </SuperAdminPanel>
        ) : (
          <SuperAdminTable>
              <thead className="bg-slate-50">
                <tr>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('name')}
                  >
                    {t('superAdmin.roleTemplates.columns.roleName', { defaultValue: 'Role Name' })}
                    <SortIcon direction={sortConfig.field === 'name' ? sortConfig.direction : null} />
                  </th>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('permissions.length')}
                  >
                    {t('superAdmin.roleTemplates.columns.permissions', { defaultValue: 'Permissions' })}
                    <SortIcon direction={sortConfig.field === 'permissions.length' ? sortConfig.direction : null} />
                  </th>
                  <th className={`${tableHeadCellClass} text-right`}>{t('superAdmin.roleTemplates.columns.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className={tableRowClass}>
                    <td className={`${tableCellClass} font-medium text-slate-950`}>{role.name}</td>
                    <td className={tableCellClass}>
                      {(role.permissions || []).length} {t('superAdmin.roleTemplates.permissionsCount', { defaultValue: 'permissions' })}
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      <Button onClick={() => navigate(`/super-admin/roles/${role.id}`)}>{t('superAdmin.roleTemplates.actions.edit', { defaultValue: 'Edit' })}</Button>
                    </td>
                  </tr>
                ))}
                {filteredRoles.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      <SuperAdminEmptyState title={searchQuery ? "No roles found matching search" : t('superAdmin.roleTemplates.empty')} />
                    </td>
                  </tr>
                )}
              </tbody>
          </SuperAdminTable>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <SuperAdminModal
          title={t('superAdmin.roleTemplates.modal.title', { defaultValue: 'Create Role Template' })}
          onClose={() => {
            setShowCreateModal(false);
            setNewRole({ id: '', name: '', description: '' });
          }}
        >
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('superAdmin.roleTemplates.fields.id', { defaultValue: 'ID' })}</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 outline-none"
                  value={newRole.id}
                  onChange={(e) => setNewRole({ ...newRole, id: e.target.value })}
                  placeholder={t('superAdmin.roleTemplates.placeholders.id', { defaultValue: 'e.g., template_manager' })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('superAdmin.roleTemplates.fields.name', { defaultValue: 'Name' })}</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 outline-none"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  placeholder={t('superAdmin.roleTemplates.placeholders.name', { defaultValue: 'e.g., Manager' })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('superAdmin.roleTemplates.fields.description', { defaultValue: 'Description' })}</label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 outline-none"
                  rows={3}
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  placeholder={t('superAdmin.roleTemplates.placeholders.description', { defaultValue: 'Describe this role template...' })}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="secondary" onClick={() => {
                  setShowCreateModal(false);
                  setNewRole({ id: '', name: '', description: '' });
                }}>
                  {t('superAdmin.roleTemplates.actions.cancel', { defaultValue: 'Cancel' })}
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={!newRole.id || !newRole.name}
                >
                  {t('superAdmin.roleTemplates.actions.create', { defaultValue: 'Create' })}
                </Button>
              </div>
            </div>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};

export default RolePermissionsListPage;
