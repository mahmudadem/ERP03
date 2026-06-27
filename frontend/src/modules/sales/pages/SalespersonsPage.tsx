import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import {
  SalespersonDTO,
  CommissionTotalsDTO,
  salesMasterDataApi,
} from '../../../api/salesMasterDataApi';
import { UserCheck, Search, Plus, Edit3, ChevronLeft, Save, X, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from "react-i18next";

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

// ─── Commission Summary Panel ─────────────────────────────────────────────────

const CommissionSummary: React.FC<{ salespersonId: string }> = ({ salespersonId }) => {
    const { t } = useTranslation('common');
  const [totals, setTotals] = useState<CommissionTotalsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    salesMasterDataApi
      .getSalespersonCommissionTotals(salespersonId)
      .then(res => setTotals(unwrap<CommissionTotalsDTO>(res)))
      .catch(err => console.error('Failed to load commission totals', err))
      .finally(() => setLoading(false));
  }, [salespersonId]);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
      <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center gap-2">
        <TrendingUp size={14} className="text-slate-400" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t(`Commission Summary`)}</p>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-xs text-slate-400 animate-pulse">{t(`Loading totals...`)}</div>
        ) : totals ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-4">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">{t(`Accrued`)}</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{fmt(totals.accrued)}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg p-4">
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">{t(`Paid`)}</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{fmt(totals.paid)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t(`Cancelled`)}</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{fmt(totals.cancelled)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">{t(`Could not load commission totals.`)}</p>
        )}
      </div>
    </Card>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  initial: SalespersonDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

type FormState = {
  code: string;
  name: string;
  email: string;
  defaultCommissionPct: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const Editor: React.FC<EditorProps> = ({ initial, onClose, onSaved }) => {
    const { t } = useTranslation('common');
  const [form, setForm] = useState<FormState>(() => ({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    defaultCommissionPct: initial?.defaultCommissionPct?.toString() ?? '0',
    status: initial?.status ?? 'ACTIVE',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<SalespersonDTO> = {
        code: form.code,
        name: form.name,
        email: form.email || undefined,
        defaultCommissionPct: parseFloat(form.defaultCommissionPct) || 0,
        status: form.status,
      };
      if (initial) {
        await salesMasterDataApi.updateSalesperson(initial.id, payload);
      } else {
        await salesMasterDataApi.createSalesperson(payload);
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
            <div className="p-3 bg-sky-600 rounded-xl text-white shadow-lg shadow-sky-100 dark:shadow-none">
              <UserCheck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {initial ? 'Edit Salesperson' : 'New Salesperson'}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">{t(`Salesperson Profile`)}</p>
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
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t(`Profile`)}</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t(`Code`)}</label>
                <input
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono uppercase"
                  value={form.code}
                  onChange={e => set({ code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SP001"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t(`Full Name`)}</label>
                <input
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="e.g. Alice Johnson"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t(`Email`)}</label>
                <input
                  type="email"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.email}
                  onChange={e => set({ email: e.target.value })}
                  placeholder="alice@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t(`Default Commission %`)}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.defaultCommissionPct}
                  onChange={e => set({ defaultCommissionPct: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t(`Status`)}</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={form.status}
                  onChange={e => set({ status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                >
                  <option value="ACTIVE">{t(`Active`)}</option>
                  <option value="INACTIVE">{t(`Inactive`)}</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Commission summary only for existing (saved) salesperson */}
          {initial && <CommissionSummary salespersonId={initial.id} />}
        </div>
      </div>
    </div>
  );
};

// ─── List Page ────────────────────────────────────────────────────────────────

const SalespersonsPage: React.FC = () => {
    const { t } = useTranslation('common');
  const [salespersons, setSalespersons] = useState<SalespersonDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const result = await salesMasterDataApi.listSalespersons();
      setSalespersons(unwrap<SalespersonDTO[]>(result) ?? []);
    } catch (err) {
      console.error('Failed to load salespersons', err);
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
    const initial = editingId ? (salespersons.find(s => s.id === editingId) ?? null) : null;
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
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-600 rounded-xl text-white shadow-lg shadow-sky-100 dark:shadow-none">
              <UserCheck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{t(`Salespersons`)}</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">{t(`Sales Team & Commission Rates`)}</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            <Plus size={16} /> New Salesperson
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Search size={14} /> Sales Team Directory
              </div>
              {loading && <div className="text-[10px] text-sky-500 font-black animate-pulse uppercase tracking-tighter">{t(`Loading...`)}</div>}
            </div>

            <div className="p-6">
              {salespersons.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <UserCheck size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{t(`No Salespersons Registered`)}</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">{t(`Add salespersons to track commissions and assignments.`)}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {salespersons.map(sp => (
                    <div
                      key={sp.id}
                      className="group flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-400">
                          <UserCheck size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{sp.name}</span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">{sp.code}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 space-x-2">
                            {sp.email && <span>{sp.email}</span>}
                            <span>· {sp.defaultCommissionPct}{t(`% commission`)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase',
                          sp.status === 'ACTIVE'
                            ? 'border-green-200 text-green-600 bg-green-50'
                            : 'border-slate-200 text-slate-400 bg-slate-50'
                        )}>
                          {sp.status}
                        </div>
                        <button
                          onClick={() => setEditingId(sp.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-full transition-all"
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

export default SalespersonsPage;
