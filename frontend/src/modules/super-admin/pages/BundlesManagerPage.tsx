import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { superAdminApi, Bundle, BusinessDomain, Module } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';

export const BundlesManagerPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [businessDomains, setBusinessDomains] = useState<BusinessDomain[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    businessDomains: [] as string[],
    modulesIncluded: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bundlesRes, domainsRes, modulesRes]: any = await Promise.all([
        superAdminApi.getBundles(),
        superAdminApi.getBusinessDomains(),
        superAdminApi.getModules()
      ]);
      
      setBundles(bundlesRes.data || bundlesRes);
      setBusinessDomains(domainsRes.data || domainsRes);
      setModules(modulesRes.data || modulesRes);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBundle(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      businessDomains: [],
      modulesIncluded: []
    });
    setIsModalOpen(true);
  };

  const handleEdit = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setFormData({
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      businessDomains: bundle.businessDomains || [],
      modulesIncluded: bundle.modulesIncluded || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('superAdmin.bundles.confirmDelete', { defaultValue: 'Are you sure you want to delete this bundle?' }))) return;
    
    try {
      await superAdminApi.deleteBundle(id);
      errorHandler.showSuccess(t('superAdmin.bundles.messages.deleted', { defaultValue: 'Bundle deleted' }));
      loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      errorHandler.showError({
        code: 'VAL_001',
        message: t('superAdmin.bundles.messages.idNameRequired', { defaultValue: 'ID and Name are required' }),
        severity: 'WARNING'
      } as any);
      return;
    }

    try {
      if (editingBundle) {
        await superAdminApi.updateBundle(editingBundle.id, {
          name: formData.name,
          description: formData.description,
          businessDomains: formData.businessDomains,
          modulesIncluded: formData.modulesIncluded
        });
        errorHandler.showSuccess(t('superAdmin.bundles.messages.updated', { defaultValue: 'Bundle updated' }));
      } else {
        await superAdminApi.createBundle(formData);
        errorHandler.showSuccess(t('superAdmin.bundles.messages.created', { defaultValue: 'Bundle created' }));
      }
      
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const toggleSelection = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter(v => v !== value);
    } else {
      return [...array, value];
    }
  };

  if (loading) return <div className="loading">{t('superAdmin.bundles.loading', { defaultValue: 'Loading...' })}</div>;

  return (
    <div className="bundles-manager p-6">
      <div className="header mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('superAdmin.bundles.title', { defaultValue: 'Bundles Management' })}</h1>
          <p className="text-gray-600 mt-2">{t('superAdmin.bundles.subtitle', { defaultValue: 'Manage company module bundles with business domains' })}</p>
        </div>
        <button 
          onClick={handleCreate} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + {t('superAdmin.bundles.actions.create', { defaultValue: 'Create Bundle' })}
        </button>
      </div>

      <div className="bundles-list bg-white shadow rounded">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">{t('superAdmin.bundles.columns.id', { defaultValue: 'ID' })}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.bundles.columns.name', { defaultValue: 'Name' })}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.bundles.columns.businessDomains', { defaultValue: 'Business Domains' })}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.bundles.columns.modules', { defaultValue: 'Modules' })}</th>
              <th className="px-6 py-3 text-left">{t('superAdmin.bundles.columns.actions', { defaultValue: 'Actions' })}</th>
            </tr>
          </thead>
          <tbody>
            {bundles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {t('superAdmin.bundles.empty', { defaultValue: 'No bundles found. Create your first bundle to get started.' })}
                </td>
              </tr>
            ) : (
              bundles.map((bundle) => (
                <tr key={bundle.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">{bundle.id}</td>
                  <td className="px-6 py-4 font-semibold">{bundle.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {bundle.businessDomains?.map(d => (
                        <span key={d} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {bundle.modulesIncluded?.map(m => (
                        <span key={m} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(bundle)} className="text-blue-600 hover:underline mr-4">
                      {t('superAdmin.bundles.actions.edit', { defaultValue: 'Edit' })}
                    </button>
                    <button onClick={() => handleDelete(bundle.id)} className="text-red-600 hover:underline">
                      {t('superAdmin.bundles.actions.delete', { defaultValue: 'Delete' })}
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
          <div className="modal-content bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingBundle ? t('superAdmin.bundles.modal.editTitle', { defaultValue: 'Edit Bundle' }) : t('superAdmin.bundles.modal.createTitle', { defaultValue: 'Create Bundle' })}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.id', { defaultValue: 'ID *' })}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  disabled={!!editingBundle}
                  placeholder={t('superAdmin.bundles.placeholders.id', { defaultValue: 'e.g., standard-restaurant' })}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.name', { defaultValue: 'Name *' })}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  placeholder={t('superAdmin.bundles.placeholders.name', { defaultValue: 'e.g., Standard Restaurant Bundle' })}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.description', { defaultValue: 'Description' })}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder={t('superAdmin.bundles.placeholders.description', { defaultValue: 'Describe this bundle...' })}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.businessDomains', { defaultValue: 'Business Domains *' })}</label>
                <div className="border rounded p-3 max-h-48 overflow-y-auto">
                  {businessDomains.length === 0 ? (
                    <p className="text-gray-500 text-sm">{t('superAdmin.bundles.noBusinessDomains', { defaultValue: 'No business domains available. Create domains first.' })}</p>
                  ) : (
                    businessDomains.map(domain => (
                      <label key={domain.id} className="flex items-center mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.businessDomains.includes(domain.id)}
                          onChange={() => setFormData({
                            ...formData,
                            businessDomains: toggleSelection(formData.businessDomains, domain.id)
                          })}
                          className="mr-2"
                        />
                        <span className="font-medium">{domain.name}</span>
                        <span className="text-gray-500 text-sm ml-2">({domain.id})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.modulesIncluded', { defaultValue: 'Modules Included *' })}</label>
                <div className="border rounded p-3 max-h-48 overflow-y-auto">
                  {modules.length === 0 ? (
                    <p className="text-gray-500 text-sm">{t('superAdmin.bundles.noModules', { defaultValue: 'No modules available. Create modules first.' })}</p>
                  ) : (
                    modules.map(module => (
                      <label key={module.id} className="flex items-center mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.modulesIncluded.includes(module.id)}
                          onChange={() => setFormData({
                            ...formData,
                            modulesIncluded: toggleSelection(formData.modulesIncluded, module.id)
                          })}
                          className="mr-2"
                        />
                        <span className="font-medium">{module.name}</span>
                        <span className="text-gray-500 text-sm ml-2">({module.id})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  {t('superAdmin.bundles.actions.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingBundle ? t('superAdmin.bundles.actions.update', { defaultValue: 'Update' }) : t('superAdmin.bundles.actions.create', { defaultValue: 'Create' })}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
