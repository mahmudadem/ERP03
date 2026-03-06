import React, { useState, useEffect } from 'react';
import { superAdminApi, BusinessDomain } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

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

  if (loading) return <div className="loading">{t('superAdmin.businessDomains.loading')}</div>;

  return (
    <div className="business-domains-manager p-6">
      <div className="header mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('superAdmin.businessDomains.title')}</h1>
          <p className="text-gray-600 mt-2">{t('superAdmin.businessDomains.subtitle')}</p>
        </div>
        <button 
          onClick={handleCreate} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + {t('superAdmin.businessDomains.actions.createDomain')}
        </button>
      </div>

      <div className="domains-list bg-white shadow rounded">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">{t('superAdmin.businessDomains.columns.id')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.businessDomains.columns.name')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.businessDomains.columns.description')}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.businessDomains.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  {t('superAdmin.businessDomains.empty')}
                </td>
              </tr>
            ) : (
              domains.map((domain) => (
                <tr key={domain.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">{domain.id}</td>
                  <td className="px-6 py-4 font-semibold">{domain.name}</td>
                  <td className="px-6 py-4 text-gray-600">{domain.description}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(domain)} className="text-blue-600 hover:underline mr-4">
                      {t('superAdmin.businessDomains.actions.edit')}
                    </button>
                    <button onClick={() => handleDelete(domain.id)} className="text-red-600 hover:underline">
                      {t('superAdmin.businessDomains.actions.delete')}
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
              {editingDomain ? t('superAdmin.businessDomains.modal.editTitle') : t('superAdmin.businessDomains.modal.createTitle')}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.businessDomains.fields.id')}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
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
                  className="w-full px-3 py-2 border rounded"
                  required
                  placeholder={t('superAdmin.businessDomains.placeholders.name')}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.businessDomains.fields.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder={t('superAdmin.businessDomains.placeholders.description')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  {t('superAdmin.businessDomains.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingDomain ? t('superAdmin.businessDomains.actions.update') : t('superAdmin.businessDomains.actions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
