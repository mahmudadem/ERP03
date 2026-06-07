import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { accountingApi, BudgetDTO, FiscalYearDTO, CostCenterDTO } from '../../../../../api/accountingApi';
import { AlertTriangle, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function varianceColor(variance: number): string {
  if (variance < 0) return 'text-red-600';
  if (variance > 0) return 'text-emerald-600';
  return 'text-slate-500';
}

function VarianceIcon({ variance }: { variance: number }) {
  if (variance < 0) return <TrendingDown className="w-3 h-3 text-red-500 inline" />;
  if (variance > 0) return <TrendingUp className="w-3 h-3 text-emerald-500 inline" />;
  return <Minus className="w-3 h-3 text-slate-400 inline" />;
}

export default function ApexBudgetVsActual() {
  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearDTO[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterDTO[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [selectedCCId, setSelectedCCId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showMonthly, setShowMonthly] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    Promise.all([
      accountingApi.listBudgets(),
      accountingApi.listFiscalYears(),
      accountingApi.listCostCenters(),
    ]).then(([bList, fyList, ccList]) => {
      const sorted = [...bList].sort((a, b) => {
        if (a.status === b.status) return b.version - a.version;
        if (a.status === 'APPROVED') return -1;
        if (b.status === 'APPROVED') return 1;
        return b.version - a.version;
      });
      setBudgets(sorted);
      setFiscalYears(fyList);
      setCostCenters(ccList.filter(cc => cc.status === 'ACTIVE'));
      if (sorted.length > 0) {
        const preferred = sorted.find(b => b.status === 'APPROVED') || sorted[0];
        setSelectedBudgetId(preferred.id);
        const fy = fyList.find(f => f.id === preferred.fiscalYearId);
        if (fy) { setFromDate(fy.startDate); setToDate(fy.endDate); }
      }
    }).catch(console.error).finally(() => setLoadingMeta(false));
  }, []);

  // Update dates when budget changes
  useEffect(() => {
    const budget = budgets.find(b => b.id === selectedBudgetId);
    if (!budget) return;
    const fy = fiscalYears.find(f => f.id === budget.fiscalYearId);
    if (fy && !fromDate) { setFromDate(fy.startDate); setToDate(fy.endDate); }
  }, [selectedBudgetId, budgets, fiscalYears]); // eslint-disable-line

  const generate = useCallback(async () => {
    const budget = budgets.find(b => b.id === selectedBudgetId);
    if (!budget) return;
    const fy = fiscalYears.find(f => f.id === budget.fiscalYearId);
    if (!fy) return;

    setLoading(true); setError(null);
    try {
      // Load accounts for labels
      const accounts = await accountingApi.getAccounts();
      const accountMap = new Map(accounts.map(a => [a.id, a]));

      // Load actual ledger entries
      const pageSize = 500;
      let allEntries: any[] = [];
      let offset = 0, guard = 0, totalItems = Infinity;
      while (offset < totalItems && guard < 50) {
        const res: any = await accountingApi.getGeneralLedger(undefined, fy.startDate, fy.endDate, pageSize, offset, selectedCCId || undefined);
        const page = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        allEntries.push(...page);
        const reported = res?.meta?.pagination?.totalItems ?? res?.meta?.totalItems ?? null;
        if (reported !== null) totalItems = Number(reported);
        else if (page.length < pageSize) totalItems = offset + page.length;
        if (page.length === 0) break;
        offset += page.length;
        guard++;
      }

      // Build fiscal month map
      const fiscalStart = new Date(fy.startDate);
      const getMonthIdx = (dateStr: string) => {
        const d = new Date(dateStr);
        return (d.getFullYear() - fiscalStart.getFullYear()) * 12 + (d.getMonth() - fiscalStart.getMonth());
      };

      // Get range month indexes
      const rangeStart = new Date(fromDate || fy.startDate);
      const rangeEnd = new Date(toDate || fy.endDate);
      const monthIdxInRange: number[] = [];
      for (let i = 0; i < 12; i++) {
        const ms = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + i, 1);
        const me = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + i + 1, 0);
        if (me >= rangeStart && ms <= rangeEnd) monthIdxInRange.push(i);
      }

      // Aggregate actuals by accountId
      const actualByAccount = new Map<string, number[]>();
      for (const entry of allEntries) {
        if (!entry.accountId || !entry.date) continue;
        if (entry.date < (fromDate || fy.startDate) || entry.date > (toDate || fy.endDate)) continue;
        if (selectedCCId && entry.costCenterId !== selectedCCId) continue;
        const mi = getMonthIdx(entry.date);
        if (mi < 0 || mi > 11) continue;
        const arr = actualByAccount.get(entry.accountId) || Array(12).fill(0);
        const amount = (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
        arr[mi] = round2(arr[mi] + amount);
        actualByAccount.set(entry.accountId, arr);
      }

      // Build rows from budget lines
      const budgetLines = (budget.lines || []).filter((l: any) =>
        !selectedCCId || l.costCenterId === selectedCCId
      );

      const reportRows = budgetLines.map((line: any) => {
        const monthlyBudget: number[] = Array.from({ length: 12 }, (_, i) => Number((line.monthlyAmounts || [])[i] || 0));
        const monthlyActual = actualByAccount.get(line.accountId) || Array(12).fill(0);
        const budget = round2(monthIdxInRange.reduce((s, i) => s + monthlyBudget[i], 0));
        const actual = round2(monthIdxInRange.reduce((s, i) => s + monthlyActual[i], 0));
        const variance = round2(budget - actual);
        const variancePct = budget === 0 ? 0 : round2((variance / budget) * 100);
        const acct = accountMap.get(line.accountId);
        return {
          accountLabel: acct ? `${acct.userCode || acct.code} — ${acct.name}` : line.accountId,
          budget, actual, variance, variancePct,
          monthlyBudget, monthlyActual,
        };
      });

      reportRows.sort((a: any, b: any) => a.accountLabel.localeCompare(b.accountLabel));
      setRows(reportRows);
      setGenerated(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load budget vs actual');
      setRows([]);
    } finally { setLoading(false); }
  }, [selectedBudgetId, selectedCCId, fromDate, toDate, budgets, fiscalYears]);

  const summary = useMemo(() => rows.reduce(
    (acc, row) => ({ budget: round2(acc.budget + row.budget), actual: round2(acc.actual + row.actual), variance: round2(acc.variance + row.variance) }),
    { budget: 0, actual: 0, variance: 0 }
  ), [rows]);

  if (loadingMeta) {
    return <div className="flex items-center justify-center h-48"><RefreshCw className="w-5 h-5 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Filter bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Budget</label>
          <select value={selectedBudgetId} onChange={e => setSelectedBudgetId(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 min-w-[200px]">
            <option value="">— Select Budget —</option>
            {budgets.map(b => (
              <option key={b.id} value={b.id}>{b.name} v{b.version} ({b.status})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Cost Center</label>
          <select value={selectedCCId} onChange={e => setSelectedCCId(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400">
            <option value="">All Cost Centers</option>
            {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 pb-1.5 cursor-pointer">
          <input type="checkbox" checked={showMonthly} onChange={e => setShowMonthly(e.target.checked)}
            className="rounded border-slate-300 text-blue-600" />
          Monthly Breakdown
        </label>
        <button onClick={generate} disabled={!selectedBudgetId || loading}
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

      {generated && !loading && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Budget', value: summary.budget, color: 'text-blue-700' },
              { label: 'Total Actual', value: summary.actual, color: 'text-slate-800' },
              { label: 'Total Variance', value: summary.variance, color: varianceColor(summary.variance) },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white border border-[#E2E8F0] rounded-lg p-4">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">{kpi.label}</span>
                <span className={`text-base font-mono font-black block mt-1 ${kpi.color}`}>{fmt(kpi.value)}</span>
              </div>
            ))}
          </div>

          {/* Main table */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Account</th>
                    <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-36">Budget</th>
                    <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-36">Actual</th>
                    <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-36">Variance</th>
                    <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-24">Var %</th>
                    <th className="px-4 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-xs text-slate-400">No budget lines found</td></tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50/60 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}`}>
                        <td className="px-4 py-2 text-xs font-medium text-slate-700 max-w-xs truncate">{row.accountLabel}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-blue-700">{fmt(row.budget)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-slate-700">{fmt(row.actual)}</td>
                        <td className={`px-4 py-2 text-right font-mono text-xs font-bold ${varianceColor(row.variance)}`}>
                          {fmt(row.variance)}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono text-xs font-bold ${varianceColor(row.variance)}`}>
                          {row.variancePct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase ${varianceColor(row.variance)}`}>
                            <VarianceIcon variance={row.variance} />
                            {row.variance < 0 ? 'Over' : row.variance > 0 ? 'Under' : 'On target'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                  <tr>
                    <td className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Total</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-blue-700">{fmt(summary.budget)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-800">{fmt(summary.actual)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${varianceColor(summary.variance)}`}>{fmt(summary.variance)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${varianceColor(summary.variance)}`}>
                      {summary.budget === 0 ? '—' : `${((summary.variance / summary.budget) * 100).toFixed(1)}%`}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {!generated && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center">
          <p className="text-xs text-slate-400 font-mono">Select a budget and click Generate</p>
        </div>
      )}
    </div>
  );
}
