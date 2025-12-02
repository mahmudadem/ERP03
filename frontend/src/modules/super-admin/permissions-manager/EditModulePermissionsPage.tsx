import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { superAdminPermissionsApi } from '../../../api/superAdmin/permissions';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const EditModulePermissionsPage: React.FC = () => {
  const { moduleId } = useParams();
  const [definition, setDefinition] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (moduleId) {
          const data = await superAdminPermissionsApi.getModulePermissions(moduleId);
          setDefinition(data || { moduleId, permissions: [], autoAttachToRoles: [] });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [moduleId]);

  const addPermission = () => {
    setDefinition((prev: any) => ({
      ...prev,
      permissions: [...(prev.permissions || []), { id: '', label: '', enabled: true }]
    }));
  };

  const save = async () => {
    if (!moduleId) return;
    await superAdminPermissionsApi.updateModulePermissions(moduleId, definition);
    alert('Saved');
  };

  if (loading || !definition) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit Permissions - {moduleId}</h1>
      <Card className="p-4 space-y-2">
        {(definition.permissions || []).map((perm: any, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              className="border rounded px-3 py-2 text-sm"
              placeholder="id"
              value={perm.id}
              onChange={(e) => {
                const v = e.target.value;
                setDefinition((prev: any) => {
                  const arr = [...prev.permissions];
                  arr[idx] = { ...arr[idx], id: v };
                  return { ...prev, permissions: arr };
                });
              }}
            />
            <input
              className="border rounded px-3 py-2 text-sm"
              placeholder="label"
              value={perm.label}
              onChange={(e) => {
                const v = e.target.value;
                setDefinition((prev: any) => {
                  const arr = [...prev.permissions];
                  arr[idx] = { ...arr[idx], label: v };
                  return { ...prev, permissions: arr };
                });
              }}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={perm.enabled !== false}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDefinition((prev: any) => {
                    const arr = [...prev.permissions];
                    arr[idx] = { ...arr[idx], enabled: v };
                    return { ...prev, permissions: arr };
                  });
                }}
              />
              Enabled
            </label>
          </div>
        ))}
        <Button variant="secondary" onClick={addPermission}>Add Permission</Button>
      </Card>
      <Card className="p-4 space-y-2">
        <div className="font-semibold">Auto attach to roles (comma separated)</div>
        <input
          className="border rounded px-3 py-2 text-sm w-full"
          value={(definition.autoAttachToRoles || []).join(',')}
          onChange={(e) =>
            setDefinition((prev: any) => ({
              ...prev,
              autoAttachToRoles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            }))
          }
        />
      </Card>
      <Button onClick={save}>Save</Button>
    </div>
  );
};

export default EditModulePermissionsPage;
