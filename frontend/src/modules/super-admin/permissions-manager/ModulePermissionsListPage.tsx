import { useEffect, useState } from 'react';
import { superAdminPermissionsApi } from '../../../api/superAdmin/permissions';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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

  if (loading) return <div className="p-6">{t('superAdmin.modulePermissionsList.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('superAdmin.modulePermissionsList.title')}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((mod) => (
          <Card key={mod.moduleId || mod.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-semibold">{mod.moduleId || mod.id}</div>
              <div className="text-sm text-gray-500">{t('superAdmin.modulePermissionsList.permissionsCount', { count: (mod.permissions || []).length })}</div>
            </div>
            <Button onClick={() => navigate(`/super-admin/permissions/${mod.moduleId || mod.id}`)}>{t('superAdmin.modulePermissionsList.edit')}</Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ModulePermissionsListPage;
