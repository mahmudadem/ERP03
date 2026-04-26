import { useEffect, useState } from 'react';
import { superAdminApi, SuperAdminCompany } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { errorHandler } from '../../../services/errorHandler';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';

export default function CompaniesListPage() {
  const { t } = useTranslation('common');
  const [companies, setCompanies] = useState<SuperAdminCompany[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

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
        <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeadCellClass}>{t('superAdmin.companies.columns.companyId')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.companies.columns.name')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.companies.columns.ownerUid')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.companies.columns.created')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.companies.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {companies.map((company) => (
              <tr key={company.id} className={tableRowClass}>
                <td className={`${tableCellClass} font-mono text-xs text-slate-600`}>{company.id}</td>
                <td className={`${tableCellClass} font-medium text-slate-950`}>{company.name}</td>
                <td className={`${tableCellClass} font-mono text-xs text-slate-600`}>{company.ownerUid}</td>
                <td className={`${tableCellClass} text-slate-500`}>
                  {company.createdAt ? formatCompanyDate(company.createdAt, null) : '-'}
                </td>
                <td className={tableCellClass}>
                  <Button variant="secondary" size="sm" onClick={() => handleImpersonate(company.id)}>
                    {t('superAdmin.companies.actions.impersonate')}
                  </Button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && !loading && (
              <tr>
                <td colSpan={5}>
                  <SuperAdminEmptyState title={t('superAdmin.companies.empty')} />
                </td>
              </tr>
            )}
          </tbody>
        </SuperAdminTable>
      )}
    </SuperAdminPage>
  );
}
