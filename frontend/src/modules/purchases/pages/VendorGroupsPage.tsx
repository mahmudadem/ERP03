import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ChevronLeft, Edit3, Plus, Save, Search, Store, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { purchasesApi, VendorGroupDTO } from '../../../api/purchasesApi';

interface EditorProps {
  initial: VendorGroupDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

type FormState = {
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const Editor: React.FC<EditorProps> = ({ initial, onClose, onSaved }) => {
  const { t } = useTranslation(['purchases', 'common']);
  const [form, setForm] = useState<FormState>(() => ({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'ACTIVE',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(t('vendorGroups.validation.nameRequired', 'Group name is required.'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Partial<VendorGroupDTO> = {
        name: form.name,
        description: form.description || null,
        status: form.status,
      };
      if (initial) {
        await purchasesApi.updateVendorGroup(initial.id, payload);
        toast.success(t('vendorGroups.messages.updated', 'Vendor group updated'));
      } else {
        await purchasesApi.createVendorGroup(payload);
        toast.success(t('vendorGroups.messages.created', 'Vendor group created'));
      }
      onSaved();
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? t('vendorGroups.messages.saveFailed', 'Save failed');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex-none border-b bg-white p-6 shadow-sm dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="rounded-xl bg-emerald-600 p-3 text-white shadow-lg shadow-emerald-100 dark:shadow-none">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {initial
                  ? t('vendorGroups.editTitle', 'Edit Vendor Group')
                  : t('vendorGroups.newTitle', 'New Vendor Group')}
              </h1>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                {t('vendorGroups.subtitle', 'Supplier segmentation')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X size={14} /> {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <Card className="overflow-hidden border-slate-200 p-0 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:shadow-none">
            <div className="border-b bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {t('vendorGroups.details', 'Group details')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">
                  {t('vendorGroups.fields.name', 'Name')}
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder={t('vendorGroups.placeholders.name', 'e.g. Local Suppliers')}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">
                  {t('vendorGroups.fields.description', 'Description')}
                </label>
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder={t('vendorGroups.placeholders.description', 'Optional notes about this supplier segment')}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">
                  {t('vendorGroups.fields.status', 'Status')}
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                >
                  <option value="ACTIVE">{t('common.active', 'Active')}</option>
                  <option value="INACTIVE">{t('common.inactive', 'Inactive')}</option>
                </select>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const VendorGroupsPage: React.FC = () => {
  const { t } = useTranslation(['purchases', 'common']);
  const [groups, setGroups] = useState<VendorGroupDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VendorGroupDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const result = await purchasesApi.listVendorGroups({ includeInactive: true });
      setGroups(result ?? []);
    } catch (err: any) {
      const message = err?.response?.data?.message ?? t('vendorGroups.messages.loadFailed', 'Failed to load vendor groups');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleSaved = () => {
    setEditingId(null);
    setIsAdding(false);
    void load();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await purchasesApi.deleteVendorGroup(pendingDelete.id);
      toast.success(t('vendorGroups.messages.deleted', 'Vendor group deleted'));
      setPendingDelete(null);
      await load();
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? t('vendorGroups.messages.deleteFailed', 'Delete failed');
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const editingGroup = useMemo(
    () => editingId ? (groups.find((group) => group.id === editingId) ?? null) : null,
    [editingId, groups]
  );

  if (editingId || isAdding) {
    return (
      <Editor
        initial={editingGroup}
        onClose={() => { setEditingId(null); setIsAdding(false); }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <div className="relative z-10 flex-none border-b bg-white p-6 shadow-sm dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-emerald-600 p-3 text-white shadow-lg shadow-emerald-100 dark:shadow-none">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {t('vendorGroups.title', 'Vendor Groups')}
              </h1>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                {t('vendorGroups.listSubtitle', 'Reporting and filtering segments')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-emerald-700"
          >
            <Plus size={16} /> {t('vendorGroups.actions.new', 'New Group')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <Card className="overflow-hidden border-slate-200 p-0 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:shadow-none">
            <div className="flex items-center justify-between border-b bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <Search size={14} /> {t('vendorGroups.directory', 'Group directory')}
              </div>
              {loading && (
                <div className="animate-pulse text-[10px] font-black uppercase tracking-tighter text-emerald-500">
                  {t('common.loading', 'Loading...')}
                </div>
              )}
            </div>

            <div className="p-6">
              {groups.length === 0 && !loading ? (
                <div className="space-y-4 py-20 text-center">
                  <div className="inline-flex rounded-full bg-slate-50 p-6 text-slate-300 dark:bg-slate-800">
                    <Store size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      {t('vendorGroups.emptyTitle', 'No Vendor Groups')}
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400">
                      {t('vendorGroups.emptyHelp', 'Create your first vendor group to segment suppliers for filtering and reporting.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="group flex items-center justify-between border-b border-slate-50 py-3 transition-all hover:bg-slate-50/50 dark:border-slate-800/50 dark:hover:bg-slate-900/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-400">
                          <Store size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{group.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {group.description || t('vendorGroups.noDescription', 'No description')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
                          group.status === 'ACTIVE'
                            ? 'border-green-200 bg-green-50 text-green-600'
                            : 'border-slate-200 bg-slate-50 text-slate-400'
                        )}>
                          {group.status === 'ACTIVE' ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                        </div>
                        <button
                          onClick={() => setEditingId(group.id)}
                          className="rounded-full p-2 text-slate-400 opacity-0 transition-all hover:bg-emerald-50 hover:text-emerald-600 group-hover:opacity-100 dark:hover:bg-emerald-900/20"
                          title={t('common.edit', 'Edit')}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setPendingDelete(group)}
                          className="rounded-full p-2 text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-900/20"
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={t('vendorGroups.confirmDeleteTitle', 'Delete vendor group?')}
        message={t('vendorGroups.confirmDeleteMessage',
          'This removes the vendor group only if no vendors still reference it.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        isConfirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  );
};

export default VendorGroupsPage;
