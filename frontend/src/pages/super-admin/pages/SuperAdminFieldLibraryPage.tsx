/**
 * SuperAdminFieldLibraryPage.tsx
 *
 * Phase B of task 135 — super-admin editor for the Layer 1 field
 * catalog. Lists every entry seeded into `system_metadata/field_library`,
 * lets the super-admin create / edit / soft-deprecate / hard-delete
 * (with the reference-safety gate).
 *
 * The page mirrors the existing `SuperAdminVoucherTemplatesPage` so the
 * super-admin surface stays visually consistent — same shell, same
 * table primitives, same search/sort hook.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Edit3, Plus, Trash2, EyeOff, Eye, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminModal,
  SuperAdminPage,
  SuperAdminPanel,
  SuperAdminSearchInput,
  SuperAdminStatCard,
  SuperAdminTable,
  SortIcon,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
  tableSortHeaderClass,
} from '../../../modules/super-admin/components/SuperAdminPage';
import { useSuperAdminTable } from '../../../modules/super-admin/hooks/useSuperAdminTable';
import { useConfirm } from '../../../hooks/useConfirm';
import {
  superAdminFieldLibraryApi,
  FieldLibraryEntry,
  FieldClass,
  FieldSectionHint,
} from '../../../api/superAdmin/fieldLibrary';

const FIELD_CLASSES: { value: FieldClass; label: string; description: string }[] = [
  { value: 'system_core',     label: 'System Core',     description: 'Always required when included on a voucher type. Cannot be demoted at form level.' },
  { value: 'system_optional', label: 'System Optional', description: 'Available; types/forms include or omit at will.' },
  { value: 'computed',        label: 'Computed',        description: 'Read-only; value derived by the engine (totals, IDs).' },
  { value: 'custom_metadata', label: 'Custom Metadata', description: 'Free-form bag. The only class companies may author themselves.' },
];

const SECTION_HINTS: FieldSectionHint[] = ['HEADER', 'BODY', 'EXTRA', 'FOOTER', 'ACTIONS'];

/**
 * Renderable field types. Mirrors `FIELD_TYPE_OPTIONS` from the
 * existing VoucherTemplateEditorPage so what the super-admin sees here
 * matches what the voucher template editor will accept downstream.
 * Two sub-groups separated by an empty option for visual grouping:
 * primitives at the top, selector kinds beneath.
 */
const FIELD_TYPES: { value: string; label: string; isSelector?: boolean }[] = [
  { value: 'text',     label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number',   label: 'Number' },
  { value: 'amount',   label: 'Amount (currency-aware number)' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Select' },
  { value: 'table',    label: 'Table (line items)' },
  { value: 'party-selector',            label: 'Party Selector (generic)', isSelector: true },
  { value: 'customer-account-selector', label: 'Customer + Account Selector', isSelector: true },
  { value: 'vendor-account-selector',   label: 'Vendor + Account Selector', isSelector: true },
  { value: 'item-selector',             label: 'Item Selector', isSelector: true },
  { value: 'warehouse-selector',        label: 'Warehouse Selector', isSelector: true },
  { value: 'account-selector',          label: 'Account Selector', isSelector: true },
  { value: 'cost-center-selector',      label: 'Cost Center Selector', isSelector: true },
];

const isSelectorType = (type: string) => FIELD_TYPES.find((t) => t.value === type)?.isSelector === true;

interface DeleteBlockedState {
  id: string;
  usedBy: string[];
}

export const SuperAdminFieldLibraryPage: React.FC = () => {
  const [entries, setEntries] = useState<FieldLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FieldLibraryEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDeprecated, setShowDeprecated] = useState(true);
  const [deleteBlocked, setDeleteBlocked] = useState<DeleteBlockedState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { confirm, confirmDialog } = useConfirm();

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await superAdminFieldLibraryApi.list();
      setEntries(data);
    } catch (err: any) {
      console.error('[FieldLibrary] load failed', err);
      setError(err?.message || 'Failed to load field library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // Filter deprecated entries on top of search/sort — `useSuperAdminTable`
  // doesn't know about our soft-delete flag, so we pre-filter the input.
  const visibleEntries = useMemo(
    () => (showDeprecated ? entries : entries.filter((e) => !e.deprecated)),
    [entries, showDeprecated],
  );

  const {
    data: filtered,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: visibleEntries,
    searchFields: ['id', 'label', 'type', 'fieldClass'],
    initialSort: { field: 'id', direction: 'asc' },
  });

  const stats = useMemo(() => ({
    total: entries.length,
    deprecated: entries.filter((e) => e.deprecated).length,
    selectors: entries.filter((e) => isSelectorType(e.type)).length,
    customMetadata: entries.filter((e) => e.fieldClass === 'custom_metadata').length,
  }), [entries]);

  const handleSave = async (input: Partial<FieldLibraryEntry>, isCreate: boolean) => {
    setBusyId(input.id || '__new__');
    setError(null);
    try {
      if (isCreate) {
        await superAdminFieldLibraryApi.create(input);
      } else {
        await superAdminFieldLibraryApi.update(input.id!, input);
      }
      setCreating(false);
      setEditing(null);
      await reload();
    } catch (err: any) {
      // Surface the backend's validation/collision message inline.
      const message = err?.response?.data?.error || err?.message || 'Save failed';
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleDeprecated = async (entry: FieldLibraryEntry) => {
    const next = !entry.deprecated;
    setBusyId(entry.id);
    setError(null);
    try {
      await superAdminFieldLibraryApi.setDeprecated(entry.id, next);
      await reload();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (entry: FieldLibraryEntry) => {
    const confirmed = await confirm({
      title: 'Delete Field',
      tone: 'danger',
      message: `Permanently delete "${entry.id}"? This cannot be undone.\n\n` +
      `Tip: prefer "Deprecate" — it keeps the entry in the catalog with a ` +
      `strikethrough and bumps version so consumers can detect the change.`
    });
    if (!confirmed) return;
    setBusyId(entry.id);
    setError(null);
    try {
      await superAdminFieldLibraryApi.delete(entry.id);
      await reload();
    } catch (err: any) {
      if (err?.response?.status === 409 && err?.response?.data?.usedBy) {
        setDeleteBlocked({ id: entry.id, usedBy: err.response.data.usedBy });
      } else {
        setError(err?.response?.data?.error || err?.message || 'Delete failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SuperAdminPage>
      {confirmDialog}
      <SuperAdminHeader
        title="Field Library"
        description="Layer 1 of the three-layer field cascade — the canonical catalog every voucher type and form draws from. Editing here propagates to consumers on their next save (decision 6.3: lazy revalidation)."
        meta="System metadata · task 135 Phase B"
        actions={
          <Button onClick={() => { setCreating(true); setError(null); }} leftIcon={<Plus className="h-4 w-4" />}>
            New Field
          </Button>
        }
      />

      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SuperAdminStatCard label="Total fields"     value={stats.total} />
          <SuperAdminStatCard label="Selectors"        value={stats.selectors} />
          <SuperAdminStatCard label="Custom metadata"  value={stats.customMetadata} />
          <SuperAdminStatCard label="Deprecated"       value={stats.deprecated} />
        </div>
      )}

      {error && (
        <SuperAdminPanel className="border-rose-200 bg-rose-50">
          <div className="flex items-start gap-2 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        </SuperAdminPanel>
      )}

      {loading ? (
        <SuperAdminLoading label="Loading field library..." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SuperAdminSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by id, label, type, or class..."
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeprecated}
                onChange={(e) => setShowDeprecated(e.target.checked)}
              />
              Show deprecated
            </label>
          </div>

          {filtered.length === 0 ? (
            <SuperAdminEmptyState
              title={entries.length === 0 ? 'No fields yet' : 'No matches'}
              description={entries.length === 0
                ? 'Run the system seeder (`npx ts-node src/seeder/runSystemSeeder.ts`) to populate the catalog from today\'s hardcoded constants, or click "New Field" to author one from scratch.'
                : 'Adjust the search or toggle "Show deprecated" above.'}
            />
          ) : (
            <SuperAdminTable>
              <thead className="bg-slate-50">
                <tr>
                  <th className={clsx(tableHeadCellClass, tableSortHeaderClass)} onClick={() => handleSort('id')}>
                    <span className="flex items-center gap-1">ID <SortIcon direction={sortConfig.field === 'id' ? sortConfig.direction : null} /></span>
                  </th>
                  <th className={clsx(tableHeadCellClass, tableSortHeaderClass)} onClick={() => handleSort('label')}>
                    <span className="flex items-center gap-1">Label <SortIcon direction={sortConfig.field === 'label' ? sortConfig.direction : null} /></span>
                  </th>
                  <th className={clsx(tableHeadCellClass, tableSortHeaderClass)} onClick={() => handleSort('type')}>
                    <span className="flex items-center gap-1">Type <SortIcon direction={sortConfig.field === 'type' ? sortConfig.direction : null} /></span>
                  </th>
                  <th className={clsx(tableHeadCellClass, tableSortHeaderClass)} onClick={() => handleSort('fieldClass')}>
                    <span className="flex items-center gap-1">Class <SortIcon direction={sortConfig.field === 'fieldClass' ? sortConfig.direction : null} /></span>
                  </th>
                  <th className={tableHeadCellClass}>Section</th>
                  <th className={tableHeadCellClass}>Tags</th>
                  <th className={tableHeadCellClass}>v</th>
                  <th className={tableHeadCellClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className={tableRowClass}>
                    <td className={clsx(tableCellClass, 'font-mono text-xs', entry.deprecated && 'line-through opacity-60')}>{entry.id}</td>
                    <td className={clsx(tableCellClass, entry.deprecated && 'line-through opacity-60')}>{entry.label}</td>
                    <td className={tableCellClass}>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{entry.type}</code>
                    </td>
                    <td className={tableCellClass}>
                      <FieldClassBadge value={entry.fieldClass} />
                    </td>
                    <td className={clsx(tableCellClass, 'text-xs text-slate-600')}>{entry.sectionHint || '—'}</td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap gap-1">
                        {entry.alwaysMandatory && <SuperAdminBadge tone="red">Mandatory</SuperAdminBadge>}
                        {entry.alwaysShared && <SuperAdminBadge tone="blue">Shared</SuperAdminBadge>}
                        {entry.selectorBinding && <SuperAdminBadge tone="slate">→ {entry.selectorBinding.collection}</SuperAdminBadge>}
                        {entry.deprecated && <SuperAdminBadge tone="amber">Deprecated</SuperAdminBadge>}
                      </div>
                    </td>
                    <td className={clsx(tableCellClass, 'text-xs tabular-nums')}>{entry.version}</td>
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditing(entry); setError(null); }}
                          disabled={busyId === entry.id}
                          className="p-1.5 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                          title="Edit"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleDeprecated(entry)}
                          disabled={busyId === entry.id}
                          className="p-1.5 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                          title={entry.deprecated ? 'Un-deprecate' : 'Deprecate (soft delete)'}
                        >
                          {entry.deprecated ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(entry)}
                          disabled={busyId === entry.id}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          title="Hard delete (blocked if referenced)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SuperAdminTable>
          )}
        </div>
      )}

      {(creating || editing) && (
        <FieldEditorModal
          mode={creating ? 'create' : 'edit'}
          initial={editing}
          onSave={(input) => handleSave(input, creating)}
          onClose={() => { setCreating(false); setEditing(null); setError(null); }}
          existingIds={new Set(entries.map((e) => e.id))}
          busy={busyId === (editing?.id || '__new__')}
        />
      )}

      {deleteBlocked && (
        <DeleteBlockedModal
          state={deleteBlocked}
          onClose={() => setDeleteBlocked(null)}
        />
      )}
    </SuperAdminPage>
  );
};

/* ─────────────────────────── Sub-components ──────────────────────────── */

const FieldClassBadge: React.FC<{ value: FieldClass }> = ({ value }) => {
  const tone =
    value === 'system_core' ? 'red'
    : value === 'system_optional' ? 'blue'
    : value === 'computed' ? 'slate'
    : 'green';
  return <SuperAdminBadge tone={tone}>{value.replace('_', ' ')}</SuperAdminBadge>;
};

interface FieldEditorModalProps {
  mode: 'create' | 'edit';
  initial: FieldLibraryEntry | null;
  onSave: (input: Partial<FieldLibraryEntry>) => void;
  onClose: () => void;
  existingIds: Set<string>;
  busy: boolean;
}

const FieldEditorModal: React.FC<FieldEditorModalProps> = ({ mode, initial, onSave, onClose, existingIds, busy }) => {
  const [form, setForm] = useState<Partial<FieldLibraryEntry>>(() =>
    initial
      ? { ...initial }
      : {
          id: '',
          label: '',
          type: 'text',
          fieldClass: 'system_optional',
          sectionHint: 'HEADER',
          alwaysMandatory: false,
          alwaysShared: false,
        }
  );

  const idTaken = mode === 'create' && form.id ? existingIds.has(form.id) : false;
  const canSubmit = !!form.id && !!form.label?.trim() && !!form.type && !idTaken && !busy;

  const update = <K extends keyof FieldLibraryEntry>(key: K, value: FieldLibraryEntry[K] | undefined) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const showSelectorBinding = isSelectorType(form.type || '');

  return (
    <SuperAdminModal
      title={mode === 'create' ? 'New Field' : `Edit: ${initial?.id}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* ID — immutable after creation. Pattern enforced server-side too. */}
        <Field label="ID Key" required hint={mode === 'create'
          ? 'Flat namespace. Must be unique across the catalog. Pattern: [a-zA-Z_][a-zA-Z0-9_-]{1,63}'
          : 'IDs are immutable after creation. To rename, create a new field and deprecate this one.'}>
          <input
            type="text"
            value={form.id || ''}
            onChange={(e) => update('id', e.target.value as any)}
            readOnly={mode === 'edit'}
            disabled={mode === 'edit'}
            placeholder="e.g. warehouseId"
            className={clsx(
              'w-full rounded border px-2 py-1.5 text-sm font-mono',
              mode === 'edit' ? 'bg-slate-100 text-slate-500' : 'bg-white',
              idTaken ? 'border-rose-400' : 'border-slate-300',
            )}
          />
          {idTaken && <p className="mt-1 text-xs text-rose-600">A field with this ID already exists.</p>}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Label" required>
            <input
              type="text"
              value={form.label || ''}
              onChange={(e) => update('label', e.target.value as any)}
              placeholder="e.g. Warehouse"
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Type" required>
            <select
              value={form.type || 'text'}
              onChange={(e) => update('type', e.target.value as any)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Field Class" required>
            <select
              value={form.fieldClass || 'system_optional'}
              onChange={(e) => update('fieldClass', e.target.value as any)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              {FIELD_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {FIELD_CLASSES.find((c) => c.value === form.fieldClass)?.description}
            </p>
          </Field>
          <Field label="Default Section">
            <select
              value={form.sectionHint || ''}
              onChange={(e) => update('sectionHint', (e.target.value || undefined) as any)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">(none)</option>
              {SECTION_HINTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Voucher types can override per type-binding (Layer 2).</p>
          </Field>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.alwaysMandatory}
              onChange={(e) => update('alwaysMandatory', e.target.checked as any)}
            />
            Always mandatory when included
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.alwaysShared}
              onChange={(e) => update('alwaysShared', e.target.checked as any)}
            />
            Available to every voucher type
          </label>
        </div>

        {showSelectorBinding && (
          <Field label="Selector Binding" hint="Tells the renderer which collection to query for this selector kind. The React component itself is registered in code (registry.ts) — see decision 6.4.">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={form.selectorBinding?.collection || ''}
                onChange={(e) => update('selectorBinding', { ...(form.selectorBinding || {}), collection: e.target.value, displayField: form.selectorBinding?.displayField || 'name' } as any)}
                placeholder="collection (e.g. warehouses)"
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={form.selectorBinding?.displayField || ''}
                onChange={(e) => update('selectorBinding', { ...(form.selectorBinding || { collection: '' }), displayField: e.target.value } as any)}
                placeholder="display field (e.g. name)"
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={form.selectorBinding?.valueField || ''}
                onChange={(e) => update('selectorBinding', { ...(form.selectorBinding || { collection: '', displayField: 'name' }), valueField: e.target.value || undefined } as any)}
                placeholder="value field (defaults to id)"
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </Field>
        )}

        {initial && (
          <div className="border-t border-slate-200 pt-3 text-xs text-slate-500 grid grid-cols-2 gap-1">
            <div>Version: <span className="font-mono">{initial.version}</span></div>
            <div>Scope: <span className="font-mono">{initial.scope || 'system'}</span></div>
            <div>Last updated: <span className="font-mono">{initial.updatedAt || '—'}</span></div>
            <div>By: <span className="font-mono">{initial.updatedBy || '—'}</span></div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!canSubmit}>
            {busy ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </div>
      </div>
    </SuperAdminModal>
  );
};

const DeleteBlockedModal: React.FC<{ state: DeleteBlockedState; onClose: () => void }> = ({ state, onClose }) => (
  <SuperAdminModal title={`Can't delete "${state.id}"`} onClose={onClose}>
    <div className="space-y-3 text-sm">
      <p className="text-slate-700">
        This field is referenced by one or more system voucher templates and can't be
        hard-deleted. Deprecate it instead — that keeps the entry available with a
        strikethrough so existing forms continue to render, while signalling new ones
        to avoid it.
      </p>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Used by</p>
        <ul className="list-disc list-inside text-xs font-mono text-slate-600 bg-slate-50 rounded p-2 max-h-40 overflow-auto">
          {state.usedBy.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={onClose}>OK</Button>
      </div>
    </div>
  </SuperAdminModal>
);

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-700 mb-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </span>
    {children}
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </label>
);

export default SuperAdminFieldLibraryPage;
