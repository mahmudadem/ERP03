import React, { useState, useMemo, useCallback } from 'react';
import { accountingApi } from '../../../../../api/accountingApi';
import { BookOpen, RefreshCw, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────── */

interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  currency?: string;
}

interface JournalVoucher {
  voucherId: string;
  voucherNo: string;
  date: string;
  type: string;
  description: string;
  status: string;
  currency: string;
  formName?: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
}

/* ── Helpers ────────────────────────────────────────────── */

const fmt = (n: number) =>
  n ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

const today = () => new Date().toISOString().slice(0, 10);

const statusChip = (status: string) => {
  const map: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-700',
    pending:  'bg-amber-100 text-amber-700',
    draft:    'bg-slate-100 text-slate-500',
    rejected: 'bg-red-100 text-red-700',
    cancelled:'bg-slate-100 text-slate-400',
  };
  return map[status] ?? 'bg-slate-100 text-slate-500';
};

const typeChip = (type: string) => {
  const map: Record<string, string> = {
    journal_entry:   'bg-blue-50 text-blue-700',
    payment:         'bg-purple-50 text-purple-700',
    receipt:         'bg-teal-50 text-teal-700',
    opening_balance: 'bg-orange-50 text-orange-700',
    reversal:        'bg-rose-50 text-rose-700',
    fx_revaluation:  'bg-indigo-50 text-indigo-700',
  };
  return map[type] ?? 'bg-slate-50 text-slate-500';
};

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    journal_entry:   'Journal Entry',
    payment:         'Payment',
    receipt:         'Receipt',
    opening_balance: 'Opening Balance',
    reversal:        'Reversal',
    fx_revaluation:  'FX Revaluation',
  };
  return map[type] ?? type;
};

/* ── Main Component ─────────────────────────────────────── */

export default function ApexJournal() {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate]     = useState(today());
  const [search, setSearch]     = useState('');
  const [rawData, setRawData]   = useState<JournalVoucher[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        fromDate: fromDate,
        toDate:   toDate,
      };
      const result = await accountingApi.getJournal(params);
      setRawData((result ?? []) as JournalVoucher[]);
      setGenerated(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load journal data';
      setError(msg);
      setRawData([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  /* Client-side search filter */
  const data = useMemo(() => {
    if (!search.trim()) return rawData;
    const q = search.toLowerCase();
    return rawData.filter(v =>
      v.voucherNo.toLowerCase().includes(q) ||
      v.type.toLowerCase().includes(q) ||
      v.description?.toLowerCase().includes(q) ||
      v.lines.some(l =>
        l.accountCode.toLowerCase().includes(q) ||
        l.accountName.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q)
      )
    );
  }, [rawData, search]);

  /* Sort by date then voucher number */
  const sorted = useMemo(() =>
    [...data].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.voucherNo.localeCompare(b.voucherNo);
    }),
    [data]
  );

  const totals = useMemo(() =>
    sorted.reduce((acc, v) => ({
      debit:  acc.debit  + (v.totalDebit  ?? 0),
      credit: acc.credit + (v.totalCredit ?? 0),
    }), { debit: 0, credit: 0 }),
    [sorted]
  );

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  return (
    <div className="space-y-4 font-sans">

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-slate-800">Journal / Day Book</span>
          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest ml-2">
            Chronological ledger entries
          </span>
        </div>

        <div className="px-4 py-3 flex items-end flex-wrap gap-3">
          {/* From */}
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 font-mono"
            />
          </div>
          {/* To */}
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 font-mono"
            />
          </div>
          {/* Search */}
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Voucher, account, description…"
                className="bg-white border border-[#E2E8F0] rounded pl-7 pr-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 w-56"
              />
            </div>
          </div>
          {/* Generate */}
          <button
            onClick={generate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors self-end"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
            <span>{loading ? 'Loading…' : 'Generate'}</span>
          </button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-lg p-4 animate-pulse space-y-2">
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              <div className="h-2 bg-slate-100 rounded w-2/3" />
              <div className="h-2 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {generated && !loading && (
        <>
          {/* Stats bar */}
          <div className="flex items-center space-x-4 px-1 flex-wrap gap-y-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              {sorted.length} voucher{sorted.length !== 1 ? 's' : ''}
              {rawData.length !== sorted.length && ` (filtered from ${rawData.length})`}
            </span>
            {isBalanced && sorted.length > 0 && (
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
                <span>Balanced</span>
              </span>
            )}
          </div>

          {/* Empty state */}
          {sorted.length === 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center py-16 space-y-3">
              <BookOpen className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-semibold text-slate-400">No journal entries found for the selected criteria</p>
            </div>
          )}

          {/* Voucher cards */}
          {sorted.map(v => (
            <div key={v.voucherId} className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
              {/* Voucher header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                  {/* Date */}
                  <span className="font-mono text-[10px] font-bold text-slate-500 bg-white border border-[#E2E8F0] px-2 py-0.5 rounded">
                    {v.date}
                  </span>
                  {/* Voucher No */}
                  <span className="text-xs font-bold text-blue-700">{v.voucherNo}</span>
                  {/* Type chip */}
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${typeChip(v.type)}`}>
                    {typeLabel(v.type)}
                  </span>
                  {v.formName && (
                    <span className="text-[9px] text-slate-400 font-mono">{v.formName}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {v.currency && (
                    <span className="text-[9px] font-mono font-bold text-slate-400">{v.currency}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusChip(v.status)}`}>
                    {v.status}
                  </span>
                </div>
              </div>

              {/* Description */}
              {v.description && (
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-[#E2E8F0]">
                  {v.description}
                </div>
              )}

              {/* Lines table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      <th className="text-left px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Account</th>
                      <th className="text-left px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="text-right px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Debit</th>
                      <th className="text-right px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.lines.map((l, idx) => (
                      <tr
                        key={`${v.voucherId}-line-${idx}`}
                        className={`border-t border-[#E2E8F0] hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}`}
                      >
                        <td className="px-4 py-2">
                          <div className="text-xs font-semibold text-slate-800">{l.accountCode}</div>
                          <div className="text-[10px] text-slate-400">{l.accountName}</div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">{l.description || '—'}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-slate-800">
                          {l.debit ? fmt(l.debit) : ''}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-slate-800">
                          {l.credit ? fmt(l.credit) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Voucher subtotal */}
                  <tfoot>
                    <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                      <td colSpan={2} className="px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                        Voucher Total
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs font-bold text-slate-700">
                        {fmt(v.totalDebit)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs font-bold text-slate-700">
                        {fmt(v.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {/* ── Grand Totals ─────────────────────────────────── */}
          {sorted.length > 0 && (
            <div className="bg-white border-2 border-[#E2E8F0] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800">
                <span className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-widest">Grand Total</span>
                <div className="flex items-center space-x-8">
                  <div className="text-right">
                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Debit</p>
                    <p className="font-mono text-sm font-bold text-white">{fmt(totals.debit)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Credit</p>
                    <p className="font-mono text-sm font-bold text-white">{fmt(totals.credit)}</p>
                  </div>
                  {isBalanced && (
                    <span className="flex items-center space-x-1 text-emerald-400 text-[10px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Balanced</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Empty initial state ──────────────────────────── */}
      {!generated && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center py-16 space-y-3">
          <BookOpen className="w-8 h-8 text-slate-300" />
          <p className="text-xs font-semibold text-slate-400">Set a date range and click Generate</p>
        </div>
      )}

    </div>
  );
}
