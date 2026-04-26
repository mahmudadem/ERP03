import React, { useState, useEffect } from 'react';
import { superAdminApi, Permission } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminModal,
  SuperAdminPage,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';

export const PermissionsManagerPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', description: '' });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const response: any = await superAdminApi.getPermissions();
      setPermissions(response.data || response);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPermission(null);
    setFormData({ id: '', name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (permission: Permission) => {
    setEditingPermission(permission);
    setFormData({ id: permission.id, name: permission.name, description: permission.description });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('superAdmin.permissions.confirmDelete'))) return;
    
    try {
      await superAdminApi.deletePermission(id);
      errorHandler.showSuccess(t('superAdmin.permissions.messages.deleted'));
      loadPermissions();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      errorHandler.showError({
        code: 'VAL_001',
        message: t('superAdmin.permissions.messages.idNameRequired'),
        severity: 'WARNING'
      } as any);
      return;
    }

    try {
      if (editingPermission) {
        await superAdminApi.updatePermission(editingPermission.id, {
          name: formData.name,
          description: formData.description
        });
        errorHandler.showSuccess(t('superAdmin.permissions.messages.updated'));
      } else {
        await superAdminApi.createPermission(formData);
        errorHandler.showSuccess(t('superAdmin.permissions.messages.created'));
      }
      
      setIsModalOpen(false);
      loadPermissions();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.permissions.loading')} /></SuperAdminPage>;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.permissions.title')}
        description={t('superAdmin.permissions.subtitle')}
        meta="Registry"
        actions={
        <button 
          onClick={handleCreate} 
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t('superAdmin.permissions.actions.createPermission')}
        </button>
        }
      />

      <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeadCellClass}>{t('superAdmin.permissions.columns.id')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.permissions.columns.name')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.permissions.columns.description')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.permissions.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={4}><SuperAdminEmptyState title={t('superAdmin.permissions.empty')} /></td>
              </tr>
            ) : (
              permissions.map((permission) => (
                <tr key={permission.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono text-xs`}>{permission.id}</td>
                  <td className={`${tableCellClass} font-medium text-slate-950`}>{permission.name}</td>
                  <td className={tableCellClass}>{permission.description}</td>
                  <td className={tableCellClass}>
                    <button onClick={() => handleEdit(permission)} className="mr-4 text-sm font-medium text-slate-700 hover:text-slate-950">
                      {t('superAdmin.permissions.actions.edit')}
                    </button>
                    <button onClick={() => handleDelete(permission.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                      {t('superAdmin.permissions.actions.delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
      </SuperAdminTable>

      {isModalOpen && (
        <SuperAdminModal
          title={editingPermission ? t('superAdmin.permissions.modal.editTitle') : t('superAdmin.permissions.modal.createTitle')}
          onClose={() => setIsModalOpen(false)}
        >
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.permissions.fields.id')}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                  disabled={!!editingPermission}
                  placeholder={t('superAdmin.permissions.placeholders.id')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.permissions.fields.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                  placeholder={t('superAdmin.permissions.placeholders.name')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.permissions.fields.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder={t('superAdmin.permissions.placeholders.description')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {t('superAdmin.permissions.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  {editingPermission ? t('superAdmin.permissions.actions.update') : t('superAdmin.permissions.actions.create')}
                </button>
              </div>
            </form>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};
