import { useEffect, useState } from 'react';
import { superAdminApi, SuperAdminUser } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';

export default function UsersListPage() {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.getAllUsers();
      setUsers(data);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (userId: string) => {
    if (!window.confirm(t('superAdmin.users.confirmPromote'))) return;
    try {
      await superAdminApi.promoteUser(userId);
      errorHandler.showSuccess(t('superAdmin.users.messages.promoted'));
      loadUsers();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!window.confirm(t('superAdmin.users.confirmDemote'))) return;
    try {
      await superAdminApi.demoteUser(userId);
      errorHandler.showSuccess(t('superAdmin.users.messages.demoted'));
      loadUsers();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.users.title')}
        description="Promote or demote global accounts across the platform."
        meta="Access"
        actions={
        <Button variant="ghost" size="sm" onClick={loadUsers} disabled={loading} className="text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]">
          {loading ? t('superAdmin.users.refreshing') : t('superAdmin.users.refresh')}
        </Button>
        }
      />

      {loading && users.length === 0 ? (
        <SuperAdminLoading label={t('superAdmin.users.loading')} />
      ) : (
        <SuperAdminTable>
            <thead className="bg-slate-50">
              <tr>
                <th className={tableHeadCellClass}>{t('superAdmin.users.columns.userId')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.users.columns.email')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.users.columns.globalRole')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.users.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((user) => (
                <tr key={user.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono text-xs`}>{user.id}</td>
                  <td className={`${tableCellClass} font-medium text-slate-950`}>{user.email}</td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={user.globalRole === 'SUPER_ADMIN' ? 'red' : 'blue'}>{user.globalRole}</SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    {user.globalRole === 'SUPER_ADMIN' ? (
                      <Button variant="secondary" size="sm" onClick={() => handleDemote(user.id)} className="bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-primary)]">
                        {t('superAdmin.users.actions.demote')}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handlePromote(user.id)} className="bg-primary-600 hover:bg-primary-700 text-white shadow-sm">
                        {t('superAdmin.users.actions.promote')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={4}><SuperAdminEmptyState title={t('superAdmin.users.empty')} /></td>
                </tr>
              )}
            </tbody>
        </SuperAdminTable>
      )}
    </SuperAdminPage>
  );
}
