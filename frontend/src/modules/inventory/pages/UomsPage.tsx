import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, RotateCcw, Save, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { InventoryUomDTO, UomDimension, inventoryApi } from '../../../api/inventoryApi';
import toast from 'react-hot-toast';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const DIMENSIONS: UomDimension[] = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'TIME', 'OTHER'];

const createDraft = (): Partial<InventoryUomDTO> => ({
  code: '',
  name: '',
  dimension: 'COUNT',
  decimalPlaces: 0,
  active: true,
});

const UomsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [uoms, setUoms] = useState<InventoryUomDTO[]>([]);
  const [draft, setDraft] = useState<Partial<InventoryUomDTO>>(createDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const result = await inventoryApi.listUoms();
      setUoms(unwrap<InventoryUomDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load UOMs', error);
      toast.error(t('inventory.uom.messages.loadFailed', 'Failed to load units of measure'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(
    () => [...uoms].sort((a, b) => a.code.localeCompare(b.code)),
    [uoms]
  );

  const resetForm = () => {
    setDraft(createDraft());
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedCode = (draft.code || '').trim().toUpperCase();
    const trimmedName = (draft.name || '').trim();
    if (!trimmedCode) {
      toast.error(t('inventory.uom.errors.codeRequired', 'UOM code is required'));
      return;
    }
    if (!trimmedName) {
      toast.error(t('inventory.uom.errors.nameRequired', 'UOM name is required'));
      return;
    }
    try {
      setSaving(true);
      const payload = {
        code: trimmedCode,
        name: trimmedName,
        dimension: draft.dimension,
        decimalPlaces: Number(draft.decimalPlaces ?? 0),
        active: draft.active ?? true,
      };

      if (editingId) {
        await inventoryApi.updateUom(editingId, payload);
        toast.success(t('inventory.uom.messages.updated', 'UOM updated'));
      } else {
        await inventoryApi.createUom(payload);
        toast.success(t('inventory.uom.messages.created', 'UOM added'));
      }

      resetForm();
      await load();
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || t('inventory.uom.messages.saveFailed', 'Failed to save UOM');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (uom: InventoryUomDTO) => {
    setEditingId(uom.id);
    setDraft({
      code: uom.code,
      name: uom.name,
      dimension: uom.dimension,
      decimalPlaces: uom.decimalPlaces,
      active: uom.active,
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('inventory.uom.title', 'Units of Measure')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('inventory.uom.subtitle', 'Define measurement units (KG, BOX, EA, etc.) and how many decimals to keep when transacting.')}
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {isEditing
              ? t('inventory.uom.editHeading', 'Edit UOM')
              : t('inventory.uom.addHeading', 'Add a new UOM')}
          </h2>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              <X size={12} aria-hidden="true" />
              {t('inventory.uom.actions.cancelEdit', 'Cancel edit')}
            </button>
          )}
        </div>
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label htmlFor="uom-code" className="block text-xs font-semibold text-slate-600">
              {t('inventory.uom.fields.code', 'Code')}
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              id="uom-code"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase"
              value={draft.code || ''}
              onChange={(e) => setDraft((current) => ({ ...current, code: e.target.value }))}
              placeholder="KG"
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="uom-name" className="block text-xs font-semibold text-slate-600">
              {t('inventory.uom.fields.name', 'Name')}
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              id="uom-name"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={draft.name || ''}
              onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
              placeholder={t('inventory.uom.placeholders.name', 'Kilogram')}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="uom-dimension" className="block text-xs font-semibold text-slate-600">
              {t('inventory.uom.fields.dimension', 'Dimension')}
            </label>
            <select
              id="uom-dimension"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={draft.dimension || 'COUNT'}
              onChange={(e) => setDraft((current) => ({ ...current, dimension: e.target.value as UomDimension }))}
            >
              {DIMENSIONS.map((dimension) => (
                <option key={dimension} value={dimension}>
                  {t(`inventory.uom.dimensions.${dimension}`, dimension)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="uom-decimals" className="block text-xs font-semibold text-slate-600">
              {t('inventory.uom.fields.decimals', 'Decimals')}
            </label>
            <input
              id="uom-decimals"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              type="number"
              min={0}
              max={6}
              value={draft.decimalPlaces ?? 0}
              onChange={(e) => setDraft((current) => ({ ...current, decimalPlaces: Number(e.target.value || 0) }))}
            />
            <p className="text-[10px] text-slate-500">
              {t('inventory.uom.decimalsHelp', 'How many decimals to keep when transacting in this UOM (0–6).')}
            </p>
          </div>
          <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={draft.active ?? true}
                onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))}
              />
              {t('inventory.uom.fields.active', 'Active')}
            </label>
            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  {t('inventory.uom.actions.reset', 'Reset')}
                </button>
              )}
              <button
                className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                type="submit"
                disabled={saving}
              >
                <Save size={14} aria-hidden="true" />
                {isEditing
                  ? t('inventory.uom.actions.saveChanges', 'Save changes')
                  : t('inventory.uom.actions.addUom', 'Add new UOM')}
              </button>
            </div>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('inventory.uom.listHeading', 'Defined units')}
          </h2>
          <span className="text-xs text-slate-500">
            {t('inventory.uom.count', { count: sorted.length, defaultValue: '{{count}} unit(s)' })}
          </span>
        </div>
        <div className="grid grid-cols-12 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div className="col-span-2">{t('inventory.uom.columns.code', 'Code')}</div>
          <div className="col-span-3">{t('inventory.uom.columns.name', 'Name')}</div>
          <div className="col-span-2">{t('inventory.uom.columns.dimension', 'Dimension')}</div>
          <div className="col-span-2">{t('inventory.uom.columns.decimals', 'Decimals')}</div>
          <div className="col-span-2">{t('inventory.uom.columns.status', 'Status')}</div>
          <div className="col-span-1 text-right">{t('inventory.uom.columns.actions', 'Actions')}</div>
        </div>
        <div className="pt-2">
          {loading ? (
            <div className="py-8 text-sm text-slate-500">{t('inventory.uom.loading', 'Loading UOMs…')}</div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              {t('inventory.uom.empty', 'No units of measure defined yet. Add one above to use it on item cards and document lines.')}
            </div>
          ) : (
            sorted.map((uom) => (
              <div key={uom.id} className={`grid grid-cols-12 items-center border-b border-slate-100 py-2 text-sm ${editingId === uom.id ? 'bg-amber-50/40' : ''}`}>
                <div className="col-span-2 font-mono font-semibold">{uom.code}</div>
                <div className="col-span-3">{uom.name}</div>
                <div className="col-span-2">{uom.dimension}</div>
                <div className="col-span-2">{uom.decimalPlaces}</div>
                <div className="col-span-2">
                  {uom.active
                    ? t('inventory.uom.status.active', 'Active')
                    : t('inventory.uom.status.inactive', 'Inactive')}
                  {uom.isSystem ? ` · ${t('inventory.uom.status.system', 'System')}` : ''}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    type="button"
                    onClick={() => startEdit(uom)}
                  >
                    <Edit2 size={12} aria-hidden="true" />
                    {t('inventory.uom.actions.edit', 'Edit')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default UomsPage;
