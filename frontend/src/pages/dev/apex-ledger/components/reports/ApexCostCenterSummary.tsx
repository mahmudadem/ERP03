import React, { useState, useEffect, useCallback } from 'react';
import { accountingApi, CostCenterDTO } from '../../../../../api/accountingApi';
import { AlertTriangle, RefreshCw, MapPin } from 'lucide-react';
import { useTranslation } from "react-i18next";

const fmt = (v: number) => v !== 0 ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

export default function ApexCostCenterSummary() {
    const { t } = useTranslation('common');
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [costCenters, setCostCenters] = useState<CostCenterDTO[]>([]);
  const [selectedCC, setSelectedCC] = useState('');
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    accountingApi.listCostCenters().then(list => setCostCenters(list || [])).catch(console.error);
  }, []);

  const generate = useCallback(async () => {
    if (!selectedCC) return;
    setLoading(true); setError(null);
    try {
      const result = await accountingApi.getCostCenterSummary(selectedCC, fromDate, toDate);
      setData(result);
      setGenerated(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cost center summary');
      setData(null);
    } finally { setLoading(false); }
  }, [selectedCC, fromDate, toDate]);

  const ccName = costCenters.find(c => c.id === selectedCC)?.name || '';

  // Helper: parse data into revenue / expense rows
  const parseRows = (rawData: any): { label: string; debit: number; credit: number; net: number }[] => {
    if (!rawData) return [];
    // Handle array of entries
    if (Array.isArray(rawData)) {
      return rawData.map((row: any) => ({
        label: row.accountName || row.account || row.name || row.accountId || '—',
        debit: Number(row.debit || row.totalDebit || 0),
        credit: Number(row.credit || row.totalCredit || 0),
        net: Number(row.net || row.balance || 0),
      }));
    }
    // Handle object with sections
    if (rawData.entries || rawData.lines) {
      const items = rawData.entries || rawData.lines;
      return items.map((row: any) => ({
        label: row.accountName || row.account || row.name || '—',
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        net: Number(row.net || row.balance || 0),
      }));
    }
    return [];
  };

  const rows = parseRows(data);
  const totDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totCredit = rows.reduce((s, r) => s + r.credit, 0);
  const totNet = rows.reduce((s, r) => s + r.net, 0);

  return (
    <div className="space-y-4 font-sans">
      {/* Filter bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">{t(`Cost Center *`)}</label>
          <select value={selectedCC} onChange={e => setSelectedCC(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 min-w-[200px]">
            <option value="">{t(`— Select Cost Center —`)}</option>
            {costCenters.map(cc => (
              <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">{t(`From Date`)}</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">{t(`To Date`)}</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
        </div>
        <button onClick={generate} disabled={!selectedCC || loading}
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
          {/* Header */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-teal-600" />
            <div>
              <span className="text-xs font-bold text-slate-800">{ccName}</span>
              <span className="ml-2 text-[9px] font-mono text-slate-500">{fromDate} → {toDate}</span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 divide-x divide-[#E2E8F0] border-b border-[#E2E8F0]">
            {[
              { label: 'Total Debit', value: totDebit, color: 'text-blue-700' },
              { label: 'Total Credit', value: totCredit, color: 'text-emerald-700' },
              { label: 'Net', value: totNet, color: totNet < 0 ? 'text-red-600' : 'text-slate-800' },
            ].map(kpi => (
              <div key={kpi.label} className="px-5 py-3">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">{kpi.label}</span>
                <span className={`text-base font-mono font-black ${kpi.color} block mt-0.5`}>{fmt(kpi.value)}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{t(`Account`)}</th>
                  <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-36">{t(`Debit`)}</th>
                  <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-36">{t(`Credit`)}</th>
                  <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-36">{t(`Net`)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-xs text-slate-400">{t(`No entries found for this cost center and period`)}</td></tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50/60 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}`}>
                      <td className="px-4 py-2 text-xs font-medium text-slate-700">{row.label}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-blue-700">{fmt(row.debit)}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-emerald-700">{fmt(row.credit)}</td>
                      <td className={`px-4 py-2 text-right font-mono text-xs font-semibold ${row.net < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmt(row.net)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                <tr>
                  <td className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">{t(`Total`)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-blue-700">{fmt(totDebit)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-emerald-700">{fmt(totCredit)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${totNet < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmt(totNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-mono">{t(`Select a cost center and click Generate`)}</p>
        </div>
      )}
    </div>
  );
}
