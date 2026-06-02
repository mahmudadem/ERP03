import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { DatePicker, ItemSelector } from '../../../components/shared/selectors';
import {
  BuyXGetYConfig,
  PromotionRuleDTO,
  PromotionScope,
  PromotionType,
  ThresholdDiscountConfig,
  salesOperationalApi,
} from '../../../api/salesOperationalApi';
import {
  ChevronLeft,
  Edit3,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Editor ───────────────────────────────────────────────────────────────────

interface PromotionForm {
  name: string;
  description: string;
  type: PromotionType;
  status: 'ACTIVE' | 'INACTIVE';
  priority: number;
  validFrom: string;
  validTo: string;
  scope: PromotionScope;
  itemIds: string; // comma-separated for simplicity
  categoryIds: string; // comma-separated for simplicity
  // BUY_X_GET_Y
  buyQty: number;
  getQty: number;
  getItemId: string;
  // THRESHOLD_DISCOUNT
  thresholdBasis: 'QTY' | 'AMOUNT';
  thresholdValue: number;
  discountPct: number;
}

const defaultForm = (): PromotionForm => ({
  name: '',
  description: '',
  type: 'THRESHOLD_DISCOUNT',
  status: 'ACTIVE',
  priority: 0,
  validFrom: '',
  validTo: '',
  scope: 'ALL',
  itemIds: '',
  categoryIds: '',
  buyQty: 1,
  getQty: 1,
  getItemId: '',
  thresholdBasis: 'AMOUNT',
  thresholdValue: 0,
  discountPct: 0,
});

const toForm = (dto: PromotionRuleDTO): PromotionForm => ({
  name: dto.name,
  description: dto.description ?? '',
  type: dto.type,
  status: dto.status,
  priority: dto.priority,
  validFrom: dto.validFrom ?? '',
  validTo: dto.validTo ?? '',
  scope: dto.scope,
  itemIds: (dto.itemIds ?? []).join(', '),
  categoryIds: (dto.categoryIds ?? []).join(', '),
  buyQty: dto.buyXGetY?.buyQty ?? 1,
  getQty: dto.buyXGetY?.getQty ?? 1,
  getItemId: dto.buyXGetY?.getItemId ?? '',
  thresholdBasis: dto.thresholdDiscount?.thresholdBasis ?? 'AMOUNT',
  thresholdValue: dto.thresholdDiscount?.thresholdValue ?? 0,
  discountPct: dto.thresholdDiscount?.discountPct ?? 0,
});

const buildBody = (f: PromotionForm): Record<string, any> => {
  const splitIds = (s: string) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const buyXGetY: BuyXGetYConfig | undefined =
    f.type === 'BUY_X_GET_Y'
      ? { buyQty: f.buyQty, getQty: f.getQty, getItemId: f.getItemId || undefined }
      : undefined;

  const thresholdDiscount: ThresholdDiscountConfig | undefined =
    f.type === 'THRESHOLD_DISCOUNT'
      ? { thresholdBasis: f.thresholdBasis, thresholdValue: f.thresholdValue, discountPct: f.discountPct }
      : undefined;

  return {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    type: f.type,
    status: f.status,
    priority: f.priority,
    validFrom: f.validFrom || undefined,
    validTo: f.validTo || undefined,
    scope: f.scope,
    itemIds: f.scope === 'ITEMS' ? splitIds(f.itemIds) : [],
    categoryIds: f.scope === 'CATEGORIES' ? splitIds(f.categoryIds) : [],
    buyXGetY,
    thresholdDiscount,
  };
};

interface EditorProps {
  initial: PromotionRuleDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  'w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100';
const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1';

const Editor: React.FC<EditorProps> = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState<PromotionForm>(initial ? toForm(initial) : defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<PromotionForm>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const body = buildBody(form);
      if (initial) {
        await salesOperationalApi.updatePromotion(initial.id, body);
      } else {
        await salesOperationalApi.createPromotion(body);
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
            <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-100 dark:shadow-none">
              <Tag size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {initial ? 'Edit Promotion' : 'New Promotion'}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">Promotion Rule Configuration</p>
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
        <div className="mx-auto max-w-4xl space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* General */}
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">General</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Name</label>
                <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Summer 10% Off" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <input className={inputCls} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Optional description" />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={form.type} onChange={(e) => set({ type: e.target.value as PromotionType })}>
                  <option value="THRESHOLD_DISCOUNT">Threshold Discount</option>
                  <option value="BUY_X_GET_Y">Buy X Get Y</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={form.status} onChange={(e) => set({ status: e.target.value as 'ACTIVE' | 'INACTIVE' })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <input type="number" className={inputCls} value={form.priority} onChange={(e) => set({ priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className={labelCls}>Scope</label>
                <select className={inputCls} value={form.scope} onChange={(e) => set({ scope: e.target.value as PromotionScope })}>
                  <option value="ALL">All Items</option>
                  <option value="ITEMS">Specific Items</option>
                  <option value="CATEGORIES">Specific Categories</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Valid From</label>
                <DatePicker inputClassName={inputCls} value={form.validFrom} onChange={(validFrom) => set({ validFrom })} />
              </div>
              <div>
                <label className={labelCls}>Valid To</label>
                <DatePicker inputClassName={inputCls} value={form.validTo} onChange={(validTo) => set({ validTo })} />
              </div>
              {form.scope === 'ITEMS' && (
                <div className="col-span-2">
                  <label className={labelCls}>Item IDs (comma-separated)</label>
                  <input className={inputCls} value={form.itemIds} onChange={(e) => set({ itemIds: e.target.value })} placeholder="item-id-1, item-id-2" />
                </div>
              )}
              {form.scope === 'CATEGORIES' && (
                <div className="col-span-2">
                  <label className={labelCls}>Category IDs (comma-separated)</label>
                  <input className={inputCls} value={form.categoryIds} onChange={(e) => set({ categoryIds: e.target.value })} placeholder="cat-id-1, cat-id-2" />
                </div>
              )}
            </div>
          </Card>

          {/* Type-specific config */}
          {form.type === 'BUY_X_GET_Y' && (
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Buy X Get Y Configuration</p>
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Buy Qty</label>
                  <input type="number" min={1} className={inputCls} value={form.buyQty} onChange={(e) => set({ buyQty: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className={labelCls}>Get Qty (free)</label>
                  <input type="number" min={1} className={inputCls} value={form.getQty} onChange={(e) => set({ getQty: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className={labelCls}>Free Item ID (optional)</label>
                  <ItemSelector 
                    value={form.getItemId} 
                    onChange={(item) => set({ getItemId: item?.id || '' })} 
                    placeholder="Leave blank = same item" 
                  />
                </div>
              </div>
            </Card>
          )}

          {form.type === 'THRESHOLD_DISCOUNT' && (
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Threshold Discount Configuration</p>
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Threshold Basis</label>
                  <select className={inputCls} value={form.thresholdBasis} onChange={(e) => set({ thresholdBasis: e.target.value as 'QTY' | 'AMOUNT' })}>
                    <option value="AMOUNT">Amount</option>
                    <option value="QTY">Quantity</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Threshold Value</label>
                  <input type="number" min={0} step="0.01" className={inputCls} value={form.thresholdValue} onChange={(e) => set({ thresholdValue: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>Discount %</label>
                  <input type="number" min={0} max={100} step="0.01" className={inputCls} value={form.discountPct} onChange={(e) => set({ discountPct: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── List Page ────────────────────────────────────────────────────────────────

const typeBadge = (type: PromotionType) => {
  if (type === 'BUY_X_GET_Y') return 'bg-indigo-50 text-indigo-600 border-indigo-200';
  return 'bg-amber-50 text-amber-600 border-amber-200';
};

const typeLabel = (type: PromotionType) => {
  if (type === 'BUY_X_GET_Y') return 'Buy X Get Y';
  return 'Threshold Discount';
};

const PromotionsPage: React.FC = () => {
  const [promotions, setPromotions] = useState<PromotionRuleDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const result = await salesOperationalApi.listPromotions();
      setPromotions(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load promotions', err);
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
    const initial = editingId ? (promotions.find((p) => p.id === editingId) ?? null) : null;
    return (
      <Editor
        initial={initial}
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
            <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-100 dark:shadow-none">
              <Tag size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Promotions</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">Discount Rules & Promotional Campaigns</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            <Plus size={16} /> New Promotion
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Promotion Directory</div>
              {loading && <div className="text-[10px] text-violet-500 font-black animate-pulse uppercase tracking-tighter">Loading...</div>}
            </div>

            <div className="p-6">
              {promotions.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <Tag size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No Promotions Found</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Create your first promotion by clicking the button above.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {promotions.map((promo) => (
                    <div
                      key={promo.id}
                      className="group flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
                          <Tag size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{promo.name}</span>
                            <span className={clsx('text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase', typeBadge(promo.type))}>
                              {typeLabel(promo.type)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Priority: {promo.priority}
                            {promo.validFrom && ` · from ${promo.validFrom}`}
                            {promo.validTo && ` to ${promo.validTo}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase',
                          promo.status === 'ACTIVE'
                            ? 'border-green-200 text-green-600 bg-green-50'
                            : 'border-slate-200 text-slate-400 bg-slate-50'
                        )}>
                          {promo.status}
                        </div>
                        <button
                          onClick={() => setEditingId(promo.id)}
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

export default PromotionsPage;
