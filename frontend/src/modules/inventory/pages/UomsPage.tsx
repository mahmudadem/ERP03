import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { InventoryUomDTO, UomDimension, inventoryApi } from '../../../api/inventoryApi';

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = {
        code: draft.code?.trim().toUpperCase(),
        name: draft.name?.trim(),
        dimension: draft.dimension,
        decimalPlaces: Number(draft.decimalPlaces ?? 0),
        active: draft.active ?? true,
      };

      if (editingId) {
        await inventoryApi.updateUom(editingId, payload);
      } else {
        await inventoryApi.createUom(payload);
      }

      setDraft(createDraft());
      setEditingId(null);
      await load();
    } catch (error) {
      console.error('Failed to save UOM', error);
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
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Units of Measure</h1>

      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={handleSubmit}>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm uppercase"
            placeholder="Code"
            value={draft.code || ''}
            onChange={(e) => setDraft((current) => ({ ...current, code: e.target.value }))}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Name"
            value={draft.name || ''}
            onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
            required
          />
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={draft.dimension || 'COUNT'}
            onChange={(e) => setDraft((current) => ({ ...current, dimension: e.target.value as UomDimension }))}
          >
            {DIMENSIONS.map((dimension) => (
              <option key={dimension} value={dimension}>
                {dimension}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min={0}
            max={6}
            value={draft.decimalPlaces ?? 0}
            onChange={(e) => setDraft((current) => ({ ...current, decimalPlaces: Number(e.target.value || 0) }))}
          />
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            type="submit"
            disabled={saving}
          >
            {editingId ? 'Update UOM' : 'Add UOM'}
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="grid grid-cols-12 border-b border-slate-200 pb-2 text-sm font-semibold">
          <div className="col-span-2">Code</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Dimension</div>
          <div className="col-span-2">Decimals</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Edit</div>
        </div>
        <div className="pt-2">
          {loading ? (
            <div className="py-8 text-sm text-slate-500">Loading UOMs...</div>
          ) : (
            sorted.map((uom) => (
              <div key={uom.id} className="grid grid-cols-12 items-center border-b border-slate-100 py-2 text-sm">
                <div className="col-span-2 font-mono font-semibold">{uom.code}</div>
                <div className="col-span-3">{uom.name}</div>
                <div className="col-span-2">{uom.dimension}</div>
                <div className="col-span-2">{uom.decimalPlaces}</div>
                <div className="col-span-2">
                  {uom.active ? 'ACTIVE' : 'INACTIVE'}
                  {uom.isSystem ? ' / SYSTEM' : ''}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    type="button"
                    onClick={() => startEdit(uom)}
                  >
                    Edit
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
