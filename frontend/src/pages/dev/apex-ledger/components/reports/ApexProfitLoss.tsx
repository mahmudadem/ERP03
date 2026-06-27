import React, { useState, useMemo } from 'react';
import { accountingApi } from '../../../../../api/accountingApi';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useTranslation } from "react-i18next";

// ─── Local Types (mirror backend shape) ─────────────────────────────────────

interface AccountRow {
  accountId: string;
  accountName: string;
  amount: number;
}

interface StructuredProfitAndLoss {
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  otherRevenue: number;
  otherExpenses: number;
  salesByAccount: AccountRow[];
  cogsByAccount: AccountRow[];
  opexByAccount: AccountRow[];
  otherRevenueByAccount: AccountRow[];
  otherExpensesByAccount: AccountRow[];
  unclassifiedRevenueByAccount: AccountRow[];
  unclassifiedExpensesByAccount: AccountRow[];
}

interface ProfitAndLossData {
  revenue: number;
  expenses: number;
  netProfit: number;
  revenueByAccount: AccountRow[];
  expensesByAccount: AccountRow[];
  period: { from: string; to: string };
  structured?: StructuredProfitAndLoss;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (value: number, currency: string): string =>
  `${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const fmtSigned = (value: number, currency: string): string =>
  `${value < 0 ? '(' : ''}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}${value < 0 ? ')' : ''}`;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  currency: string;
  variant: 'green' | 'red' | 'blue' | 'neutral';
  suffix?: string;
}

const CARD_COLORS: Record<StatCardProps['variant'], string> = {
  green: 'text-emerald-700',
  red: 'text-rose-700',
  blue: 'text-blue-700',
  neutral: 'text-slate-800',
};

const StatCard: React.FC<StatCardProps> = ({ label, value, currency, variant, suffix }) => (
  <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
      {label}
    </p>
    <p className={`font-mono text-lg font-bold ${CARD_COLORS[variant]}`}>
      {suffix ? `${Math.abs(value).toFixed(2)}${suffix}` : fmt(value, currency)}
    </p>
  </div>
);

interface BreakdownSectionProps {
  title: string;
  rows: AccountRow[];
  total: number;
  totalLabel: string;
  currency: string;
  amountColor: string;
  emptyLabel: string;
  /** If true, show amounts in parentheses for expenses */
  showParens?: boolean;
}

const BreakdownSection: React.FC<BreakdownSectionProps> = ({
  title,
  rows,
  total,
  totalLabel,
  currency,
  amountColor,
  emptyLabel,
  showParens = false,
}) => (
  <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
    <div className="bg-[#F8FAFC] px-4 py-2 border-b border-[#E2E8F0]">
      <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{title}</p>
    </div>
    {rows.length === 0 ? (
      <p className="px-4 py-4 text-xs text-slate-400 text-center">{emptyLabel}</p>
    ) : (
      <div className="divide-y divide-[#F1F5F9]">
        {rows.map((row, idx) => (
          <div
            key={`${row.accountId}-${idx}`}
            className={`flex items-center justify-between px-4 py-1.5 text-xs hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}`}
          >
            <span className="text-slate-600 truncate">{row.accountName || row.accountId}</span>
            <span className={`font-mono font-semibold flex-shrink-0 ml-4 ${amountColor}`}>
              {showParens ? fmtSigned(-Math.abs(row.amount), currency) : fmt(row.amount, currency)}
            </span>
          </div>
        ))}
      </div>
    )}
    <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
      <span className="text-xs font-bold text-slate-700">{totalLabel}</span>
      <span className={`font-mono text-sm font-bold ${amountColor}`}>
        {showParens ? fmtSigned(-Math.abs(total), currency) : fmt(total, currency)}
      </span>
    </div>
  </div>
);

interface PLRowProps {
  label: string;
  value: number;
  currency: string;
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
  color?: string;
  showParens?: boolean;
}

const PLRow: React.FC<PLRowProps> = ({
  label,
  value,
  currency,
  indent = false,
  bold = false,
  separator = false,
  color = 'text-slate-800',
  showParens = false,
}) => (
  <div
    className={`flex items-center justify-between py-2 ${separator ? 'border-t border-[#E2E8F0] mt-1' : ''} ${indent ? 'pl-6' : ''}`}
  >
    <span className={`text-xs ${bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{label}</span>
    <span className={`font-mono text-xs font-semibold ${bold ? 'text-sm font-bold' : ''} ${color}`}>
      {showParens ? fmtSigned(-Math.abs(value), currency) : fmt(value, currency)}
    </span>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ApexProfitLoss() {
    const { t } = useTranslation('common');
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(firstOfYear);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<ProfitAndLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [detailedView, setDetailedView] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await accountingApi.getProfitAndLoss(fromDate, toDate);
      setData(response as ProfitAndLossData);
      setDetailedView(false);
      setGenerated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load Profit & Loss.';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const currency = ''; // pulled from data
  const cur = data ? '' : ''; // will use baseCurrency from context if needed; fallback to USD display via fmt

  const margin = useMemo(() => {
    if (!data || data.revenue === 0) return 0;
    return (data.netProfit / data.revenue) * 100;
  }, [data]);

  const netProfitPositive = (data?.netProfit ?? 0) >= 0;
  const hasStructured = !!data?.structured;

  void currency;
  void cur;

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
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <BarChart3 size={13} />}
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
          <p className="text-xs text-slate-400">{t(`Loading Profit & Loss…`)}</p>
        </div>
      )}

      {/* Results */}
      {generated && data && (
        <>
          {/* Period badge + toggle */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                Period:
              </span>
              <span className="font-mono text-xs font-semibold text-slate-800">
                {data.period?.from ?? fromDate} → {data.period?.to ?? toDate}
              </span>
            </div>
            {hasStructured && (
              <button
                onClick={() => setDetailedView((v) => !v)}
                className="bg-white border border-[#E2E8F0] hover:bg-slate-50 text-xs font-semibold text-slate-700 px-3 py-1.5 rounded transition-colors"
              >
                {detailedView ? 'Summary View' : 'Detailed View'}
              </button>
            )}
          </div>

          {/* KPI Cards */}
          {hasStructured && data.structured ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Net Sales" value={data.structured.netSales} currency="" variant="green" />
              <StatCard label="Cost of Sales" value={data.structured.costOfSales} currency="" variant="red" />
              <StatCard
                label="Gross Profit"
                value={Math.abs(data.structured.grossProfit)}
                currency=""
                variant={data.structured.grossProfit >= 0 ? 'blue' : 'red'}
              />
              <StatCard
                label="Operating Profit"
                value={Math.abs(data.structured.operatingProfit)}
                currency=""
                variant={data.structured.operatingProfit >= 0 ? 'blue' : 'red'}
              />
              <StatCard
                label={data.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                value={Math.abs(data.netProfit)}
                currency=""
                variant={netProfitPositive ? 'blue' : 'red'}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Revenue" value={data.revenue} currency="" variant="green" />
              <StatCard label="Total Expenses" value={data.expenses} currency="" variant="red" />
              <StatCard
                label={data.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                value={Math.abs(data.netProfit)}
                currency=""
                variant={netProfitPositive ? 'blue' : 'red'}
              />
              <StatCard
                label="Profit Margin"
                value={margin}
                currency=""
                variant="neutral"
                suffix="%"
              />
            </div>
          )}

          {/* Net Profit highlight banner */}
          <div
            className={`rounded-lg px-4 py-3 flex items-center gap-3 border ${
              netProfitPositive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {netProfitPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-70">
                {netProfitPositive ? 'Net Profit' : 'Net Loss'}
              </p>
              <p className="font-mono text-xl font-black">
                {data.netProfit.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            {!hasStructured && (
              <span className="ml-auto text-xs opacity-70 font-mono">
                {t(`Margin:`)} {isFinite(margin) ? margin.toFixed(2) : '0.00'}%
              </span>
            )}
          </div>

          {/* Structured detailed view */}
          {hasStructured && data.structured && detailedView ? (
            <>
              {/* Waterfall P&L statement */}
              <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-[#E2E8F0]">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Income Statement
                  </p>
                </div>
                <div className="px-4 py-2 divide-y divide-[#F1F5F9]">
                  <PLRow label="Net Sales" value={data.structured.netSales} currency="" bold color="text-emerald-700" />
                  <PLRow label="Cost of Sales" value={data.structured.costOfSales} currency="" indent color="text-rose-700" showParens />
                  <PLRow label="Gross Profit" value={Math.abs(data.structured.grossProfit)} currency="" bold separator color={data.structured.grossProfit >= 0 ? 'text-blue-700' : 'text-rose-700'} />
                  <PLRow label="Operating Expenses" value={data.structured.operatingExpenses} currency="" indent color="text-rose-700" showParens />
                  <PLRow label="Operating Profit" value={Math.abs(data.structured.operatingProfit)} currency="" bold separator color={data.structured.operatingProfit >= 0 ? 'text-blue-700' : 'text-rose-700'} />
                  {data.structured.otherRevenue > 0 && (
                    <PLRow label="Other Revenue" value={data.structured.otherRevenue} currency="" indent color="text-emerald-700" />
                  )}
                  {data.structured.otherExpenses > 0 && (
                    <PLRow label="Other Expenses" value={data.structured.otherExpenses} currency="" indent color="text-rose-700" showParens />
                  )}
                  <PLRow
                    label={data.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                    value={Math.abs(data.netProfit)}
                    currency=""
                    bold
                    separator
                    color={netProfitPositive ? 'text-blue-700' : 'text-rose-700'}
                  />
                </div>
              </div>

              {/* Breakdown cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownSection
                  title="Sales Breakdown"
                  rows={data.structured.salesByAccount}
                  total={data.structured.netSales}
                  totalLabel="Net Sales"
                  currency=""
                  amountColor="text-emerald-700"
                  emptyLabel="No sales accounts"
                />
                <BreakdownSection
                  title="Cost of Sales Breakdown"
                  rows={data.structured.cogsByAccount}
                  total={data.structured.costOfSales}
                  totalLabel="Total COGS"
                  currency=""
                  amountColor="text-rose-700"
                  emptyLabel="No COGS accounts"
                  showParens
                />
                <BreakdownSection
                  title="Operating Expenses Breakdown"
                  rows={data.structured.opexByAccount}
                  total={data.structured.operatingExpenses}
                  totalLabel="Total OpEx"
                  currency=""
                  amountColor="text-rose-700"
                  emptyLabel="No operating expense accounts"
                  showParens
                />
                {data.structured.otherRevenueByAccount.length > 0 && (
                  <BreakdownSection
                    title="Other Revenue Breakdown"
                    rows={data.structured.otherRevenueByAccount}
                    total={data.structured.otherRevenue}
                    totalLabel="Total Other Revenue"
                    currency=""
                    amountColor="text-emerald-700"
                    emptyLabel="No other revenue"
                  />
                )}
                {data.structured.otherExpensesByAccount.length > 0 && (
                  <BreakdownSection
                    title="Other Expenses Breakdown"
                    rows={data.structured.otherExpensesByAccount}
                    total={data.structured.otherExpenses}
                    totalLabel="Total Other Expenses"
                    currency=""
                    amountColor="text-rose-700"
                    emptyLabel="No other expenses"
                    showParens
                  />
                )}
                {(data.structured.unclassifiedRevenueByAccount.length > 0 ||
                  data.structured.unclassifiedExpensesByAccount.length > 0) && (
                  <BreakdownSection
                    title="Unclassified Accounts"
                    rows={[
                      ...data.structured.unclassifiedRevenueByAccount,
                      ...data.structured.unclassifiedExpensesByAccount,
                    ]}
                    total={
                      data.structured.unclassifiedRevenueByAccount.reduce((s, r) => s + r.amount, 0) -
                      data.structured.unclassifiedExpensesByAccount.reduce((s, r) => s + r.amount, 0)
                    }
                    totalLabel="Net Unclassified Impact"
                    currency=""
                    amountColor="text-slate-700"
                    emptyLabel="No unclassified accounts"
                  />
                )}
              </div>
            </>
          ) : (
            /* Simple fallback breakdown (non-structured or summary mode) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BreakdownSection
                title="Revenue Breakdown"
                rows={data.structured ? data.structured.salesByAccount : data.revenueByAccount}
                total={data.structured ? data.structured.netSales : data.revenue}
                totalLabel="Total Revenue"
                currency=""
                amountColor="text-emerald-700"
                emptyLabel="No revenue accounts"
              />
              <BreakdownSection
                title="Expense Breakdown"
                rows={data.structured ? data.structured.cogsByAccount : data.expensesByAccount}
                total={data.structured ? data.structured.costOfSales : data.expenses}
                totalLabel="Total Expenses"
                currency=""
                amountColor="text-rose-700"
                emptyLabel="No expense accounts"
                showParens
              />
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!generated && !loading && !error && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center">
          <BarChart3 size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">{t(`Profit & Loss Statement`)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {t(`Select a date range and click`)} <strong>{t(`Generate`)}</strong> to view the report.
          </p>
        </div>
      )}
    </div>
  );
}
