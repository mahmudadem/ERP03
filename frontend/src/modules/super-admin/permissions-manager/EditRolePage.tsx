import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { superAdminRolesApi } from '../../../api/superAdmin/roles';
import { superAdminPermissionsApi } from '../../../api/superAdmin/permissions';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const EditRolePage: React.FC = () => {
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
    await superAdminRolesApi.updateRole(roleId, {
      name: role.name,
      moduleBundles: role.moduleBundles || [],
      explicitPermissions: role.explicitPermissions || [],
    });
    alert('Saved');
  };

  if (loading || !role) return <div className="p-6">Loading...</div>;

  const resolvedPreview = new Set<string>(role.explicitPermissions || []);
  (role.moduleBundles || []).forEach((modId: string) => {
    const def = modules.find((m: any) => m.moduleId === modId || m.id === modId);
    (def?.permissions || []).forEach((p: any) => resolvedPreview.add(p.id));
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit Role</h1>
      <Card className="p-4 space-y-2">
        <label className="text-sm font-semibold">Name</label>
        <input
          className="border rounded px-3 py-2 text-sm"
          value={role.name}
          onChange={(e) => setRole((prev: any) => ({ ...prev, name: e.target.value }))}
        />
      </Card>

      <Card className="p-4 space-y-2">
        <div className="font-semibold">Module Bundles</div>
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
      </Card>

      <Card className="p-4 space-y-2">
        <div className="font-semibold">Explicit Permissions</div>
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
      </Card>

      <Card className="p-4 space-y-2">
        <div className="font-semibold">Resolved Preview (read-only)</div>
        <div className="text-xs text-gray-700">
          {Array.from(resolvedPreview).join(', ')}
        </div>
      </Card>

      <Button onClick={save}>Save</Button>
    </div>
  );
};

export default EditRolePage;
