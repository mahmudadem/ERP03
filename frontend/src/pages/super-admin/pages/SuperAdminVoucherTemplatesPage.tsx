import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { superAdminVoucherTypesApi } from '../../../api/superAdmin';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminSearchInput,
  SuperAdminStatCard,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
  tableSortHeaderClass,
  SortIcon,
} from '../../../modules/super-admin/components/SuperAdminPage';
import { useSuperAdminTable } from '../../../modules/super-admin/hooks/useSuperAdminTable';
import { useConfirm } from '../../../hooks/useConfirm';

export const SuperAdminVoucherTemplatesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [templates, setTemplates] = useState<VoucherTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { confirm, confirmDialog } = useConfirm();

  useEffect(() => {
    loadTemplates();
  }, []);

  const {
    data: filteredTemplates,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: templates,
    searchFields: ['name', 'code', 'module'],
    initialSort: { field: 'name', direction: 'asc' },
  });

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await superAdminVoucherTypesApi.list();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (template: VoucherTypeDefinition) => {
    if (!template.id) return;

    const confirmed = await confirm({
      title: t('superAdmin.voucherTemplates.actions.delete', { defaultValue: 'Delete' }),
      tone: 'danger',
      message: t('superAdmin.voucherTemplates.confirmDelete', {
        name: template.name,
        defaultValue: `Delete system template "${template.name}"?`
      })
    });
    if (!confirmed) return;

    try {
      setDeletingId(template.id);
      await superAdminVoucherTypesApi.delete(template.id);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete template', error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SuperAdminPage>
      {confirmDialog}
      <SuperAdminHeader
        title={t('superAdmin.voucherTemplates.title')}
        description="Maintain the official voucher templates copied into companies when modules are activated."
        meta="System metadata"
        actions={
          <Button onClick={() => navigate('new')} leftIcon={<Plus className="h-4 w-4" />}>
            {t('superAdmin.voucherTemplates.actions.createTemplate')}
          </Button>
        }
      />

      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SuperAdminStatCard label="Templates" value={templates.length} />
          <SuperAdminStatCard label="Modules" value={new Set(templates.map(t => t.module)).size} />
          <SuperAdminStatCard label="Line-enabled" value={templates.filter(t => t.isMultiLine !== false).length} />
        </div>
      )}

      {loading ? (
        <SuperAdminLoading label={t('superAdmin.voucherTemplates.loading')} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SuperAdminSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search templates..."
            />
          </div>

          <SuperAdminTable>
              <thead className="bg-slate-50">
                <tr>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('name')}
                  >
                    {t('superAdmin.voucherTemplates.columns.name')}
                    <SortIcon direction={sortConfig.field === 'name' ? sortConfig.direction : null} />
                  </th>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('code')}
                  >
                    {t('superAdmin.voucherTemplates.columns.code')}
                    <SortIcon direction={sortConfig.field === 'code' ? sortConfig.direction : null} />
                  </th>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('module')}
                  >
                    {t('superAdmin.voucherTemplates.columns.module')}
                    <SortIcon direction={sortConfig.field === 'module' ? sortConfig.direction : null} />
                  </th>
                  <th className={`${tableHeadCellClass} text-right`}>{t('superAdmin.voucherTemplates.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTemplates.map((template) => (
                  <tr key={template.id} className={tableRowClass}>
                    <td className={`${tableCellClass} font-medium text-slate-950`}>{template.name}</td>
                    <td className={`${tableCellClass} font-mono text-xs text-slate-600`}>{template.code}</td>
                    <td className={tableCellClass}><SuperAdminBadge tone="blue">{template.module}</SuperAdminBadge></td>
                    <td className={`${tableCellClass} text-right`}>
                      <button 
                        onClick={() => template.id && navigate(template.id)}
                        className="mr-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {t('superAdmin.voucherTemplates.actions.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        disabled={deletingId === template.id}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === template.id
                          ? t('superAdmin.voucherTemplates.actions.deleting', { defaultValue: 'Deleting...' })
                          : t('superAdmin.voucherTemplates.actions.delete', { defaultValue: 'Delete' })}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTemplates.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <SuperAdminEmptyState 
                        title={searchQuery ? "No templates found matching your search" : t('superAdmin.voucherTemplates.empty')} 
                      />
                    </td>
                  </tr>
                )}
              </tbody>
          </SuperAdminTable>
        </div>
      )}
    </SuperAdminPage>
  );
};
