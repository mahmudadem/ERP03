import React, { useState, useEffect } from 'react';
import { superAdminApi, Module } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

const PROTECTED_MODULES = ['finance', 'inventory', 'hr'];
const FORBIDDEN_IDS = ['core', 'companyAdmin'];

export const ModulesManagerPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', description: '' });

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const response: any = await superAdminApi.getModules();
      setModules(response.data || response);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingModule(null);
    setFormData({ id: '', name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (module: Module) => {
    setEditingModule(module);
    setFormData({ id: module.id, name: module.name, description: module.description });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (PROTECTED_MODULES.includes(id)) {
      errorHandler.showError({
        code: 'VAL_001',
        message: t('superAdmin.modules.errors.cannotDeleteProtected', { id }),
        severity: 'WARNING'
      } as any);
      return;
    }

    if (!confirm(t('superAdmin.modules.confirmDelete'))) return;
    
    try {
      await superAdminApi.deleteModule(id);
      errorHandler.showSuccess(t('superAdmin.modules.messages.deleted'));
      loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      errorHandler.showError({
        code: 'VAL_001',
        message: t('superAdmin.modules.messages.idNameRequired'),
        severity: 'WARNING'
      } as any);
      return;
    }

    if (FORBIDDEN_IDS.includes(formData.id)) {
      errorHandler.showError({
        code: 'VAL_001',
        message: t('superAdmin.modules.errors.cannotCreateReservedId', { id: formData.id }),
        severity: 'WARNING'
      } as any);
      return;
    }

    try {
      if (editingModule) {
        await superAdminApi.updateModule(editingModule.id, {
          name: formData.name,
          description: formData.description
        });
        errorHandler.showSuccess(t('superAdmin.modules.messages.updated'));
      } else {
        await superAdminApi.createModule(formData);
        errorHandler.showSuccess(t('superAdmin.modules.messages.created'));
      }
      
      setIsModalOpen(false);
      loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <div className="loading">{t('superAdmin.modules.loading')}</div>;

  return (
    <div className="modules-manager p-6">
      <div className="header mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('superAdmin.modules.title')}</h1>
          <p className="text-gray-600 mt-2">{t('superAdmin.modules.subtitle')}</p>
        </div>
        <button 
          onClick={handleCreate} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + {t('superAdmin.modules.actions.create')}
        </button>
      </div>

      <div className="modules-list bg-white shadow rounded">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">{t('superAdmin.modules.columns.id')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.modules.columns.name')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.modules.columns.description')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.modules.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  {t('superAdmin.modules.empty')}
                </td>
              </tr>
            ) : (
              modules.map((module) => (
                <tr key={module.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">
                    {module.id}
                    {PROTECTED_MODULES.includes(module.id) && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">{t('superAdmin.modules.protected')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold">{module.name}</td>
                  <td className="px-6 py-4 text-gray-600">{module.description}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(module)} className="text-blue-600 hover:underline mr-4">
                      {t('superAdmin.modules.actions.edit')}
                    </button>
                    {!PROTECTED_MODULES.includes(module.id) && (
                      <button onClick={() => handleDelete(module.id)} className="text-red-600 hover:underline">
                        {t('superAdmin.modules.actions.delete')}
                      </button>
                    )}
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
              {editingModule ? t('superAdmin.modules.modal.editTitle') : t('superAdmin.modules.modal.createTitle')}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.modules.fields.id')}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  disabled={!!editingModule}
                  placeholder={t('superAdmin.modules.placeholders.id')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('superAdmin.modules.reservedHint')}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.modules.fields.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  placeholder={t('superAdmin.modules.placeholders.name')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.modules.fields.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder={t('superAdmin.modules.placeholders.description')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  {t('superAdmin.modules.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingModule ? t('superAdmin.modules.actions.update') : t('superAdmin.modules.actions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
