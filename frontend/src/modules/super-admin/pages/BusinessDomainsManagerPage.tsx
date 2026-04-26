import React, { useState, useEffect } from 'react';
import { superAdminApi, BusinessDomain } from '../../../api/superAdmin';
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

export const BusinessDomainsManagerPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [domains, setDomains] = useState<BusinessDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<BusinessDomain | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', description: '' });

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const response: any = await superAdminApi.getBusinessDomains();
      setDomains(response.data || response);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingDomain(null);
    setFormData({ id: '', name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (domain: BusinessDomain) => {
    setEditingDomain(domain);
    setFormData({ id: domain.id, name: domain.name, description: domain.description });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('superAdmin.businessDomains.confirmDelete'))) return;
    
    try {
      await superAdminApi.deleteBusinessDomain(id);
      errorHandler.showSuccess(t('superAdmin.businessDomains.messages.deleted'));
      loadDomains();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      errorHandler.showError({
        code: 'VAL_001',
        message: t('superAdmin.businessDomains.messages.idNameRequired'),
        severity: 'WARNING'
      } as any);
      return;
    }

    try {
      if (editingDomain) {
        await superAdminApi.updateBusinessDomain(editingDomain.id, {
          name: formData.name,
          description: formData.description
        });
        errorHandler.showSuccess(t('superAdmin.businessDomains.messages.updated'));
      } else {
        await superAdminApi.createBusinessDomain(formData);
        errorHandler.showSuccess(t('superAdmin.businessDomains.messages.created'));
      }
      
      setIsModalOpen(false);
      loadDomains();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.businessDomains.loading')} /></SuperAdminPage>;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.businessDomains.title')}
        description={t('superAdmin.businessDomains.subtitle')}
        meta="Catalog"
        actions={
        <button 
          onClick={handleCreate} 
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t('superAdmin.businessDomains.actions.createDomain')}
        </button>
        }
      />

      <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeadCellClass}>{t('superAdmin.businessDomains.columns.id')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.businessDomains.columns.name')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.businessDomains.columns.description')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.businessDomains.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {domains.length === 0 ? (
              <tr>
                <td colSpan={4}><SuperAdminEmptyState title={t('superAdmin.businessDomains.empty')} /></td>
              </tr>
            ) : (
              domains.map((domain) => (
                <tr key={domain.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono text-xs`}>{domain.id}</td>
                  <td className={`${tableCellClass} font-medium text-slate-950`}>{domain.name}</td>
                  <td className={tableCellClass}>{domain.description}</td>
                  <td className={tableCellClass}>
                    <button onClick={() => handleEdit(domain)} className="mr-4 text-sm font-medium text-slate-700 hover:text-slate-950">
                      {t('superAdmin.businessDomains.actions.edit')}
                    </button>
                    <button onClick={() => handleDelete(domain.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                      {t('superAdmin.businessDomains.actions.delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
      </SuperAdminTable>

      {isModalOpen && (
        <SuperAdminModal
          title={editingDomain ? t('superAdmin.businessDomains.modal.editTitle') : t('superAdmin.businessDomains.modal.createTitle')}
          onClose={() => setIsModalOpen(false)}
          footer={null}
        >
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.businessDomains.fields.id')}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                  disabled={!!editingDomain}
                  placeholder={t('superAdmin.businessDomains.placeholders.id')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.businessDomains.fields.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                  placeholder={t('superAdmin.businessDomains.placeholders.name')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.businessDomains.fields.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder={t('superAdmin.businessDomains.placeholders.description')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {t('superAdmin.businessDomains.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  {editingDomain ? t('superAdmin.businessDomains.actions.update') : t('superAdmin.businessDomains.actions.create')}
                </button>
              </div>
            </form>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};
