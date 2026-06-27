import i18n from 'i18next';
import React, { useState, useCallback } from 'react';
import { accountingApi } from '../../../../../api/accountingApi';
import { TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3, AlertTriangle } from 'lucide-react';
import { useTranslation } from "react-i18next";

/* ── Types ─────────────────────────────────────────────── */

interface CashFlowItem {
  name: string;
  amount: number;
  accountId?: string;
}

interface CashFlowSection {
  items: CashFlowItem[];
  total: number;
}

interface CashFlowResponse {
  period: { from: string; to: string };
  baseCurrency: string;
  netIncome: number;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  openingCashBalance: number;
  closingCashBalance: number;
}

/* ── Helpers ────────────────────────────────────────────── */

const fmt = (n: number, currency?: string) =>
  `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

/* ── Section Component ──────────────────────────────────── */

interface SectionProps {
  title: string;
  subtitle: string;
  total: number;
  items: CashFlowItem[];
  currency: string;
  accentClass: string;
  totalAccentClass: string;
}

const CashFlowSectionCard: React.FC<SectionProps> = ({
  title,
  subtitle,
  total,
  items,
  currency,
  accentClass,
  totalAccentClass,
}) => (
  <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
    {/* Card header */}
    <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
      <div>
        <p className="text-xs font-bold text-slate-800">{title}</p>
        <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</p>
      </div>
      <span className={`font-mono text-sm font-bold ${totalAccentClass}`}>
        {fmt(total, currency)}
      </span>
    </div>

    {/* Items table */}
    <table className="w-full">
      <thead>
        <tr className="bg-[#F8FAFC]">
          <th className="text-left px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{i18n.t(`Item`)}</th>
          <th className="text-right px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{i18n.t(`Amount`)}</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={2} className="px-4 py-4 text-center text-xs text-slate-400">
              No items in this section
            </td>
          </tr>
        ) : (
          items.map((item, idx) => (
            <tr
              key={`${item.accountId ?? item.name}-${idx}`}
              className={`border-t border-[#E2E8F0] hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}`}
            >
              <td className="px-4 py-2 text-xs text-slate-700">{item.name}</td>
              <td className={`px-4 py-2 text-right font-mono text-xs font-semibold ${accentClass}`}>
                {fmt(item.amount)}
              </td>
            </tr>
          ))
        )}
      </tbody>
      {/* Section total row */}
      {items.length > 0 && (
        <tfoot>
          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <td className="px-4 py-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{i18n.t(`Total`)}</td>
            <td className={`px-4 py-2 text-right font-mono text-xs font-bold ${totalAccentClass}`}>
              {fmt(total, currency)}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);

/* ── Main Component ─────────────────────────────────────── */

export default function ApexCashFlow() {
    const { t } = useTranslation('common');
  const [fromDate, setFromDate] = useState(yearStart());
  const [toDate, setToDate] = useState(today());
  const [data, setData] = useState<CashFlowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generate = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await accountingApi.getCashFlow(fromDate, toDate);
      setData(result as CashFlowResponse);
      setGenerated(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load cash flow report';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const currency = data?.baseCurrency ?? '';
  const netChange = data?.netCashChange ?? 0;
  const netChangePositive = netChange >= 0;

  return (
    <div className="space-y-4 font-sans">

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-slate-800">{i18n.t(`Cash Flow Statement`)}</span>
          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest ml-2">{i18n.t(`Indirect Method`)}</span>
        </div>
        <div className="px-4 py-3 flex items-end space-x-4 flex-wrap gap-y-3">
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 font-mono"
            />
          </div>
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 font-mono"
            />
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BarChart3 className="w-3.5 h-3.5" />
            )}
            <span>{loading ? 'Generating…' : 'Generate'}</span>
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

      {/* ── Loading skeleton ────────────────────────────────── */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {generated && !loading && data && (
        <div className="space-y-4">

          {/* Period + currency badges */}
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <span className="inline-flex items-center px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[10px] font-bold text-blue-700 font-mono">
              {data.period?.from ?? fromDate} → {data.period?.to ?? toDate}
            </span>
            {currency && (
              <span className="inline-flex items-center px-3 py-1 bg-slate-50 border border-[#E2E8F0] rounded-full text-[10px] font-bold text-slate-500 font-mono">
                {currency}
              </span>
            )}
          </div>

          {/* Summary card */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{i18n.t(`Summary`)}</p>
            </div>
            <div className="divide-y divide-[#E2E8F0]">
              {[
                { label: 'Net Income', value: data.netIncome },
                { label: 'Opening Cash Balance', value: data.openingCashBalance },
                { label: 'Closing Cash Balance', value: data.closingCashBalance },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="font-mono text-xs font-semibold text-slate-800">{fmt(row.value, currency)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Three activity sections */}
          <CashFlowSectionCard
            title="Operating Activities"
            subtitle="Core business operations"
            total={data.operating.total}
            items={data.operating.items}
            currency={currency}
            accentClass="text-slate-700"
            totalAccentClass={data.operating.total >= 0 ? 'text-emerald-700' : 'text-red-700'}
          />
          <CashFlowSectionCard
            title="Investing Activities"
            subtitle="Asset purchases & disposals"
            total={data.investing.total}
            items={data.investing.items}
            currency={currency}
            accentClass="text-slate-700"
            totalAccentClass={data.investing.total >= 0 ? 'text-emerald-700' : 'text-red-700'}
          />
          <CashFlowSectionCard
            title="Financing Activities"
            subtitle="Debt & equity transactions"
            total={data.financing.total}
            items={data.financing.items}
            currency={currency}
            accentClass="text-slate-700"
            totalAccentClass={data.financing.total >= 0 ? 'text-emerald-700' : 'text-red-700'}
          />

          {/* Net change — highlighted */}
          <div className={`rounded-lg border-2 p-4 flex items-center justify-between ${
            netChangePositive
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              {netChangePositive ? (
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              ) : netChange < 0 ? (
                <TrendingDown className="w-5 h-5 text-red-600" />
              ) : (
                <Minus className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{i18n.t(`Net Change in Cash`)}</p>
                <p className="text-xs text-slate-600 mt-0.5">{i18n.t(`Operating + Investing + Financing`)}</p>
              </div>
            </div>
            <span className={`font-mono text-xl font-bold ${netChangePositive ? 'text-emerald-700' : 'text-red-700'}`}>
              {netChangePositive ? '+' : ''}{fmt(netChange, currency)}
            </span>
          </div>

        </div>
      )}

      {/* ── Empty (not yet generated) ────────────────────── */}
      {!generated && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center py-16 space-y-3">
          <BarChart3 className="w-8 h-8 text-slate-300" />
          <p className="text-xs font-semibold text-slate-400">{i18n.t(`Set a date range and click Generate`)}</p>
        </div>
      )}

    </div>
  );
}
