import React, { useState, useMemo, useCallback } from 'react';
import { accountingApi, BalanceSheetData, BalanceSheetLine } from '../../../../../api/accountingApi';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Scale,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (value: number, currency: string): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
};

// ─── Section Component ───────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  accentColor: 'blue' | 'rose' | 'violet';
  section: BalanceSheetData['assets'];
  currency: string;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}

const ACCENT: Record<'blue' | 'rose' | 'violet', { header: string; badge: string; total: string }> = {
  blue: {
    header: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    total: 'text-blue-700',
  },
  rose: {
    header: 'bg-rose-50 border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    total: 'text-rose-700',
  },
  violet: {
    header: 'bg-violet-50 border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
    total: 'text-violet-700',
  },
};

const BalanceSheetSection: React.FC<SectionProps> = ({
  title,
  accentColor,
  section,
  currency,
  collapsed,
  onToggle,
}) => {
  const accent = ACCENT[accentColor];

  const lineMap = useMemo(
    () => new Map(section.accounts.map((l) => [l.accountId, l])),
    [section.accounts]
  );

  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    section.accounts.forEach((l) => { if (l.parentId) ids.add(l.parentId); });
    return ids;
  }, [section.accounts]);

  const isHidden = useCallback(
    (line: BalanceSheetLine): boolean => {
      let cur = line.parentId ?? null;
      while (cur) {
        if (collapsed.has(cur)) return true;
        const parent = lineMap.get(cur);
        if (!parent) break;
        cur = parent.parentId ?? null;
      }
      return false;
    },
    [collapsed, lineMap]
  );

  const visibleLines = section.accounts.filter((l) => !isHidden(l));

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${accent.header} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest ${accent.badge}`}>
            {title}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Total</p>
          <p className={`font-mono text-sm font-bold ${accent.total}`}>
            {fmt(section.total, currency)}
          </p>
        </div>
      </div>

      {/* Lines */}
      <div className="divide-y divide-[#F1F5F9] flex-1">
        {visibleLines.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-400 text-xs">No accounts</div>
        ) : (
          visibleLines.map((line, idx) => {
            const hasChildren = parentIds.has(line.accountId);
            const indent = Math.min(line.level, 5) * 14;
            const isParent = line.isParent || hasChildren;
            const balCls = line.balance < 0 ? 'text-rose-600' : 'text-slate-800';

            return (
              <div
                key={line.accountId}
                className={`flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}`}
                style={{ paddingLeft: `${indent + 12}px` }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isParent ? (
                    <button
                      onClick={() => onToggle(line.accountId)}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 flex-shrink-0"
                    >
                      {collapsed.has(line.accountId) ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </button>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0 ml-0.5" />
                  )}
                  <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">{line.code}</span>
                  <span className={`truncate ${isParent ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                    {line.name}
                  </span>
                </div>
                <span className={`font-mono font-semibold flex-shrink-0 ml-2 ${balCls}`}>
                  {fmt(line.balance, '')}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ApexBalanceSheet() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState(today);
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await accountingApi.getBalanceSheet(asOfDate);
      const payload = (response as unknown as { data: BalanceSheetData })?.data ?? response;
      setData(payload);
      setCollapsed(new Set());
      setGenerated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load Balance Sheet.';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const currency = data?.baseCurrency ?? '';

  const difference = data
    ? Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity)
    : 0;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 flex items-end gap-4">
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
            As of Date
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
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
            <Scale size={13} />
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

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 text-center">
          <RefreshCw size={18} className="animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading Balance Sheet…</p>
        </div>
      )}

      {/* Results */}
      {generated && data && (
        <>
          {/* Meta bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              As of:
            </span>
            <span className="text-xs font-semibold text-slate-800 font-mono">{data.asOfDate}</span>
            {currency && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-mono font-bold uppercase tracking-widest">
                {currency}
              </span>
            )}
            {data.isBalanced ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold uppercase tracking-widest">
                <CheckCircle2 size={10} />
                Balanced
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-widest">
                <AlertTriangle size={10} />
                Out of Balance
              </span>
            )}
          </div>

          {/* Three-column sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BalanceSheetSection
              title="Assets"
              accentColor="blue"
              section={data.assets}
              currency={currency}
              collapsed={collapsed}
              onToggle={toggleCollapse}
            />
            <BalanceSheetSection
              title="Liabilities"
              accentColor="rose"
              section={data.liabilities}
              currency={currency}
              collapsed={collapsed}
              onToggle={toggleCollapse}
            />
            <BalanceSheetSection
              title="Equity"
              accentColor="violet"
              section={data.equity}
              currency={currency}
              collapsed={collapsed}
              onToggle={toggleCollapse}
            />
          </div>

          {/* Summary / Balance check */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Assets total */}
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Total Assets
                  </p>
                  <p className="font-mono text-lg font-bold text-blue-700">
                    {fmt(data.totalAssets, currency)}
                  </p>
                </div>
              </div>

              {/* Equals sign */}
              <div className="hidden md:flex items-center">
                <span className="text-2xl text-slate-300 font-mono">=</span>
              </div>

              {/* Liabilities + Equity */}
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Total Liabilities
                  </p>
                  <p className="font-mono text-sm font-bold text-rose-700">
                    {fmt(data.liabilities.total, currency)}
                  </p>
                </div>
                <span className="text-slate-300 font-mono">+</span>
                <div>
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Total Equity
                  </p>
                  <p className="font-mono text-sm font-bold text-violet-700">
                    {fmt(data.equity.total + (data.retainedEarnings ?? 0), currency)}
                  </p>
                </div>
                <span className="text-slate-300 font-mono">=</span>
                <div>
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Total L + E
                  </p>
                  <p className="font-mono text-lg font-bold text-slate-800">
                    {fmt(data.totalLiabilitiesAndEquity, currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Balance indicator */}
            <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
              {data.isBalanced ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded px-3 py-2 text-emerald-700 text-xs font-semibold">
                  <CheckCircle2 size={13} />
                  Balance sheet is balanced — Assets = Liabilities + Equity
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded px-3 py-2 text-amber-700 text-xs font-semibold">
                  <AlertTriangle size={13} />
                  Out of balance by{' '}
                  <span className="font-mono">{fmt(difference, currency)}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!generated && !loading && !error && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center">
          <Scale size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Balance Sheet</p>
          <p className="text-xs text-slate-400 mt-1">
            Select a date and click <strong>Generate</strong> to view the report.
          </p>
        </div>
      )}
    </div>
  );
}
