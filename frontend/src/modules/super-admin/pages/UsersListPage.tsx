import { useEffect, useState } from 'react';
import { superAdminApi, SuperAdminUser } from '../../../api/superAdmin';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('superAdmin.users.title')}</h1>
        <Button variant="ghost" size="sm" onClick={loadUsers} disabled={loading} className="text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]">
          {loading ? t('superAdmin.users.refreshing') : t('superAdmin.users.refresh')}
        </Button>
      </div>

      <Card className="overflow-hidden bg-[var(--color-bg-primary)] border-[var(--color-border)]">
        {loading && users.length === 0 ? (
          <div className="p-6 text-[var(--color-text-muted)]">{t('superAdmin.users.loading')}</div>
        ) : (
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('superAdmin.users.columns.userId')}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('superAdmin.users.columns.email')}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('superAdmin.users.columns.globalRole')}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('superAdmin.users.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--color-bg-tertiary)]/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-primary)] font-mono">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.globalRole === 'SUPER_ADMIN'
                          ? 'bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-400'
                          : 'bg-primary-50 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                      }`}
                    >
                      {user.globalRole}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                  <td className="px-6 py-4 text-sm text-[var(--color-text-muted)] text-center italic" colSpan={4}>
                    {t('superAdmin.users.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
