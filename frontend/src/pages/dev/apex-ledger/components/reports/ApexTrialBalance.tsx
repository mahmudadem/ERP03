import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  accountingApi,
  TrialBalanceLine,
  TrialBalanceMeta,
} from '../../../../../api/accountingApi';
import {
  RefreshCw,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Scale,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TBTreeNode extends TrialBalanceLine {
  depth: number;
  children: TBTreeNode[];
  hasChildren: boolean;
  rolledClosingDebit: number;
  rolledClosingCredit: number;
}

type DisplayRow =
  | { kind: 'header'; classification: string; label: string }
  | { kind: 'account'; node: TBTreeNode }
  | {
      kind: 'subtotal';
      classification: string;
      label: string;
      closingDebit: number;
      closingCredit: number;
    };

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASSIFICATION_ORDER = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
] as const;

const CLASSIFICATION_LABELS: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};

const CLASSIFICATION_COLORS: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  ASSET:     { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  LIABILITY: { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-400' },
  EQUITY:    { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  REVENUE:   { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400' },
  EXPENSE:   { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
};

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function buildTree(lines: TrialBalanceLine[]): TBTreeNode[] {
  const nodeMap = new Map<string, TBTreeNode>();
  const roots: TBTreeNode[] = [];

  for (const line of lines) {
    nodeMap.set(line.accountId, {
      ...line,
      depth: 0,
      children: [],
      hasChildren: false,
      rolledClosingDebit: line.closingDebit,
      rolledClosingCredit: line.closingCredit,
    });
  }

  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(node);
      parent.hasChildren = true;
    } else {
      roots.push(node);
    }
  }

  const setDepthAndRollUp = (node: TBTreeNode, depth: number) => {
    node.depth = depth;
    let childDebit = 0;
    let childCredit = 0;
    for (const child of node.children) {
      setDepthAndRollUp(child, depth + 1);
      childDebit += child.rolledClosingDebit;
      childCredit += child.rolledClosingCredit;
    }
    if (node.hasChildren) {
      node.rolledClosingDebit = node.closingDebit + childDebit;
      node.rolledClosingCredit = node.closingCredit + childCredit;
    }
    node.children.sort((a, b) => a.code.localeCompare(b.code));
  };

  for (const root of roots) {
    setDepthAndRollUp(root, 0);
  }
  roots.sort((a, b) => a.code.localeCompare(b.code));
  return roots;
}

function flattenTree(nodes: TBTreeNode[], expanded: Set<string>): TBTreeNode[] {
  const result: TBTreeNode[] = [];
  const walk = (list: TBTreeNode[]) => {
    for (const node of list) {
      result.push(node);
      if (node.hasChildren && expanded.has(node.accountId)) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return result;
}

// ─── Formatter ────────────────────────────────────────────────────────────────

const fmtNum = (value: number): string =>
  value !== 0
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApexTrialBalance() {
    const { t } = useTranslation('common');
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [asOfDate, setAsOfDate] = useState(today);
  const [includeZeroBalance, setIncludeZeroBalance] = useState(false);
  const [data, setData] = useState<TrialBalanceLine[]>([]);
  const [meta, setMeta] = useState<TrialBalanceMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountingApi.getTrialBalance({
        asOfDate,
        includeZeroBalance,
      });
      const rows = result.data || [];
      setData(rows);
      setMeta(result.meta || null);
      setGenerated(true);
      // Auto-expand root parents
      const tree = buildTree(rows);
      const rootParents = tree
        .filter((n) => n.hasChildren)
        .map((n) => n.accountId);
      setExpanded(new Set(rootParents));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load trial balance';
      setError(msg);
      setData([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [asOfDate, includeZeroBalance]);

  const tree = useMemo(() => buildTree(data), [data]);

  const displayRows = useMemo((): DisplayRow[] => {
    const flat = flattenTree(tree, expanded);
    const result: DisplayRow[] = [];

    for (const cls of CLASSIFICATION_ORDER) {
      const rows = flat.filter((node) => node.classification === cls);
      if (rows.length === 0) continue;

      result.push({
        kind: 'header',
        classification: cls,
        label: CLASSIFICATION_LABELS[cls] || cls,
      });
      for (const node of rows) {
        result.push({ kind: 'account', node });
      }

      const rootsInCls = tree.filter((node) => node.classification === cls);
      const subtotalDebit = rootsInCls.reduce(
        (sum, node) => sum + node.rolledClosingDebit,
        0
      );
      const subtotalCredit = rootsInCls.reduce(
        (sum, node) => sum + node.rolledClosingCredit,
        0
      );
      result.push({
        kind: 'subtotal',
        classification: cls,
        label: `Total ${CLASSIFICATION_LABELS[cls] || cls}`,
        closingDebit: subtotalDebit,
        closingCredit: subtotalCredit,
      });
    }
    return result;
  }, [tree, expanded]);

  const toggleExpand = useCallback((accountId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allParents = new Set<string>();
    const collect = (nodes: TBTreeNode[]) => {
      for (const node of nodes) {
        if (node.hasChildren) {
          allParents.add(node.accountId);
          collect(node.children);
        }
      }
    };
    collect(tree);
    setExpanded(allParents);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const handleDrillDown = useCallback(
    (accountId: string) => {
      navigate(
        `/dev/apex-ledger/reports/account-statement?accountId=${accountId}`
      );
    },
    [navigate]
  );

  return (
    <div className="space-y-4 font-sans">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* As Of Date */}
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
              As of Date
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
            />
          </div>

          {/* Include Zero Balance */}
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Options
            </label>
            <label className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition">
              <input
                type="checkbox"
                checked={includeZeroBalance}
                onChange={(e) => setIncludeZeroBalance(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Include Zero Balances
              </span>
            </label>
          </div>

          {/* Generate */}
          <button
            onClick={generate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Scale className="w-3.5 h-3.5" />
            )}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {generated && !error && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
          {/* Toolbar */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                Trial Balance
              </span>
              <span className="text-[9px] font-mono text-slate-400">—</span>
              <span className="text-[9px] font-mono font-bold text-slate-600">
                {asOfDate}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={expandAll}
                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition"
              >
                <ChevronsUpDown className="w-3 h-3" />
                Expand All
              </button>
              <span className="text-slate-300 text-xs">|</span>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition"
              >
                <ChevronsDownUp className="w-3 h-3" />
                Collapse All
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="px-4 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-28">
                    Code
                  </th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Account Name
                  </th>
                  <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-40">
                    Closing Debit
                  </th>
                  <th className="px-4 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-40">
                    Closing Credit
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F5F9]">
                {loading ? (
                  /* Skeleton */
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}>
                      <td className="px-4 py-2.5">
                        <div className="h-3 bg-slate-100 rounded animate-pulse w-16" />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-3 bg-slate-100 rounded animate-pulse w-48" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="h-3 bg-slate-100 rounded animate-pulse w-20 ml-auto" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="h-3 bg-slate-100 rounded animate-pulse w-20 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <Scale className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">{t(`No accounts to display`)}</p>
                    </td>
                  </tr>
                ) : (
                  displayRows.map((item, idx) => {
                    /* Classification header row */
                    if (item.kind === 'header') {
                      const colors =
                        CLASSIFICATION_COLORS[item.classification] || {
                          bg: 'bg-slate-50',
                          text: 'text-slate-700',
                          dot: 'bg-slate-400',
                        };
                      return (
                        <tr key={`h-${item.classification}`} className={colors.bg}>
                          <td
                            colSpan={4}
                            className={`px-4 py-2 ${colors.text}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                                {item.label}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    /* Subtotal row */
                    if (item.kind === 'subtotal') {
                      return (
                        <tr
                          key={`s-${item.classification}`}
                          className="bg-[#F8FAFC] border-t border-[#E2E8F0]"
                        >
                          <td
                            colSpan={2}
                            className="px-4 py-2 text-right text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest"
                          >
                            {item.label}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs font-bold text-slate-800">
                            {fmtNum(item.closingDebit)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs font-bold text-slate-800">
                            {fmtNum(item.closingCredit)}
                          </td>
                        </tr>
                      );
                    }

                    /* Account row */
                    const node = item.node;
                    const isExpanded = expanded.has(node.accountId);
                    const isParent = node.hasChildren;
                    const indent = node.depth * 16;
                    const isEven = idx % 2 === 0;

                    return (
                      <tr
                        key={node.accountId}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isParent
                            ? 'bg-amber-50/60'
                            : isEven
                            ? 'bg-white'
                            : 'bg-[#FAFAFB]'
                        }`}
                      >
                        {/* Code */}
                        <td className="px-4 py-2 text-xs font-mono text-slate-500">
                          <span style={{ paddingLeft: indent }}>{node.code}</span>
                        </td>

                        {/* Name + expand toggle */}
                        <td className="px-4 py-2 text-xs">
                          <div
                            className="flex items-center gap-1"
                            style={{ paddingLeft: indent }}
                          >
                            {isParent ? (
                              <button
                                onClick={() => toggleExpand(node.accountId)}
                                className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 shrink-0 transition"
                              >
                                <ChevronRight
                                  className={`w-3 h-3 transition-transform ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`}
                                />
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}

                            <button
                              onClick={() => handleDrillDown(node.accountId)}
                              className={`text-left hover:text-blue-600 hover:underline truncate transition ${
                                isParent
                                  ? 'font-bold text-slate-800'
                                  : 'font-medium text-slate-700'
                              }`}
                              title={`View statement for ${node.code} — ${node.name}`}
                            >
                              {node.name}
                            </button>

                            {isParent && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wide shrink-0">
                                Group
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Closing Debit */}
                        <td
                          className={`px-4 py-2 text-right font-mono text-xs ${
                            isParent
                              ? 'font-bold text-slate-800'
                              : 'text-slate-700'
                          }`}
                        >
                          {fmtNum(
                            isParent ? node.rolledClosingDebit : node.closingDebit
                          )}
                        </td>

                        {/* Closing Credit */}
                        <td
                          className={`px-4 py-2 text-right font-mono text-xs ${
                            isParent
                              ? 'font-bold text-slate-800'
                              : 'text-slate-700'
                          }`}
                        >
                          {fmtNum(
                            isParent
                              ? node.rolledClosingCredit
                              : node.closingCredit
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Footer — grand total + balanced indicator */}
              {meta && data.length > 0 && (
                <tfoot className="border-t-2 border-[#E2E8F0] bg-white">
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-right text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest"
                    >
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-900">
                      {meta.totalClosingDebit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-900">
                      {meta.totalClosingCredit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                  <tr className="border-t border-[#F1F5F9]">
                    <td colSpan={4} className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        {meta.isBalanced ? (
                          <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Balanced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                            <AlertTriangle className="w-3 h-3" />
                            {t(`Unbalanced — Diff:`)}{' '}
                            {meta.difference.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
