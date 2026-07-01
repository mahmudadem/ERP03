import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/shared/selectors';
import {
  PriceListDTO,
  PriceListLineDTO,
  salesMasterDataApi,
} from '../../../api/salesMasterDataApi';
import { inventoryApi, InventoryItemDTO } from '../../../api/inventoryApi';
import {
  Plus,
  Tag,
  Search,
  Edit3,
  ChevronLeft,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { useTranslation } from 'react-i18next';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

// ─── Line editor row ──────────────────────────────────────────────────────────

interface LineRowProps {
  line: PriceListLineDTO;
  items: InventoryItemDTO[];
  onChange: (line: PriceListLineDTO) => void;
  onDelete: () => void;
}

const LineRow: React.FC<LineRowProps> = ({ line, items, onChange, onDelete }) => {
  const set = (patch: Partial<PriceListLineDTO>) => onChange({ ...line, ...patch });
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="py-2 pr-2">
        {items.length > 0 ? (
          <select
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            value={line.itemId}
            onChange={e => set({ itemId: e.target.value })}
          >
            <option value="">— select item —</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>{i.code} – {i.name}</option>
            ))}
          </select>
        ) : (
          <input
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            placeholder="Item ID"
            value={line.itemId}
            onChange={e => set({ itemId: e.target.value })}
          />
        )}
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min={0}
          className="w-24 text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          value={line.minQty}
          onChange={e => set({ minQty: parseFloat(e.target.value) || 0 })}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min={0}
          step="0.01"
          className="w-28 text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          value={line.unitPrice}
          onChange={e => set({ unitPrice: parseFloat(e.target.value) || 0 })}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          className="w-20 text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          value={line.discountPct ?? ''}
          onChange={e => set({ discountPct: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
          placeholder="0"
        />
      </td>
      <td className="py-2 pr-2">
        <input
          className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          placeholder="Comment"
          value={line.comment ?? ''}
          onChange={e => set({ comment: e.target.value || undefined })}
        />
      </td>
      <td className="py-2 text-right">
        <button
          onClick={onDelete}
          className="p-1 text-red-400 hover:text-red-600 transition-colors"
          title="Remove line"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  initial: PriceListDTO | null;
  items: InventoryItemDTO[];
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = (): Omit<PriceListDTO, 'id' | 'companyId' | 'createdBy' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  currency: 'USD',
  status: 'ACTIVE',
  validFrom: null,
  validTo: null,
  isDefault: false,
  lines: [],
});

const Editor: React.FC<EditorProps> = ({ initial, items, onClose, onSaved }) => {
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          currency: initial.currency,
          status: initial.status,
          validFrom: initial.validFrom,
          validTo: initial.validTo,
          isDefault: initial.isDefault,
          lines: initial.lines.map(l => ({ ...l })),
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const setLine = (idx: number, line: PriceListLineDTO) => {
    const lines = [...form.lines];
    lines[idx] = line;
    set({ lines });
  };
  const deleteLine = (idx: number) => {
    set({ lines: form.lines.filter((_, i) => i !== idx) });
  };
  const addLine = () => {
    set({ lines: [...form.lines, { itemId: '', minQty: 1, unitPrice: 0 }] });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await salesMasterDataApi.updatePriceList(initial.id, form);
      } else {
        await salesMasterDataApi.createPriceList(form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-100 dark:shadow-none">
              <Tag size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {initial ? 'Edit Price List' : 'New Price List'}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">
                Price List Configuration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">General</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Name</label>
                <input
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="e.g. Retail USD 2026"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Currency</label>
                <CurrencySelector
                  value={form.currency}
                  onChange={code => set({ currency: code })}
                  placeholder="USD"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Status</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.status}
                  onChange={e => set({ status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Valid From</label>
                <DatePicker
                  inputClassName="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.validFrom ?? ''}
                  onChange={validFrom => set({ validFrom: validFrom || null })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Valid To</label>
                <DatePicker
                  inputClassName="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.validTo ?? ''}
                  onChange={validTo => set({ validTo: validTo || null })}
                />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={form.isDefault}
                  onChange={e => set({ isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                />
                <label htmlFor="isDefault" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Set as default price list
                </label>
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Price Lines</p>
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-widest"
              >
                <Plus size={13} /> Add Line
              </button>
            </div>
            <div className="p-6 overflow-x-auto">
              {form.lines.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No lines yet. Click Add Line to begin.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Item', 'Min Qty', 'Unit Price', 'Discount %', 'Comment', ''].map(h => (
                        <th key={h} className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 pr-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((line, idx) => (
                      <LineRow
                        key={idx}
                        line={line}
                        items={items}
                        onChange={l => setLine(idx, l)}
                        onDelete={() => deleteLine(idx)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── List Page ────────────────────────────────────────────────────────────────

const PriceListsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [priceLists, setPriceLists] = useState<PriceListDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [plResult, itemsResult] = await Promise.all([
        salesMasterDataApi.listPriceLists(),
        inventoryApi.listItems({ limit: 1000 }),
      ]);
      setPriceLists(unwrap<PriceListDTO[]>(plResult) ?? []);
      setItems(unwrap<InventoryItemDTO[]>(itemsResult) ?? []);
    } catch (err) {
      console.error('Failed to load price lists', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaved = () => {
    setEditingId(null);
    setIsAdding(false);
    load();
  };

  if (editingId || isAdding) {
    const initial = editingId ? (priceLists.find(p => p.id === editingId) ?? null) : null;
    return (
      <Editor
        initial={initial}
        items={items}
        onClose={() => { setEditingId(null); setIsAdding(false); }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-100 dark:shadow-none">
              <Tag size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{t('salesAdminLists.priceLists.title')}</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">{t('salesAdminLists.priceLists.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            <Plus size={16} /> {t('salesAdminLists.priceLists.new')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Search size={14} /> {t('salesAdminLists.priceLists.directory')}
              </div>
              {loading && <div className="text-[10px] text-emerald-500 font-black animate-pulse uppercase tracking-tighter">Loading...</div>}
            </div>

            <div className="p-6">
              {priceLists.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <Tag size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{t('salesAdminLists.priceLists.emptyTitle')}</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">{t('salesAdminLists.priceLists.emptyDescription')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {priceLists.map(pl => (
                    <div
                      key={pl.id}
                      className="group flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'p-2 rounded-lg',
                          pl.isDefault ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                        )}>
                          <Tag size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{pl.name}</span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase">{pl.currency}</span>
                            {pl.isDefault && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest pl-1">DEFAULT</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {pl.lines.length} {pl.lines.length === 1 ? 'line' : 'lines'}
                            {pl.validFrom && ` · from ${pl.validFrom}`}
                            {pl.validTo && ` to ${pl.validTo}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase',
                          pl.status === 'ACTIVE'
                            ? 'border-green-200 text-green-600 bg-green-50'
                            : 'border-slate-200 text-slate-400 bg-slate-50'
                        )}>
                          {pl.status}
                        </div>
                        <button
                          onClick={() => setEditingId(pl.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-all"
                        >
                          <Edit3 size={16} />
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
    </div>
  );
};

export default PriceListsPage;
