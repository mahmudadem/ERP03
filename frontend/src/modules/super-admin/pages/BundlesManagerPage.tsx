import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { superAdminApi, Bundle, BusinessDomain, Module } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { clsx } from 'clsx';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminModal,
  SuperAdminPage,
  SuperAdminSearchInput,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
  tableSortHeaderClass,
  SortIcon,
} from '../components/SuperAdminPage';
import { useSuperAdminTable } from '../hooks/useSuperAdminTable';

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
    modulesIncluded: [] as string[],
    lifecycleStatus: 'draft' as Bundle['lifecycleStatus']
  });

  useEffect(() => {
    loadData();
  }, []);

  const {
    data: filteredBundles,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: bundles,
    searchFields: ['name', 'id', 'description'],
    initialSort: { field: 'name', direction: 'asc' },
  });

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
      modulesIncluded: [],
      lifecycleStatus: 'draft'
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
      modulesIncluded: bundle.modulesIncluded || [],
      lifecycleStatus: bundle.lifecycleStatus || 'draft'
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
          modulesIncluded: formData.modulesIncluded,
          lifecycleStatus: formData.lifecycleStatus
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

  if (loading) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.bundles.loading', { defaultValue: 'Loading...' })} /></SuperAdminPage>;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.bundles.title', { defaultValue: 'Bundles Management' })}
        description={t('superAdmin.bundles.subtitle', { defaultValue: 'Manage company module bundles with business domains' })}
        meta="Company setup"
        actions={
        <button 
          onClick={handleCreate} 
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t('superAdmin.bundles.actions.create', { defaultValue: 'Create Bundle' })}
        </button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SuperAdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search bundles..."
          />
        </div>

        <SuperAdminTable>
            <thead className="bg-slate-50">
              <tr>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('id')}
                >
                  {t('superAdmin.bundles.columns.id', { defaultValue: 'ID' })}
                  <SortIcon direction={sortConfig.field === 'id' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('name')}
                >
                  {t('superAdmin.bundles.columns.name', { defaultValue: 'Name' })}
                  <SortIcon direction={sortConfig.field === 'name' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('lifecycleStatus')}
                >
                  Lifecycle
                  <SortIcon direction={sortConfig.field === 'lifecycleStatus' ? sortConfig.direction : null} />
                </th>
                <th className={tableHeadCellClass}>{t('superAdmin.bundles.columns.businessDomains', { defaultValue: 'Business Domains' })}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.bundles.columns.modules', { defaultValue: 'Modules' })}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.bundles.columns.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredBundles.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <SuperAdminEmptyState 
                      title={searchQuery ? "No bundles found matching search" : t('superAdmin.bundles.empty', { defaultValue: 'No bundles found. Create your first bundle to get started.' })} 
                    />
                  </td>
                </tr>
              ) : (
                filteredBundles.map((bundle) => (
                  <tr key={bundle.id} className={tableRowClass}>
                    <td className={`${tableCellClass} font-mono text-xs`}>{bundle.id}</td>
                    <td className={`${tableCellClass} font-medium text-slate-950`}>{bundle.name}</td>
                    <td className={tableCellClass}>
                      <SuperAdminBadge tone={bundle.lifecycleStatus === 'ready' ? 'green' : 'amber'}>
                        {bundle.lifecycleStatus || 'draft'}
                      </SuperAdminBadge>
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap gap-1">
                        {bundle.businessDomains?.map(domainId => {
                          const domain = businessDomains.find(d => d.id === domainId);
                          return (
                            <SuperAdminBadge key={domainId} tone="slate">
                              {domain?.name || domainId}
                            </SuperAdminBadge>
                          );
                        })}
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap gap-1">
                        {bundle.modulesIncluded?.map(m => (
                          <SuperAdminBadge key={m} tone="blue">{m}</SuperAdminBadge>
                        ))}
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <button onClick={() => handleEdit(bundle)} className="mr-4 text-sm font-medium text-slate-700 hover:text-slate-950">
                        {t('superAdmin.bundles.actions.edit', { defaultValue: 'Edit' })}
                      </button>
                      <button onClick={() => handleDelete(bundle.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                        {t('superAdmin.bundles.actions.delete', { defaultValue: 'Delete' })}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
        </SuperAdminTable>
      </div>

      {isModalOpen && (
        <SuperAdminModal
          title={editingBundle ? t('superAdmin.bundles.modal.editTitle', { defaultValue: 'Edit Bundle' }) : t('superAdmin.bundles.modal.createTitle', { defaultValue: 'Create Bundle' })}
          onClose={() => setIsModalOpen(false)}
          size="lg"
        >
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.id', { defaultValue: 'ID *' })}</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                  placeholder={t('superAdmin.bundles.placeholders.name', { defaultValue: 'e.g., Standard Restaurant Bundle' })}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.description', { defaultValue: 'Description' })}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder={t('superAdmin.bundles.placeholders.description', { defaultValue: 'Describe this bundle...' })}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Lifecycle Status *</label>
                <select
                  value={formData.lifecycleStatus}
                  onChange={(e) => setFormData({ ...formData, lifecycleStatus: e.target.value as Bundle['lifecycleStatus'] })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="draft">Draft - hidden from onboarding</option>
                  <option value="ready">Ready - visible in onboarding</option>
                  <option value="deprecated">Deprecated - hidden from onboarding</option>
                  <option value="inactive">Inactive - hidden from onboarding</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Only ready bundles are shown in the company onboarding wizard.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('superAdmin.bundles.fields.businessDomains', { defaultValue: 'Business Domains *' })}</label>
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 p-3">
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
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 p-3">
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
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {t('superAdmin.bundles.actions.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  {editingBundle ? t('superAdmin.bundles.actions.update', { defaultValue: 'Update' }) : t('superAdmin.bundles.actions.create', { defaultValue: 'Create' })}
                </button>
              </div>
            </form>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};
