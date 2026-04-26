import React, { useState, useEffect } from 'react';
import { superAdminApi, Module } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminBadge,
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

  if (loading) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.modules.loading')} /></SuperAdminPage>;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.modules.title')}
        description={t('superAdmin.modules.subtitle')}
        meta="Registry"
        actions={
        <button 
          onClick={handleCreate} 
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t('superAdmin.modules.actions.create')}
        </button>
        }
      />

      <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeadCellClass}>{t('superAdmin.modules.columns.id')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.modules.columns.name')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.modules.columns.description')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.modules.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {modules.length === 0 ? (
              <tr>
                <td colSpan={4}><SuperAdminEmptyState title={t('superAdmin.modules.empty')} /></td>
              </tr>
            ) : (
              modules.map((module) => (
                <tr key={module.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono text-xs`}>
                    {module.id}
                    {PROTECTED_MODULES.includes(module.id) && (
                      <span className="ml-2"><SuperAdminBadge tone="amber">{t('superAdmin.modules.protected')}</SuperAdminBadge></span>
                    )}
                  </td>
                  <td className={`${tableCellClass} font-medium text-slate-950`}>{module.name}</td>
                  <td className={tableCellClass}>{module.description}</td>
                  <td className={tableCellClass}>
                    <button onClick={() => handleEdit(module)} className="mr-4 text-sm font-medium text-slate-700 hover:text-slate-950">
                      {t('superAdmin.modules.actions.edit')}
                    </button>
                    {!PROTECTED_MODULES.includes(module.id) && (
                      <button onClick={() => handleDelete(module.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                        {t('superAdmin.modules.actions.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
      </SuperAdminTable>

      {isModalOpen && (
        <SuperAdminModal
          title={editingModule ? t('superAdmin.modules.modal.editTitle') : t('superAdmin.modules.modal.createTitle')}
          onClose={() => setIsModalOpen(false)}
        >
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.modules.fields.id')}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                  placeholder={t('superAdmin.modules.placeholders.name')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.modules.fields.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder={t('superAdmin.modules.placeholders.description')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {t('superAdmin.modules.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  {editingModule ? t('superAdmin.modules.actions.update') : t('superAdmin.modules.actions.create')}
                </button>
              </div>
            </form>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};
