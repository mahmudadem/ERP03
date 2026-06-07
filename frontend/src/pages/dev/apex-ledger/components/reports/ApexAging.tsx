import React, { useState, useEffect, useCallback } from 'react';
import { accountingApi, AgingReportData } from '../../../../../api/accountingApi';
import { ChevronRight, ChevronDown, AlertTriangle, RefreshCw } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKET_COLORS = [
  'text-emerald-700 font-mono',
  'text-blue-600 font-mono',
  'text-amber-600 font-mono',
  'text-orange-600 font-mono',
  'text-red-600 font-mono',
  'text-red-800 font-mono',
];

export default function ApexAging() {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<'AR' | 'AP'>('AR');
  const [asOfDate, setAsOfDate] = useState(today);
  const [includeZero, setIncludeZero] = useState(false);
  const [data, setData] = useState<AgingReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true); setError(null); setExpanded(null);
    try {
      const result = await accountingApi.getAgingReport(type, asOfDate, undefined, includeZero);
      setData(result);
      setGenerated(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load aging report');
      setData(null);
    } finally { setLoading(false); }
  }, [type, asOfDate, includeZero]);

  return (
    <div className="space-y-4 font-sans">
      {/* Filter bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Report Type</label>
          <select value={type} onChange={e => setType(e.target.value as 'AR' | 'AP')}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400">
            <option value="AR">Accounts Receivable (AR)</option>
            <option value="AP">Accounts Payable (AP)</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">As of Date</label>
          <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 pb-1.5 cursor-pointer">
          <input type="checkbox" checked={includeZero} onChange={e => setIncludeZero(e.target.checked)}
            className="rounded border-slate-300 text-blue-600" />
          Include Zero Balances
        </label>
        <button onClick={generate} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          {loading ? 'Loading...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {generated && data && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
          {/* Header strip */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5 flex items-center gap-4">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${type === 'AR' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
              {type === 'AR' ? 'Receivables' : 'Payables'}
            </span>
            <span className="text-[9px] font-mono text-slate-500">As of {data.asOfDate || asOfDate}</span>
            <span className="text-[9px] font-mono text-slate-400 ml-auto">{data.accounts.length} accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Account</th>
                  {(data.buckets || []).map(b => (
                    <th key={b} className="px-3 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{b}</th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {data.accounts.length === 0 ? (
                  <tr>
                    <td colSpan={(data.buckets?.length || 0) + 2} className="py-12 text-center text-xs text-slate-400">
                      No outstanding balances found
                    </td>
                  </tr>
                ) : (
                  data.accounts.map((acct) => (
                    <React.Fragment key={acct.accountId}>
                      <tr
                        onClick={() => setExpanded(expanded === acct.accountId ? null : acct.accountId)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {expanded === acct.accountId
                              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            <span className="text-xs font-bold text-slate-800">{acct.accountCode} — {acct.accountName}</span>
                          </div>
                        </td>
                        {acct.bucketAmounts.map((amt, idx) => (
                          <td key={idx} className={`px-3 py-2.5 text-right text-xs ${BUCKET_COLORS[idx] || 'text-slate-700 font-mono'}`}>
                            {fmt(amt)}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-900">{fmt(acct.total)}</td>
                      </tr>

                      {expanded === acct.accountId && acct.entries && acct.entries.length > 0 && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={(data.buckets?.length || 0) + 2} className="px-6 py-3">
                            <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Transaction Details</div>
                            <table className="min-w-full text-[10px]">
                              <thead>
                                <tr className="bg-white border border-[#E2E8F0] rounded">
                                  <th className="px-3 py-1.5 text-left font-bold text-slate-500">Date</th>
                                  <th className="px-3 py-1.5 text-left font-bold text-slate-500">Description</th>
                                  <th className="px-3 py-1.5 text-right font-bold text-slate-500">Amount</th>
                                  <th className="px-3 py-1.5 text-right font-bold text-slate-500">Days</th>
                                </tr>
                              </thead>
                              <tbody>
                                {acct.entries.map((entry, i) => (
                                  <tr key={`${entry.id}-${i}`} className="border-t border-[#F1F5F9]">
                                    <td className="px-3 py-1 font-mono text-slate-600">{entry.date}</td>
                                    <td className="px-3 py-1 text-slate-700">{entry.description || '—'}</td>
                                    <td className="px-3 py-1 text-right font-mono font-semibold text-slate-800">{fmt(entry.amount)}</td>
                                    <td className={`px-3 py-1 text-right font-mono font-bold ${entry.days > 90 ? 'text-red-600' : entry.days > 60 ? 'text-orange-600' : entry.days > 30 ? 'text-amber-600' : 'text-slate-600'}`}>
                                      {entry.days}d
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
              {data.accounts.length > 0 && (
                <tfoot className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                  <tr>
                    <td className="px-4 py-3 text-right text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Grand Total</td>
                    {(data.totals || []).map((v, idx) => (
                      <td key={idx} className={`px-3 py-3 text-right text-xs font-bold ${BUCKET_COLORS[idx] || 'text-slate-900 font-mono'}`}>{fmt(v)}</td>
                    ))}
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-900">{fmt(data.grandTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center">
          <p className="text-xs text-slate-400 font-mono">Select report type and click Generate</p>
        </div>
      )}
    </div>
  );
}
