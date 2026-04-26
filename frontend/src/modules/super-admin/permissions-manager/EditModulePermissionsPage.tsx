import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { superAdminPermissionsApi } from '../../../api/superAdmin/permissions';
import { superAdminApi, Permission } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { ChevronRight, GripVertical, Search, Trash2 } from 'lucide-react';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import { SuperAdminHeader, SuperAdminLoading, SuperAdminPage, SuperAdminPanel } from '../components/SuperAdminPage';

const EditModulePermissionsPage: React.FC = () => {
  const { t } = useTranslation('common');
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
      } catch (err: any) {
        errorHandler.showError(err);
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
    try {
      await superAdminPermissionsApi.updateModulePermissions(moduleId, definition);
      errorHandler.showSuccess('common:success.SAVE');
    } catch (err: any) {
      errorHandler.showError(err);
    }
  };

  if (loading || !definition) return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.modulePermissionsEditor.loading')} /></SuperAdminPage>;

  return (
    <SuperAdminPage className="h-[calc(100vh-4rem)]">
      <SuperAdminHeader
        title={t('superAdmin.modulePermissionsEditor.title')}
        description={<>{t('superAdmin.modulePermissionsEditor.moduleLabel')}: <span className="font-mono text-slate-700">{moduleId}</span></>}
        meta="Module permissions"
        actions={<Button onClick={save}>{t('superAdmin.modulePermissionsEditor.actions.saveChanges')}</Button>}
      />

      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* LEFT: Source (Registry) */}
        <SuperAdminPanel className="flex min-h-0 flex-col">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-2 font-semibold text-slate-800">{t('superAdmin.modulePermissionsEditor.availablePermissions')}</h2>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input 
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-4 text-sm outline-none focus:border-slate-500"
                placeholder={t('superAdmin.modulePermissionsEditor.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scroll">
            {Object.entries(groupedAvailable).map(([group, perms]) => (
              <div key={group}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</h3>
                <div className="space-y-2">
                  {perms.map(perm => (
                    <div 
                      key={perm.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, perm)}
                      onClick={() => addPermission(perm)}
                      className="group flex cursor-grab items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-slate-300 hover:bg-white active:cursor-grabbing"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900">{perm.name}</div>
                        <div className="font-mono text-xs text-slate-500">{perm.id}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                    </div>
                  ))}
                  {perms.length === 0 && <div className="text-sm text-gray-400 italic">{t('superAdmin.modulePermissionsEditor.noMatches')}</div>}
                </div>
              </div>
            ))}
            {Object.keys(groupedAvailable).length === 0 && (
              <div className="text-center py-8 text-gray-400">
                {t('superAdmin.modulePermissionsEditor.noAvailablePermissions')}
                <br />
                <span className="text-xs">{t('superAdmin.modulePermissionsEditor.goToPermissionsRegistry')}</span>
              </div>
            )}
          </div>
        </SuperAdminPanel>

        {/* RIGHT: Target (Module) */}
        <SuperAdminPanel className="flex min-h-0 flex-col">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <h2 className="font-semibold text-slate-800">{t('superAdmin.modulePermissionsEditor.assignedPermissions')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('superAdmin.modulePermissionsEditor.dragHint')}</p>
          </div>
          
          <div 
            className="flex-1 overflow-y-auto p-4 custom-scroll relative"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleDrop}
          >
            {definition.permissions && definition.permissions.length > 0 ? (
              <div className="space-y-2">
                {definition.permissions.map((perm: any) => (
                  <div key={perm.id} className="group flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{perm.label || perm.id}</div>
                      <div className="font-mono text-xs text-slate-500">{perm.id}</div>
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
                <p>{t('superAdmin.modulePermissionsEditor.dragPermissionsHere')}</p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-4">
             <div className="text-sm font-semibold text-slate-700">{t('superAdmin.modulePermissionsEditor.autoAttach')}</div>
             <input
               className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500"
               placeholder={t('superAdmin.modulePermissionsEditor.autoAttachPlaceholder')}
               value={(definition.autoAttachToRoles || []).join(', ')}
               onChange={(e) =>
                 setDefinition((prev: any) => ({
                   ...prev,
                   autoAttachToRoles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                 }))
               }
             />
          </div>
        </SuperAdminPanel>
      </div>
    </SuperAdminPage>
  );
};

export default EditModulePermissionsPage;
