import React, { useEffect, useMemo, useState } from 'react';
import { superAdminApi, Module, ModuleAvailabilityReport } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminModal,
  SuperAdminPage,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';

type LifecycleStatus = Module['lifecycleStatus'];
type RuntimeStatus = Module['runtimeStatus'];

type ModuleRow = Module & {
  availabilityState: string;
  availabilityReason?: string;
  hasRouter?: boolean;
  codeVersion?: string;
  isCodeOnly?: boolean;
};

const PLATFORM_IDS = ['companyadmin', 'core', 'auth', 'rbac', 'settings', 'system'];
const FORBIDDEN_IDS = ['core', 'companyadmin', 'system'];

const lifecycleOptions: LifecycleStatus[] = ['draft', 'ready', 'deprecated', 'inactive'];
const runtimeOptions: RuntimeStatus[] = ['available', 'suspended'];

const unwrap = <T,>(response: any): T => (response?.data ?? response) as T;

const normalize = (value: string | undefined | null) => String(value || '').trim().toLowerCase();
const isPlatformModule = (value: string | undefined | null) => PLATFORM_IDS.includes(normalize(value));

const statusTone = (status: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  if (['available', 'ready', 'passed'].includes(status)) return 'green';
  if (['suspended', 'failed', 'db_only', 'version_mismatch'].includes(status)) return 'red';
  if (['draft', 'unchecked', 'implementation_unchecked', 'not_ready'].includes(status)) return 'amber';
  if (['code_only'].includes(status)) return 'blue';
  return 'slate';
};

const getModuleKey = (module: Module) => normalize(module.code || module.id);

const applyState = (
  rows: Map<string, ModuleRow>,
  modules: Module[] | undefined,
  state: string
) => {
  (modules || []).forEach((module) => {
    const key = getModuleKey(module);
    const current = rows.get(key);
    rows.set(key, {
      ...(current || module),
      ...module,
      availabilityState: state,
      availabilityReason: current?.availabilityReason,
      hasRouter: current?.hasRouter,
      codeVersion: current?.codeVersion,
      isCodeOnly: false,
    });
  });
};

const buildRows = (registryModules: Module[], report?: ModuleAvailabilityReport): ModuleRow[] => {
  const rows = new Map<string, ModuleRow>();

  registryModules.forEach((module) => {
    if (isPlatformModule(module.code || module.id)) return;

    rows.set(getModuleKey(module), {
      ...module,
      availabilityState: 'unknown',
      isCodeOnly: false,
    });
  });

  if (report) {
    applyState(rows, report.available, 'available');
    applyState(rows, report.dbOnly, 'db_only');
    applyState(rows, report.implementationFailed, 'implementation_failed');
    applyState(rows, report.notReady, 'not_ready');
    applyState(rows, report.implementationUnchecked, 'implementation_unchecked');
    applyState(rows, report.suspended, 'suspended');

    (report.versionMismatch || []).forEach((mismatch) => {
      const key = normalize(mismatch.moduleId);
      const current = rows.get(key);
      if (current) {
        rows.set(key, {
          ...current,
          availabilityState: 'version_mismatch',
          availabilityReason: `DB ${mismatch.dbVersion} does not match code ${mismatch.codeVersion}`,
          codeVersion: mismatch.codeVersion,
        });
      }
    });

    (report.codeOnly || []).forEach((entry) => {
      const key = normalize(entry.id);
      if (isPlatformModule(key)) return;

      rows.set(key, {
        id: entry.id,
        code: entry.id,
        name: entry.manifest.name || entry.id,
        description: entry.manifest.description || 'Implementation exists in code but has no DB registry record.',
        version: entry.manifest.version,
        lifecycleStatus: 'draft',
        runtimeStatus: 'available',
        implementationStatus: 'unchecked',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        availabilityState: 'code_only',
        availabilityReason: 'Implementation installed but not registered in DB',
        hasRouter: entry.hasRouter,
        codeVersion: entry.manifest.version,
        isCodeOnly: true,
      });
    });
  }

  return Array.from(rows.values()).sort((a, b) => getModuleKey(a).localeCompare(getModuleKey(b)));
};

export const ModulesManagerPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleRow | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    version: '1.0.0',
    releaseNotes: '',
    lifecycleStatus: 'draft' as LifecycleStatus,
    runtimeStatus: 'available' as RuntimeStatus,
    suspendReason: '',
  });

  useEffect(() => {
    loadModules();
  }, []);

  const stats = useMemo(() => ({
    dbOnly: modules.filter((module) => module.availabilityState === 'db_only').length,
    codeOnly: modules.filter((module) => module.availabilityState === 'code_only').length,
    mismatched: modules.filter((module) => module.availabilityState === 'version_mismatch').length,
    suspended: modules.filter((module) => module.availabilityState === 'suspended').length,
  }), [modules]);

  const loadModules = async () => {
    try {
      setLoading(true);
      const [modulesRes, availabilityRes] = await Promise.all([
        superAdminApi.getModules(),
        superAdminApi.getModuleAvailabilityReport(),
      ]);
      setModules(buildRows(unwrap<Module[]>(modulesRes), unwrap<ModuleAvailabilityReport>(availabilityRes)));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingModule(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      version: '1.0.0',
      releaseNotes: '',
      lifecycleStatus: 'draft',
      runtimeStatus: 'available',
      suspendReason: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (module: ModuleRow) => {
    setEditingModule(module);
    setFormData({
      id: module.code || module.id,
      name: module.name,
      description: module.description || '',
      version: module.version || '1.0.0',
      releaseNotes: module.releaseNotes || '',
      lifecycleStatus: module.lifecycleStatus || 'draft',
      runtimeStatus: module.runtimeStatus || 'available',
      suspendReason: '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this module registry record?')) return;

    try {
      await superAdminApi.deleteModule(id);
      errorHandler.showSuccess(t('superAdmin.modules.messages.deleted', { defaultValue: 'Module deleted' }));
      loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleCheckImplementation = async (id: string) => {
    try {
      setCheckingId(id);
      await superAdminApi.checkModuleImplementation(id);
      errorHandler.showSuccess('Implementation check completed');
      await loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setCheckingId(null);
    }
  };

  const handleRegisterCodeModule = async (module: ModuleRow) => {
    const moduleId = module.code || module.id;
    if (!confirm(`Register ${module.name} from code manifest? It will be created as draft and unchecked.`)) return;

    try {
      await superAdminApi.createModule({
        id: moduleId,
        name: module.name,
        description: module.description || '',
        version: module.codeVersion || module.version || '1.0.0',
        releaseNotes: 'Registered from code manifest',
      });
      errorHandler.showSuccess(`${module.name} registered as draft`);
      await loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const updateRuntimeStatus = async (module: ModuleRow, runtimeStatus: RuntimeStatus) => {
    const payload: { runtimeStatus: RuntimeStatus; suspendReason?: string } = { runtimeStatus };
    if (runtimeStatus === 'suspended') {
      const reason = window.prompt(`Why are you suspending ${module.name}?`);
      if (!reason?.trim()) return;
      payload.suspendReason = reason.trim();
    }

    try {
      await superAdminApi.updateModule(module.id, payload);
      errorHandler.showSuccess(runtimeStatus === 'suspended' ? 'Module suspended' : 'Module resumed');
      loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.id || !formData.name || !formData.version) {
      errorHandler.showError({
        code: 'VAL_001',
        message: 'ID, name, and version are required',
        severity: 'WARNING'
      } as any);
      return;
    }

    if (FORBIDDEN_IDS.includes(normalize(formData.id))) {
      errorHandler.showError({
        code: 'VAL_001',
        message: `Cannot create reserved module ID "${formData.id}"`,
        severity: 'WARNING'
      } as any);
      return;
    }

    if (
      editingModule &&
      editingModule.runtimeStatus !== 'suspended' &&
      formData.runtimeStatus === 'suspended' &&
      !formData.suspendReason.trim()
    ) {
      errorHandler.showError({
        code: 'VAL_001',
        message: 'Suspend reason is required',
        severity: 'WARNING'
      } as any);
      return;
    }

    try {
      if (editingModule) {
        await superAdminApi.updateModule(editingModule.id, {
          name: formData.name,
          description: formData.description,
          version: formData.version,
          releaseNotes: formData.releaseNotes,
          lifecycleStatus: formData.lifecycleStatus,
          runtimeStatus: formData.runtimeStatus,
          suspendReason: formData.suspendReason || undefined,
        });
        errorHandler.showSuccess(t('superAdmin.modules.messages.updated', { defaultValue: 'Module updated' }));
      } else {
        await superAdminApi.createModule({
          id: formData.id,
          name: formData.name,
          description: formData.description,
          version: formData.version,
          releaseNotes: formData.releaseNotes,
        });
        errorHandler.showSuccess(t('superAdmin.modules.messages.created', { defaultValue: 'Module created' }));
      }

      setIsModalOpen(false);
      loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) {
    return <SuperAdminPage><SuperAdminLoading label={t('superAdmin.modules.loading', { defaultValue: 'Loading modules' })} /></SuperAdminPage>;
  }

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.modules.title', { defaultValue: 'Modules Management' })}
        description="Registry, implementation status, and runtime controls for business modules."
        meta={`DB-only ${stats.dbOnly} | Code-only ${stats.codeOnly} | Version mismatch ${stats.mismatched} | Suspended ${stats.suspended}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadModules}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
            <button
              onClick={handleCreate}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + {t('superAdmin.modules.actions.create', { defaultValue: 'Create Module' })}
            </button>
          </div>
        }
      />

      <SuperAdminTable>
        <thead className="bg-slate-50">
          <tr>
            <th className={tableHeadCellClass}>Module</th>
            <th className={tableHeadCellClass}>Availability</th>
            <th className={tableHeadCellClass}>Lifecycle</th>
            <th className={tableHeadCellClass}>Runtime</th>
            <th className={tableHeadCellClass}>Implementation</th>
            <th className={tableHeadCellClass}>Version</th>
            <th className={tableHeadCellClass}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {modules.length === 0 ? (
            <tr>
              <td colSpan={7}><SuperAdminEmptyState title={t('superAdmin.modules.empty', { defaultValue: 'No modules found' })} /></td>
            </tr>
          ) : (
            modules.map((module) => {
              const moduleId = module.code || module.id;
              const canMutateRegistry = !module.isCodeOnly;
              return (
                <tr key={`${module.availabilityState}:${moduleId}`} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <div className="font-medium text-slate-950">{module.name}</div>
                    <div className="font-mono text-xs text-slate-500">{moduleId}</div>
                    {module.availabilityReason && (
                      <div className="mt-1 max-w-xs text-xs text-slate-500">{module.availabilityReason}</div>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={statusTone(module.availabilityState)}>{module.availabilityState}</SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={statusTone(module.lifecycleStatus)}>{module.lifecycleStatus}</SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={statusTone(module.runtimeStatus)}>{module.runtimeStatus}</SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex flex-col gap-1">
                      <SuperAdminBadge tone={statusTone(module.implementationStatus)}>{module.implementationStatus}</SuperAdminBadge>
                      {module.implementationError && (
                        <span className="max-w-xs text-xs text-red-600">{module.implementationError}</span>
                      )}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    {module.isCodeOnly ? (
                      <div className="font-mono text-xs text-blue-700">Code {module.codeVersion || module.version}</div>
                    ) : (
                      <div className="font-mono text-xs">DB {module.version}</div>
                    )}
                    {module.codeVersion && module.codeVersion !== module.version && (
                      <div className="font-mono text-xs text-red-600">Code {module.codeVersion}</div>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex flex-wrap gap-2">
                      {module.isCodeOnly && (
                        <button
                          onClick={() => handleRegisterCodeModule(module)}
                          className="text-sm font-medium text-blue-700 hover:text-blue-900"
                        >
                          Register
                        </button>
                      )}
                      {canMutateRegistry && (
                        <>
                          <button onClick={() => handleEdit(module)} className="text-sm font-medium text-slate-700 hover:text-slate-950">
                            Edit
                          </button>
                          <button
                            onClick={() => handleCheckImplementation(module.id)}
                            disabled={checkingId === module.id}
                            className="text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
                          >
                            {checkingId === module.id ? 'Checking...' : 'Check'}
                          </button>
                          {module.runtimeStatus === 'suspended' ? (
                            <button
                              onClick={() => updateRuntimeStatus(module, 'available')}
                              className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
                            >
                              Resume
                            </button>
                          ) : (
                            <button
                              onClick={() => updateRuntimeStatus(module, 'suspended')}
                              className="text-sm font-medium text-amber-700 hover:text-amber-900"
                            >
                              Suspend
                            </button>
                          )}
                          <button onClick={() => handleDelete(module.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </SuperAdminTable>

      {isModalOpen && (
        <SuperAdminModal
          title={editingModule ? 'Edit Module' : 'Create Module'}
          subtitle={editingModule ? 'Status changes are enforced by backend availability rules.' : 'New modules start as draft and unchecked.'}
          onClose={() => setIsModalOpen(false)}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">ID</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                  disabled={!!editingModule}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Version</label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Lifecycle</label>
                <select
                  value={formData.lifecycleStatus}
                  onChange={(e) => setFormData({ ...formData, lifecycleStatus: e.target.value as LifecycleStatus })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!editingModule}
                >
                  {lifecycleOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Runtime</label>
                <select
                  value={formData.runtimeStatus}
                  onChange={(e) => setFormData({ ...formData, runtimeStatus: e.target.value as RuntimeStatus })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!editingModule}
                >
                  {runtimeOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>

            {editingModule && editingModule.runtimeStatus !== 'suspended' && formData.runtimeStatus === 'suspended' && (
              <div>
                <label className="mb-2 block text-sm font-medium">Suspend reason</label>
                <textarea
                  value={formData.suspendReason}
                  onChange={(e) => setFormData({ ...formData, suspendReason: e.target.value })}
                  className="w-full rounded-md border border-amber-300 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Required for emergency suspend and audit trail"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">Release notes</label>
              <textarea
                value={formData.releaseNotes}
                onChange={(e) => setFormData({ ...formData, releaseNotes: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
              >
                {editingModule ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};
