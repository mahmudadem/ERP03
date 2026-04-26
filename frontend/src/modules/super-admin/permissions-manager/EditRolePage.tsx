import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { superAdminRolesApi } from '../../../api/superAdmin/roles';
import { superAdminPermissionsApi } from '../../../api/superAdmin/permissions';
import { Button } from '../../../components/ui/Button';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import { SuperAdminHeader, SuperAdminLoading, SuperAdminPage, SuperAdminPanel } from '../components/SuperAdminPage';

const EditRolePage: React.FC = () => {
  const { t } = useTranslation('common');
  const { roleId } = useParams();
  const [role, setRole] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (roleId) {
          const r = await superAdminRolesApi.getRole(roleId);
          setRole(r);
        }
        const mods = await superAdminPermissionsApi.listModulesWithPermissions();
        setModules(mods);
        const allPerms = mods.flatMap((m: any) => (m.permissions || []).map((p: any) => p.id));
        setPermissions(allPerms);
      } catch (error: any) {
        errorHandler.showError(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [roleId]);

  const toggleModule = (modId: string) => {
    setRole((prev: any) => {
      const bundles = new Set(prev.moduleBundles || []);
      if (bundles.has(modId)) bundles.delete(modId);
      else bundles.add(modId);
      return { ...prev, moduleBundles: Array.from(bundles) };
    });
  };

  const toggleExplicitPermission = (permId: string) => {
    setRole((prev: any) => {
      const perms = new Set(prev.explicitPermissions || []);
      if (perms.has(permId)) perms.delete(permId);
      else perms.add(permId);
      return { ...prev, explicitPermissions: Array.from(perms) };
    });
  };

  const save = async () => {
    if (!roleId) return;
    try {
      await superAdminRolesApi.updateRole(roleId, {
        name: role.name,
        moduleBundles: role.moduleBundles || [],
        explicitPermissions: role.explicitPermissions || [],
      });
      errorHandler.showSuccess('common:success.SAVE');
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading || !role) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.roleEditor.loading')} /></SuperAdminPage>;

  const resolvedPreview = new Set<string>(role.explicitPermissions || []);
  (role.moduleBundles || []).forEach((modId: string) => {
    const def = modules.find((m: any) => m.moduleId === modId || m.id === modId);
    (def?.permissions || []).forEach((p: any) => resolvedPreview.add(p.id));
  });

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.roleEditor.title')}
        description="Edit the modules and explicit permissions included in this system role template."
        meta={roleId || 'Role template'}
        actions={<Button onClick={save}>{t('superAdmin.roleEditor.save')}</Button>}
      />

      <SuperAdminPanel className="space-y-2 p-4">
        <label className="text-sm font-semibold">{t('superAdmin.roleEditor.name')}</label>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={role.name}
          onChange={(e) => setRole((prev: any) => ({ ...prev, name: e.target.value }))}
        />
      </SuperAdminPanel>

      <SuperAdminPanel className="space-y-3 p-4">
        <div className="font-semibold text-slate-950">{t('superAdmin.roleEditor.moduleBundles')}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {modules.map((m: any) => {
            const id = m.moduleId || m.id;
            const selected = (role.moduleBundles || []).includes(id);
            return (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected} onChange={() => toggleModule(id)} />
                {id}
              </label>
            );
          })}
        </div>
      </SuperAdminPanel>

      <SuperAdminPanel className="space-y-3 p-4">
        <div className="font-semibold text-slate-950">{t('superAdmin.roleEditor.explicitPermissions')}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {permissions.map((pid) => {
            const selected = (role.explicitPermissions || []).includes(pid);
            return (
              <label key={pid} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected} onChange={() => toggleExplicitPermission(pid)} />
                {pid}
              </label>
            );
          })}
        </div>
      </SuperAdminPanel>

      <SuperAdminPanel className="space-y-2 p-4">
        <div className="font-semibold text-slate-950">{t('superAdmin.roleEditor.resolvedPreview')}</div>
        <div className="text-xs leading-6 text-slate-700">
          {Array.from(resolvedPreview).join(', ')}
        </div>
      </SuperAdminPanel>
    </SuperAdminPage>
  );
};

export default EditRolePage;
