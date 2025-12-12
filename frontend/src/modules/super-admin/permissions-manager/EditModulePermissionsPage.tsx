import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { superAdminPermissionsApi } from '../../../api/superAdmin/permissions';
import { superAdminApi, Permission } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { ChevronRight, GripVertical, Search, Trash2 } from 'lucide-react';

const EditModulePermissionsPage: React.FC = () => {
  const { moduleId } = useParams();
  const [definition, setDefinition] = useState<any>(null);
  const [registryPermissions, setRegistryPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggingPermission, setDraggingPermission] = useState<Permission | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [permDef, registry] = await Promise.all([
          moduleId ? superAdminPermissionsApi.getModulePermissions(moduleId) : null,
          superAdminApi.getPermissions()
        ]);
        
        setDefinition(permDef || { moduleId, permissions: [], autoAttachToRoles: [] });
        setRegistryPermissions(registry || []);
      } catch (err) {
        console.error(err);
        alert('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [moduleId]);

  // Derived state: Available permissions (Registry - Assigned)
  const assignedIds = new Set((definition?.permissions || []).map((p: any) => p.id));
  const availablePermissions = registryPermissions.filter(p => !assignedIds.has(p.id));

  // Filtered Source List
  const filteredAvailable = availablePermissions.filter(p => 
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Grouping Logic
  const groupedAvailable = filteredAvailable.reduce((acc, perm) => {
    const prefix = perm.id.includes('.') ? perm.id.split('.')[0] : 'general';
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleDragStart = (e: React.DragEvent, perm: Permission) => {
    setDraggingPermission(perm);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', JSON.stringify(perm));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingPermission) return;
    addPermission(draggingPermission);
    setDraggingPermission(null);
  };

  const addPermission = (perm: Permission) => {
    setDefinition((prev: any) => ({
      ...prev,
      permissions: [
        ...(prev.permissions || []),
        { id: perm.id, label: perm.name, enabled: true } // Map Registry format to Module format
      ]
    }));
  };

  const removePermission = (id: string) => {
    setDefinition((prev: any) => ({
      ...prev,
      permissions: prev.permissions.filter((p: any) => p.id !== id)
    }));
  };

  const save = async () => {
    if (!moduleId) return;
    await superAdminPermissionsApi.updateModulePermissions(moduleId, definition);
    alert('Saved successfully!');
  };

  if (loading || !definition) return <div className="p-8 text-center text-gray-500">Loading editor...</div>;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Manage Module Permissions</h1>
          <p className="text-gray-500">Module: <span className="font-mono text-blue-600">{moduleId}</span></p>
        </div>
        <Button onClick={save} className="bg-green-600 hover:bg-green-700">Save Changes</Button>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* LEFT: Source (Registry) */}
        <div className="bg-white rounded-lg shadow border flex flex-col min-h-0">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-700 mb-2">Available Permissions (Registry)</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input 
                className="w-full pl-9 pr-4 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scroll">
            {Object.entries(groupedAvailable).map(([group, perms]) => (
              <div key={group}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{group}</h3>
                <div className="space-y-2">
                  {perms.map(perm => (
                    <div 
                      key={perm.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, perm)}
                      onClick={() => addPermission(perm)}
                      className="group flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded hover:border-blue-300 hover:bg-blue-50 cursor-grab active:cursor-grabbing transition-all"
                    >
                      <div>
                        <div className="font-medium text-sm text-gray-800">{perm.name}</div>
                        <div className="font-mono text-xs text-gray-500">{perm.id}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                    </div>
                  ))}
                  {perms.length === 0 && <div className="text-sm text-gray-400 italic">No matches</div>}
                </div>
              </div>
            ))}
            {Object.keys(groupedAvailable).length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No available permissions found in Registry.
                <br />
                <span className="text-xs">Go to Permissions Registry to create new ones.</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Target (Module) */}
        <div className="bg-white rounded-lg shadow border flex flex-col min-h-0">
          <div className="p-4 border-b bg-blue-50/50">
            <h2 className="font-semibold text-gray-700">Assigned Permissions</h2>
            <p className="text-xs text-gray-500 mt-1">Drag items here from the left</p>
          </div>
          
          <div 
            className="flex-1 overflow-y-auto p-4 custom-scroll relative"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleDrop}
          >
            {definition.permissions && definition.permissions.length > 0 ? (
              <div className="space-y-2">
                {definition.permissions.map((perm: any) => (
                  <div key={perm.id} className="flex items-center gap-3 p-3 bg-white border rounded shadow-sm group">
                    <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{perm.label || perm.id}</div>
                      <div className="font-mono text-xs text-gray-500">{perm.id}</div>
                    </div>
                    <button 
                      onClick={() => removePermission(perm.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                <p>Drag permissions here</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50 space-y-2">
             <div className="font-semibold text-sm text-gray-700">Auto-attach to Global Roles:</div>
             <input
               className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
               placeholder="e.g. OWNER, ADMIN (comma separated)"
               value={(definition.autoAttachToRoles || []).join(', ')}
               onChange={(e) =>
                 setDefinition((prev: any) => ({
                   ...prev,
                   autoAttachToRoles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                 }))
               }
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditModulePermissionsPage;
