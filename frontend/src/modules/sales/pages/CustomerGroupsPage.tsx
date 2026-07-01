import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import {
  CustomerGroupDTO,
  PriceListDTO,
  salesMasterDataApi,
} from '../../../api/salesMasterDataApi';
import { Users, Search, Plus, Edit3, ChevronLeft, Save, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  initial: CustomerGroupDTO | null;
  priceLists: PriceListDTO[];
  onClose: () => void;
  onSaved: () => void;
}

type FormState = {
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  defaultPriceListId: string;
  defaultPaymentTermsDays: string;
  defaultCreditLimit: string;
  taxExempt: boolean;
};

const Editor: React.FC<EditorProps> = ({ initial, priceLists, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(() => ({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'ACTIVE',
    defaultPriceListId: initial?.defaultPriceListId ?? '',
    defaultPaymentTermsDays: initial?.defaultPaymentTermsDays?.toString() ?? '',
    defaultCreditLimit: initial?.defaultCreditLimit?.toString() ?? '',
    taxExempt: initial?.taxExempt ?? false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<CustomerGroupDTO> = {
        name: form.name,
        description: form.description || null,
        status: form.status,
        defaultPriceListId: form.defaultPriceListId || null,
        defaultPaymentTermsDays: form.defaultPaymentTermsDays ? parseInt(form.defaultPaymentTermsDays, 10) : null,
        defaultCreditLimit: form.defaultCreditLimit ? parseFloat(form.defaultCreditLimit) : null,
        taxExempt: form.taxExempt,
      };
      if (initial) {
        await salesMasterDataApi.updateCustomerGroup(initial.id, payload);
      } else {
        await salesMasterDataApi.createCustomerGroup(payload);
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
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-100 dark:shadow-none">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {initial ? 'Edit Customer Group' : 'New Customer Group'}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">Group Configuration</p>
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
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Group Details</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Name</label>
                <input
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="e.g. Wholesale Customers"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Description</label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
                  value={form.description}
                  onChange={e => set({ description: e.target.value })}
                  placeholder="Optional description"
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Default Price List</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.defaultPriceListId}
                  onChange={e => set({ defaultPriceListId: e.target.value })}
                >
                  <option value="">— none —</option>
                  {priceLists.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.name} ({pl.currency})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Payment Terms (days)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.defaultPaymentTermsDays}
                  onChange={e => set({ defaultPaymentTermsDays: e.target.value })}
                  placeholder="e.g. 30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Credit Limit</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.defaultCreditLimit}
                  onChange={e => set({ defaultCreditLimit: e.target.value })}
                  placeholder="e.g. 10000"
                />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="taxExempt"
                  checked={form.taxExempt}
                  onChange={e => set({ taxExempt: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600"
                />
                <label htmlFor="taxExempt" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tax exempt
                </label>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── List Page ────────────────────────────────────────────────────────────────

const CustomerGroupsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [groups, setGroups] = useState<CustomerGroupDTO[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [gResult, plResult] = await Promise.all([
        salesMasterDataApi.listCustomerGroups(),
        salesMasterDataApi.listPriceLists(),
      ]);
      setGroups(unwrap<CustomerGroupDTO[]>(gResult) ?? []);
      setPriceLists(unwrap<PriceListDTO[]>(plResult) ?? []);
    } catch (err) {
      console.error('Failed to load customer groups', err);
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
    const initial = editingId ? (groups.find(g => g.id === editingId) ?? null) : null;
    return (
      <Editor
        initial={initial}
        priceLists={priceLists}
        onClose={() => { setEditingId(null); setIsAdding(false); }}
        onSaved={handleSaved}
      />
    );
  }

  const priceListName = (id: string | null) =>
    id ? (priceLists.find(p => p.id === id)?.name ?? id) : '—';

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-100 dark:shadow-none">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{t('salesAdminLists.customerGroups.title')}</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">{t('salesAdminLists.customerGroups.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            <Plus size={16} /> {t('salesAdminLists.customerGroups.new')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Search size={14} /> {t('salesAdminLists.customerGroups.directory')}
              </div>
              {loading && <div className="text-[10px] text-violet-500 font-black animate-pulse uppercase tracking-tighter">Loading...</div>}
            </div>

            <div className="p-6">
              {groups.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <Users size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{t('salesAdminLists.customerGroups.emptyTitle')}</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">{t('salesAdminLists.customerGroups.emptyDescription')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {groups.map(g => (
                    <div
                      key={g.id}
                      className="group flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-400">
                          <Users size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{g.name}</span>
                            {g.taxExempt && (
                              <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Tax Exempt</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 space-x-2">
                            {g.description && <span>{g.description}</span>}
                            {g.defaultPriceListId && <span>· {priceListName(g.defaultPriceListId)}</span>}
                            {g.defaultPaymentTermsDays != null && <span>· {g.defaultPaymentTermsDays}d terms</span>}
                            {g.defaultCreditLimit != null && <span>· Limit {g.defaultCreditLimit.toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase',
                          g.status === 'ACTIVE'
                            ? 'border-green-200 text-green-600 bg-green-50'
                            : 'border-slate-200 text-slate-400 bg-slate-50'
                        )}>
                          {g.status}
                        </div>
                        <button
                          onClick={() => setEditingId(g.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-full transition-all"
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

export default CustomerGroupsPage;
