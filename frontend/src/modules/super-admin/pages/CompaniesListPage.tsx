import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi, SuperAdminCompany } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { errorHandler } from '../../../services/errorHandler';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
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

export default function CompaniesListPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<SuperAdminCompany[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const {
    data: filteredCompanies,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: companies,
    searchFields: ['name', 'id', 'ownerUid'],
    initialSort: { field: 'name', direction: 'asc' },
  });

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.getAllCompanies();
      setCompanies(data);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (companyId: string) => {
    if (!window.confirm(t('superAdmin.companies.confirmImpersonate'))) return;
    try {
      await superAdminApi.startImpersonation(companyId);
      errorHandler.showSuccess(t('superAdmin.companies.messages.impersonationStarted'));
      window.location.href = '/';
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.companies.title')}
        description="Review company tenants and enter an owned company context when needed."
        meta="Tenants"
        actions={
        <Button variant="ghost" size="sm" onClick={loadCompanies} disabled={loading}>
          {loading ? t('superAdmin.companies.refreshing') : t('superAdmin.companies.refresh')}
        </Button>
        }
      />

      {loading && companies.length === 0 ? (
        <SuperAdminLoading label={t('superAdmin.companies.loading')} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SuperAdminSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search companies..."
            />
          </div>

          <SuperAdminTable>
            <thead className="bg-slate-50">
              <tr>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('id')}
                >
                  {t('superAdmin.companies.columns.companyId')}
                  <SortIcon direction={sortConfig.field === 'id' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('name')}
                >
                  {t('superAdmin.companies.columns.name')}
                  <SortIcon direction={sortConfig.field === 'name' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('ownerUid')}
                >
                  {t('superAdmin.companies.columns.ownerUid')}
                  <SortIcon direction={sortConfig.field === 'ownerUid' ? sortConfig.direction : null} />
                </th>
                <th 
                  className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                  onClick={() => handleSort('createdAt')}
                >
                  {t('superAdmin.companies.columns.created')}
                  <SortIcon direction={sortConfig.field === 'createdAt' ? sortConfig.direction : null} />
                </th>
                <th className={tableHeadCellClass}>{t('superAdmin.companies.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredCompanies.map((company) => (
                <tr key={company.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono text-xs text-slate-600`}>{company.id}</td>
                  <td className={`${tableCellClass} font-medium text-slate-950`}>{company.name}</td>
                  <td className={`${tableCellClass} font-mono text-xs text-slate-600`}>{company.ownerUid}</td>
                  <td className={`${tableCellClass} text-slate-500`}>
                    {company.createdAt ? formatCompanyDate(company.createdAt, null) : '-'}
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleImpersonate(company.id)}>
                        {t('superAdmin.companies.actions.impersonate')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/super-admin/companies/${company.id}/entitlements`)}>
                        {t('superAdmin.companies.actions.manageModules', { defaultValue: 'Modules' })}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <SuperAdminEmptyState title={searchQuery ? "No companies found" : t('superAdmin.companies.empty')} />
                  </td>
                </tr>
              )}
            </tbody>
          </SuperAdminTable>
        </div>
      )}
    </SuperAdminPage>
  );
}
