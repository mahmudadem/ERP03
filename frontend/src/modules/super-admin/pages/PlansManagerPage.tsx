import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { superAdminApi, Plan } from '../../../api/superAdmin';
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

export const PlansManagerPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    price: 0,
    status: 'active' as 'active' | 'inactive' | 'deprecated',
    limits: {
      maxCompanies: 1,
      maxUsersPerCompany: 10,
      maxModulesAllowed: 5,
      maxStorageMB: 1000,
      maxTransactionsPerMonth: 1000
    }
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const {
    data: filteredPlans,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: plans,
    searchFields: ['name', 'id', 'description'],
    initialSort: { field: 'name', direction: 'asc' },
  });

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response: any = await superAdminApi.getPlans();
      setPlans(response.data || response);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      price: 0,
      status: 'active',
      limits: {
        maxCompanies: 1,
        maxUsersPerCompany: 10,
        maxModulesAllowed: 5,
        maxStorageMB: 1000,
        maxTransactionsPerMonth: 1000
      }
    });
    setIsModalOpen(true);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      status: plan.status,
      limits: { ...plan.limits }
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('superAdmin.plans.confirmDelete', { defaultValue: 'Are you sure you want to delete this plan?' }))) return;
    
    try {
      await superAdminApi.deletePlan(id);
      errorHandler.showSuccess(t('superAdmin.plans.messages.deleted', { defaultValue: 'Plan deleted' }));
      loadPlans();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      errorHandler.showError({
        code: 'VAL_001',
        message: t('superAdmin.plans.messages.idNameRequired', { defaultValue: 'ID and Name are required' }),
        severity: 'WARNING'
      } as any);
      return;
    }

    try {
      if (editingPlan) {
        await superAdminApi.updatePlan(editingPlan.id, {
          name: formData.name,
          description: formData.description,
          price: formData.price,
          status: formData.status,
          limits: formData.limits
        });
        errorHandler.showSuccess(t('superAdmin.plans.messages.updated', { defaultValue: 'Plan updated' }));
      } else {
        await superAdminApi.createPlan(formData);
        errorHandler.showSuccess(t('superAdmin.plans.messages.created', { defaultValue: 'Plan created' }));
      }
      
      setIsModalOpen(false);
      loadPlans();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.plans.loading', { defaultValue: 'Loading...' })} /></SuperAdminPage>;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.plans.title', { defaultValue: 'Plans Management' })}
        description={`${t('superAdmin.plans.subtitle', { defaultValue: 'Manage user subscription plans (account signup tiers)' })}. ${t('superAdmin.plans.note', { defaultValue: 'Note: Plans are for user signup, Bundles are for company creation' })}`}
        meta="Commercial"
        actions={
        <button 
          onClick={handleCreate} 
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t('superAdmin.plans.actions.create', { defaultValue: 'Create Plan' })}
        </button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SuperAdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search plans..."
          />
        </div>

        <SuperAdminTable>
            <thead className="bg-slate-50">
              <tr>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('id')}
                >
                  {t('superAdmin.plans.columns.id', { defaultValue: 'ID' })}
                  <SortIcon direction={sortConfig.field === 'id' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('name')}
                >
                  {t('superAdmin.plans.columns.name', { defaultValue: 'Name' })}
                  <SortIcon direction={sortConfig.field === 'name' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('price')}
                >
                  {t('superAdmin.plans.columns.price', { defaultValue: 'Price' })}
                  <SortIcon direction={sortConfig.field === 'price' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('status')}
                >
                  {t('superAdmin.plans.columns.status', { defaultValue: 'Status' })}
                  <SortIcon direction={sortConfig.field === 'status' ? sortConfig.direction : null} />
                </th>
                <th className={tableHeadCellClass}>{t('superAdmin.plans.columns.limits', { defaultValue: 'Limits' })}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.plans.columns.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <SuperAdminEmptyState 
                      title={searchQuery ? "No plans found matching search" : t('superAdmin.plans.empty', { defaultValue: 'No plans found. Create your first plan to get started.' })} 
                    />
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => (
                  <tr key={plan.id} className={tableRowClass}>
                    <td className={`${tableCellClass} font-mono text-xs`}>{plan.id}</td>
                    <td className={`${tableCellClass} font-medium text-slate-950`}>{plan.name}</td>
                    <td className={tableCellClass}>${plan.price}/{t('superAdmin.plans.perMonth', { defaultValue: 'mo' })}</td>
                    <td className={tableCellClass}>
                      <SuperAdminBadge tone={plan.status === 'active' ? 'green' : plan.status === 'inactive' ? 'slate' : 'red'}>
                        {plan.status}
                      </SuperAdminBadge>
                    </td>
                    <td className={`${tableCellClass} text-xs text-slate-600`}>
                      <div>{plan.limits.maxCompanies} {t('superAdmin.plans.limits.companies', { defaultValue: 'companies' })}</div>
                      <div>{plan.limits.maxUsersPerCompany} {t('superAdmin.plans.limits.usersPerCompany', { defaultValue: 'users/company' })}</div>
                      <div>{plan.limits.maxModulesAllowed} {t('superAdmin.plans.limits.modules', { defaultValue: 'modules' })}</div>
                    </td>
                    <td className={tableCellClass}>
                      <button onClick={() => handleEdit(plan)} className="mr-4 text-sm font-medium text-slate-700 hover:text-slate-950">
                        {t('superAdmin.plans.actions.edit', { defaultValue: 'Edit' })}
                      </button>
                      <button onClick={() => handleDelete(plan.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                        {t('superAdmin.plans.actions.delete', { defaultValue: 'Delete' })}
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
          title={editingPlan ? t('superAdmin.plans.modal.editTitle', { defaultValue: 'Edit Plan' }) : t('superAdmin.plans.modal.createTitle', { defaultValue: 'Create Plan' })}
          onClose={() => setIsModalOpen(false)}
          size="lg"
        >
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.id', { defaultValue: 'ID *' })}</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                    disabled={!!editingPlan}
                    placeholder={t('superAdmin.plans.placeholders.id', { defaultValue: 'e.g., free-tier' })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.name', { defaultValue: 'Name *' })}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                    placeholder={t('superAdmin.plans.placeholders.name', { defaultValue: 'e.g., Free Tier' })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.description', { defaultValue: 'Description' })}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                    placeholder={t('superAdmin.plans.placeholders.description', { defaultValue: 'Describe this plan...' })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.price', { defaultValue: 'Price (USD/month) *' })}</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.status', { defaultValue: 'Status *' })}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="active">{t('superAdmin.plans.status.active', { defaultValue: 'Active' })}</option>
                    <option value="inactive">{t('superAdmin.plans.status.inactive', { defaultValue: 'Inactive' })}</option>
                    <option value="deprecated">{t('superAdmin.plans.status.deprecated', { defaultValue: 'Deprecated' })}</option>
                  </select>
                </div>

                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-semibold mb-3">{t('superAdmin.plans.fields.limits', { defaultValue: 'Plan Limits' })}</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.maxCompanies', { defaultValue: 'Max Companies' })}</label>
                      <input
                        type="number"
                        value={formData.limits.maxCompanies}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxCompanies: parseInt(e.target.value) }
                        })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.maxUsersPerCompany', { defaultValue: 'Max Users per Company' })}</label>
                      <input
                        type="number"
                        value={formData.limits.maxUsersPerCompany}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxUsersPerCompany: parseInt(e.target.value) }
                        })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.maxModulesAllowed', { defaultValue: 'Max Modules Allowed' })}</label>
                      <input
                        type="number"
                        value={formData.limits.maxModulesAllowed}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxModulesAllowed: parseInt(e.target.value) }
                        })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.maxStorageMB', { defaultValue: 'Max Storage (MB)' })}</label>
                      <input
                        type="number"
                        value={formData.limits.maxStorageMB}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxStorageMB: parseInt(e.target.value) }
                        })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                        min="100"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">{t('superAdmin.plans.fields.maxTransactionsPerMonth', { defaultValue: 'Max Transactions per Month' })}</label>
                      <input
                        type="number"
                        value={formData.limits.maxTransactionsPerMonth}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxTransactionsPerMonth: parseInt(e.target.value) }
                        })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                        min="100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {t('superAdmin.plans.actions.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  {editingPlan ? t('superAdmin.plans.actions.update', { defaultValue: 'Update' }) : t('superAdmin.plans.actions.create', { defaultValue: 'Create' })}
                </button>
              </div>
            </form>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};
