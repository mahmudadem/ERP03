import { useEffect, useState } from 'react';
import { superAdminPermissionsApi } from '../../../api/superAdmin/permissions';
import { Button } from '../../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminPanel,
} from '../components/SuperAdminPage';

const ModulePermissionsListPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await superAdminPermissionsApi.listModulesWithPermissions();
        setModules(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.modulePermissionsList.loading')} /></SuperAdminPage>;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.modulePermissionsList.title')}
        description="Configure the permission set attached to each system module."
        meta="Permissions"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((mod) => (
          <SuperAdminPanel key={mod.moduleId || mod.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-slate-950">{mod.moduleId || mod.id}</div>
              <div className="text-sm text-slate-500">{t('superAdmin.modulePermissionsList.permissionsCount', { count: (mod.permissions || []).length })}</div>
            </div>
            <Button onClick={() => navigate(`/super-admin/permissions/${mod.moduleId || mod.id}`)}>{t('superAdmin.modulePermissionsList.edit')}</Button>
          </SuperAdminPanel>
        ))}
      </div>
    </SuperAdminPage>
  );
};

export default ModulePermissionsListPage;
