import React, { useState } from 'react';
import { accountingApi } from '../../../../../api/accountingApi';
import { RefreshCw, AlertTriangle, ShoppingCart, Info } from 'lucide-react';

// ─── Local Types ─────────────────────────────────────────────────────────────

interface AccountRow {
  accountId: string;
  accountName: string;
  amount: number;
}

interface TradingAccountData {
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  grossProfitMargin: number;
  salesByAccount: AccountRow[];
  cogsByAccount: AccountRow[];
  period: { from: string; to: string };
  hasData: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (value: number): string =>
  Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TradingColumnProps {
  title: string;
  rows: AccountRow[];
  total: number;
  totalLabel: string;
  emptyLabel: string;
  side: 'credit' | 'debit';
}

/**
 * Renders one side of the traditional T-account trading layout.
 * Left side (debit) = Cost of Goods / Purchases side.
 * Right side (credit) = Sales / Income side.
 */
const TradingColumn: React.FC<TradingColumnProps> = ({
  title,
  rows,
  total,
  totalLabel,
  emptyLabel,
  side,
}) => {
  const borderAccent = side === 'credit' ? 'border-emerald-200' : 'border-rose-200';
  const headerBg = side === 'credit' ? 'bg-emerald-50' : 'bg-rose-50';
  const titleColor = side === 'credit' ? 'text-emerald-700' : 'text-rose-700';
  const amountColor = side === 'credit' ? 'text-emerald-700' : 'text-rose-700';
  const totalBg = side === 'credit' ? 'bg-emerald-50' : 'bg-rose-50';

  return (
    <div className={`bg-white border ${borderAccent} rounded-lg overflow-hidden flex flex-col`}>
      {/* Column header */}
      <div className={`px-4 py-2.5 ${headerBg} border-b ${borderAccent}`}>
        <p className={`text-[9px] font-mono font-bold uppercase tracking-widest ${titleColor}`}>
          {title}
        </p>
      </div>

      {/* Row items */}
      <div className="flex-1 divide-y divide-[#F1F5F9]">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">{emptyLabel}</p>
        ) : (
          rows.map((row, idx) => (
            <div
              key={`${row.accountId}-${idx}`}
              className={`flex items-center justify-between px-4 py-1.5 text-xs hover:bg-slate-50/50 ${
                idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'
              }`}
            >
              <span className="text-slate-600 truncate max-w-[60%]">
                {row.accountName || row.accountId}
              </span>
              <span className={`font-mono font-semibold flex-shrink-0 ml-2 ${amountColor}`}>
                {fmt(row.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Total footer */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-t ${borderAccent} ${totalBg}`}
      >
        <span className="text-xs font-bold text-slate-700">{totalLabel}</span>
        <span className={`font-mono text-sm font-bold ${amountColor}`}>{fmt(total)}</span>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ApexTradingAccount() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(firstOfYear);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<TradingAccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await accountingApi.getTradingAccount(fromDate, toDate);
      setData(response as TradingAccountData);
      setGenerated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load Trading Account.';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const gpPositive = (data?.grossProfit ?? 0) >= 0;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <ShoppingCart size={13} />
          )}
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-white border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-red-600 text-xs">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 text-center">
          <RefreshCw size={18} className="animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading Trading Account…</p>
        </div>
      )}

      {/* Results */}
      {generated && data && (
        <>
          {data.hasData ? (
            <>
              {/* Period badge */}
              <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Period:
                </span>
                <span className="font-mono text-xs font-semibold text-slate-800">
                  {data.period?.from ?? fromDate} → {data.period?.to ?? toDate}
                </span>
              </div>

              {/* KPI summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Net Sales */}
                <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Net Sales
                  </p>
                  <p className="font-mono text-lg font-bold text-emerald-700">{fmt(data.netSales)}</p>
                </div>

                {/* Cost of Sales */}
                <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Cost of Sales
                  </p>
                  <p className="font-mono text-lg font-bold text-rose-700">{fmt(data.costOfSales)}</p>
                </div>

                {/* Gross Profit */}
                <div
                  className={`border rounded-lg p-4 ${
                    gpPositive
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                    {gpPositive ? 'Gross Profit' : 'Gross Loss'}
                  </p>
                  <p
                    className={`font-mono text-lg font-black ${
                      gpPositive ? 'text-blue-700' : 'text-rose-700'
                    }`}
                  >
                    {fmt(Math.abs(data.grossProfit))}
                  </p>
                </div>

                {/* GP Margin */}
                <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                    GP Margin
                  </p>
                  <p className="font-mono text-lg font-bold text-slate-800">
                    {isFinite(data.grossProfitMargin) ? data.grossProfitMargin.toFixed(2) : '0.00'}%
                  </p>
                </div>
              </div>

              {/* Traditional T-Account two-column layout */}
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Trading Account — T Format
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Debit side: Cost of Sales */}
                  <TradingColumn
                    title="Dr — Cost of Sales (Expenses Side)"
                    rows={data.cogsByAccount}
                    total={data.costOfSales}
                    totalLabel="Total Cost of Sales"
                    emptyLabel="No cost of sales accounts in this period"
                    side="debit"
                  />

                  {/* Credit side: Sales */}
                  <TradingColumn
                    title="Cr — Sales (Revenue Side)"
                    rows={data.salesByAccount}
                    total={data.netSales}
                    totalLabel="Total Net Sales"
                    emptyLabel="No sales accounts in this period"
                    side="credit"
                  />
                </div>

                {/* Gross profit balancing row */}
                <div
                  className={`mt-4 border rounded-lg px-4 py-3 flex items-center justify-between ${
                    gpPositive
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <div>
                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                      {gpPositive ? 'Gross Profit c/d' : 'Gross Loss c/d'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Net Sales − Cost of Sales
                    </p>
                  </div>
                  <p
                    className={`font-mono text-2xl font-black ${
                      gpPositive ? 'text-blue-700' : 'text-rose-700'
                    }`}
                  >
                    {fmt(Math.abs(data.grossProfit))}
                  </p>
                </div>

                {/* Balance check row */}
                <div className="mt-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2.5 grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-rose-400 uppercase tracking-widest">
                      Dr Total
                    </span>
                    <span className="font-mono text-xs font-bold text-rose-700">
                      {fmt(gpPositive ? data.costOfSales + data.grossProfit : data.costOfSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                      Cr Total
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-700">
                      {fmt(data.netSales)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* No data configured warning */
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-4 flex items-start gap-3">
              <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  No Sales or COGS accounts configured.
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Assign P&L Subgroups in Chart of Accounts to enable this report. Go to{' '}
                  <strong>Chart of Accounts → Account → P&L Subgroup</strong> and set accounts to{' '}
                  <code className="bg-amber-100 px-1 rounded">SALES</code> or{' '}
                  <code className="bg-amber-100 px-1 rounded">COST_OF_SALES</code>.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!generated && !loading && !error && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center">
          <ShoppingCart size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Trading Account</p>
          <p className="text-xs text-slate-400 mt-1">
            Select a date range and click <strong>Generate</strong> to view the report.
          </p>
        </div>
      )}
    </div>
  );
}
