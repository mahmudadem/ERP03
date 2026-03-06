import React, { useState, useEffect } from 'react';
import { superAdminApi, Permission } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

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

  if (loading) return <div className="loading">{t('superAdmin.permissions.loading')}</div>;

  return (
    <div className="permissions-manager p-6">
      <div className="header mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('superAdmin.permissions.title')}</h1>
          <p className="text-gray-600 mt-2">{t('superAdmin.permissions.subtitle')}</p>
        </div>
        <button 
          onClick={handleCreate} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + {t('superAdmin.permissions.actions.createPermission')}
        </button>
      </div>

      <div className="permissions-list bg-white shadow rounded">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">{t('superAdmin.permissions.columns.id')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.permissions.columns.name')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.permissions.columns.description')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.permissions.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  {t('superAdmin.permissions.empty')}
                </td>
              </tr>
            ) : (
              permissions.map((permission) => (
                <tr key={permission.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">{permission.id}</td>
                  <td className="px-6 py-4 font-semibold">{permission.name}</td>
                  <td className="px-6 py-4 text-gray-600">{permission.description}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(permission)} className="text-blue-600 hover:underline mr-4">
                      {t('superAdmin.permissions.actions.edit')}
                    </button>
                    <button onClick={() => handleDelete(permission.id)} className="text-red-600 hover:underline">
                      {t('superAdmin.permissions.actions.delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {editingPermission ? t('superAdmin.permissions.modal.editTitle') : t('superAdmin.permissions.modal.createTitle')}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.permissions.fields.id')}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
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
                  className="w-full px-3 py-2 border rounded"
                  required
                  placeholder={t('superAdmin.permissions.placeholders.name')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.permissions.fields.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder={t('superAdmin.permissions.placeholders.description')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  {t('superAdmin.permissions.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingPermission ? t('superAdmin.permissions.actions.update') : t('superAdmin.permissions.actions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
