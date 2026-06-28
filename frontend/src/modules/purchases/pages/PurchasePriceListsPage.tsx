import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import {
  purchasesApi,
  PurchasePriceListDTO,
  PurchasePriceListLineDTO,
} from '../../../api/purchasesApi';
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
import { DatePicker } from '../../accounting/components/shared/DatePicker';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

// ─── Line editor row ──────────────────────────────────────────────────────────

interface LineRowProps {
  line: PurchasePriceListLineDTO;
  items: InventoryItemDTO[];
  onChange: (line: PurchasePriceListLineDTO) => void;
  onDelete: () => void;
}

const LineRow: React.FC<LineRowProps> = ({ line, items, onChange, onDelete }) => {
  const { t } = useTranslation(['purchases', 'common']);
  const set = (patch: Partial<PurchasePriceListLineDTO>) => onChange({ ...line, ...patch });
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="py-2 pr-2">
        {items.length > 0 ? (
          <select
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            value={line.itemId}
            onChange={e => set({ itemId: e.target.value })}
          >
            <option value="">{t("auto.PurchasePriceListsPage.selectItem", "— select item —")}</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>{i.code} – {i.name}</option>
            ))}
          </select>
        ) : (
          <input
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            placeholder={t("auto.PurchasePriceListsPage.itemID", "Item ID")}
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
          placeholder={t("auto.PurchasePriceListsPage.comment", "Comment")}
          value={line.comment ?? ''}
          onChange={e => set({ comment: e.target.value || undefined })}
        />
      </td>
      <td className="py-2 text-right">
        <button
          onClick={onDelete}
          className="p-1 text-red-400 hover:text-red-600 transition-colors"
          title={t("auto.PurchasePriceListsPage.removeLine", "Remove line")}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  initial: PurchasePriceListDTO | null;
  items: InventoryItemDTO[];
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = (): Omit<PurchasePriceListDTO, 'id' | 'companyId' | 'createdBy' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  currency: 'USD',
  status: 'ACTIVE',
  validFrom: null,
  validTo: null,
  isDefault: false,
  lines: [],
});

const Editor: React.FC<EditorProps> = ({ initial, items, onClose, onSaved }) => {
  const { t } = useTranslation(['purchases', 'common']);
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

  const setLine = (idx: number, line: PurchasePriceListLineDTO) => {
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
    if (!form.name.trim()) {
      setError(t('priceLists.validation.nameRequired', 'Price list name is required.'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await purchasesApi.updatePurchasePriceList(initial.id, form);
        toast.success(t('priceLists.messages.updated', 'Purchase price list updated'));
      } else {
        await purchasesApi.createPurchasePriceList(form);
        toast.success(t('priceLists.messages.created', 'Purchase price list created'));
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? t('priceLists.messages.saveFailed', 'Save failed');
      setError(msg);
      toast.error(msg);
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
            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-100 dark:shadow-none">
              <Tag size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {initial ? t('priceLists.editTitle', 'Edit Purchase Price List') : t('priceLists.newTitle', 'New Purchase Price List')}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">
                {t('priceLists.subtitle', 'Purchase Price List Configuration')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest"
            >
              <X size={14} /> {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
            >
              <Save size={14} /> {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
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
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('common.general', 'General')}</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('common.name', 'Name')}</label>
                <input
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder={t("auto.PurchasePriceListsPage.eGStandardVendorUSD", "e.g. Standard Vendor USD")}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('common.currency', 'Currency')}</label>
                <CurrencySelector
                  value={form.currency}
                  onChange={code => set({ currency: code })}
                  placeholder={t("auto.PurchasePriceListsPage.uSD", "USD")}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('common.status', 'Status')}</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.status}
                  onChange={e => set({ status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                >
                  <option value="ACTIVE">{t('common.active', 'Active')}</option>
                  <option value="INACTIVE">{t('common.inactive', 'Inactive')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('common.validFrom', 'Valid From')}</label>
                <DatePicker
                  value={form.validFrom ?? ''}
                  onChange={val => set({ validFrom: val || null })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('common.validTo', 'Valid To')}</label>
                <DatePicker
                  value={form.validTo ?? ''}
                  onChange={val => set({ validTo: val || null })}
                />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={form.isDefault}
                  onChange={e => set({ isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="isDefault" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('priceLists.setAsDefault', 'Set as default price list for this currency')}
                </label>
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('priceLists.lines', 'Price Lines')}</p>
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest"
              >
                <Plus size={13} /> {t('priceLists.addLine', 'Add Line')}
              </button>
            </div>
            <div className="p-6 overflow-x-auto">
              {form.lines.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{t('priceLists.noLines', 'No lines yet. Click Add Line to begin.')}</p>
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

const PurchasePriceListsPage: React.FC = () => {
  const { t } = useTranslation(['purchases', 'common']);
  const [priceLists, setPriceLists] = useState<PurchasePriceListDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [plResult, itemsResult] = await Promise.all([
        purchasesApi.listPurchasePriceLists(),
        inventoryApi.listItems({ limit: 1000 }),
      ]);
      setPriceLists(unwrap<PurchasePriceListDTO[]>(plResult) ?? []);
      setItems(unwrap<InventoryItemDTO[]>(itemsResult) ?? []);
    } catch (err) {
      console.error('Failed to load purchase price lists', err);
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

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await purchasesApi.deletePurchasePriceList(deletingId);
      toast.success(t('priceLists.messages.deleted', 'Price list deleted successfully'));
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? t('priceLists.messages.deleteFailed', 'Failed to delete price list');
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
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
            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-100 dark:shadow-none">
              <Tag size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{t('priceLists.title', 'Purchase Price Lists')}</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">{t('priceLists.listSubtitle', 'Vendor Pricing Rules & Agreements')}</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            <Plus size={16} /> {t('priceLists.newBtn', 'New Price List')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Search size={14} /> {t('priceLists.directory', 'Price List Directory')}
              </div>
              {loading && <div className="text-[10px] text-blue-500 font-black animate-pulse uppercase tracking-tighter">{t('common.loading', 'Loading...')}</div>}
            </div>

            <div className="p-6">
              {priceLists.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <Tag size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{t('priceLists.empty', 'No Price Lists Found')}</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">{t('priceLists.emptySub', 'Configure a purchase price list to manage vendor pricing rules.')}</p>
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
                          pl.isDefault ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                        )}>
                          <Tag size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{pl.name}</span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase">{pl.currency}</span>
                            {pl.isDefault && <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest pl-1">{t('common.default', 'DEFAULT')}</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {pl.lines.length} {pl.lines.length === 1 ? t('priceLists.line', 'line') : t('priceLists.linesPlural', 'lines')}
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
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => setEditingId(pl.id)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all"
                            title={t('common.edit', 'Edit')}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingId(pl.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                            title={t('common.delete', 'Delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
        isOpen={!!deletingId}
        title={t('priceLists.confirmDeleteTitle', 'Delete Price List')}
        message={t('priceLists.confirmDeleteMessage', 'Are you sure you want to delete this price list? This action cannot be undone.')}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        tone="danger"
      />
    </div>
  );
};

export default PurchasePriceListsPage;
