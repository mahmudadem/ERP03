import { useEffect, useState } from 'react';
import { superAdminApi, SuperAdminUser } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  SuperAdminBadge,
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
import { useConfirm } from '../../../hooks/useConfirm';

export default function UsersListPage() {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  useEffect(() => {
    loadUsers();
  }, []);

  const {
    data: filteredUsers,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: users,
    searchFields: ['email', 'id'],
    initialSort: { field: 'email', direction: 'asc' },
  });

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
    const ok = await confirm({
      title: t('superAdmin.users.confirmPromoteTitle', { defaultValue: 'Promote to Super Admin?' }),
      message: t('superAdmin.users.confirmPromote'),
      tone: 'warning',
    });
    if (!ok) return;
    try {
      await superAdminApi.promoteUser(userId);
      errorHandler.showSuccess(t('superAdmin.users.messages.promoted'));
      loadUsers();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleDemote = async (userId: string) => {
    const ok = await confirm({
      title: t('superAdmin.users.confirmDemoteTitle', { defaultValue: 'Demote Super Admin?' }),
      message: t('superAdmin.users.confirmDemote'),
      tone: 'danger',
    });
    if (!ok) return;
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
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SuperAdminSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search users..."
            />
          </div>

          <SuperAdminTable>
              <thead className="bg-slate-50">
                <tr>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('id')}
                  >
                    {t('superAdmin.users.columns.userId')}
                    <SortIcon direction={sortConfig.field === 'id' ? sortConfig.direction : null} />
                  </th>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('email')}
                  >
                    {t('superAdmin.users.columns.email')}
                    <SortIcon direction={sortConfig.field === 'email' ? sortConfig.direction : null} />
                  </th>
                  <th 
                    className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                    onClick={() => handleSort('globalRole')}
                  >
                    {t('superAdmin.users.columns.globalRole')}
                    <SortIcon direction={sortConfig.field === 'globalRole' ? sortConfig.direction : null} />
                  </th>
                  <th className={tableHeadCellClass}>{t('superAdmin.users.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((user) => (
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
                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4}>
                      <SuperAdminEmptyState 
                        title={searchQuery ? "No users found matching search" : t('superAdmin.users.empty')} 
                      />
                    </td>
                  </tr>
                )}
              </tbody>
          </SuperAdminTable>
        </div>
      )}
      {confirmDialog}
    </SuperAdminPage>
  );
}
