
import { useEffect, useState } from 'react';
import { superAdminApi, SystemOverview } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminPanel,
  SuperAdminStatCard,
} from '../components/SuperAdminPage';
import { Building2, FileText, Package, Shield, Users } from 'lucide-react';

export default function SystemOverviewPage() {
  const { t } = useTranslation('common');
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.getSystemOverview();
      setOverview(data);
    } catch (error) {
      console.error('Failed to load system overview', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: t('superAdmin.systemOverview.stats.totalUsers'), value: overview?.totalUsers ?? 0, icon: Users },
    { label: t('superAdmin.systemOverview.stats.totalCompanies'), value: overview?.totalCompanies ?? 0, icon: Building2 },
    { label: t('superAdmin.systemOverview.stats.totalVouchers'), value: overview?.totalVouchers ?? 0, icon: FileText },
    { label: t('superAdmin.systemOverview.stats.inventoryItems'), value: overview?.totalInventoryItems ?? 0, icon: Package },
    { label: t('superAdmin.systemOverview.stats.roles'), value: overview?.totalRoles ?? 0, icon: Shield },
  ];

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.systemOverview.title')}
        description={t('superAdmin.systemOverview.subtitle')}
        meta="System"
        actions={
        <Button variant="ghost" size="sm" onClick={loadOverview} disabled={loading}>
          {loading ? t('superAdmin.systemOverview.refreshing') : t('superAdmin.systemOverview.refresh')}
        </Button>
        }
      />

      {loading && !overview && (
        <SuperAdminLoading label={t('superAdmin.systemOverview.loading')} />
      )}

      {overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <SuperAdminStatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
          ))}
        </div>
      )}

      {!loading && !overview && (
        <SuperAdminPanel>
          <SuperAdminEmptyState title={t('superAdmin.systemOverview.noData')} />
        </SuperAdminPanel>
      )}

      <SuperAdminPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{t('superAdmin.systemOverview.quickActionsTitle')}</h2>
            <p className="text-sm text-slate-500">{t('superAdmin.systemOverview.quickActionsSubtitle')}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => (window.location.href = '/#/super-admin/users')}>{t('superAdmin.systemOverview.actions.manageUsers')}</Button>
            <Button variant="secondary" onClick={() => (window.location.href = '/#/super-admin/companies')}>{t('superAdmin.systemOverview.actions.manageCompanies')}</Button>
          </div>
        </div>
      </SuperAdminPanel>
    </SuperAdminPage>
  );
}
