import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../components/shared/DatePicker';
import { Button } from '../../../components/ui/Button';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { accountingApi, TrialBalanceLine, TrialBalanceMeta } from '../../../api/accountingApi';
import { formatCompanyDate, getCompanyToday } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { exportToExcel } from '../../../utils/exportUtils';

const CLASSIFICATION_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

interface TrialBalanceParams {
  asOfDate: string;
  includeZeroBalance: boolean;
}

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
  | { kind: 'subtotal'; classification: string; label: string; closingDebit: number; closingCredit: number };

const buildTree = (lines: TrialBalanceLine[]): TBTreeNode[] => {
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
};

const flattenTree = (nodes: TBTreeNode[], expanded: Set<string>): TBTreeNode[] => {
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
};

const TrialBalanceInitiator: React.FC<{
  onSubmit: (params: TrialBalanceParams) => void;
  initialParams?: TrialBalanceParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const [asOfDate, setAsOfDate] = useState(() => initialParams?.asOfDate || getCompanyToday(settings));
  const [includeZeroBalance, setIncludeZeroBalance] = useState(initialParams?.includeZeroBalance || false);

  useEffect(() => {
    if (!initialParams) {
      setAsOfDate(getCompanyToday(settings));
      setIncludeZeroBalance(false);
      return;
    }
    setAsOfDate(initialParams.asOfDate);
    setIncludeZeroBalance(initialParams.includeZeroBalance);
  }, [initialParams, settings]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ asOfDate, includeZeroBalance });
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t('trialBalance.asOfDate')}
          </label>
          <DatePicker value={asOfDate} onChange={setAsOfDate} className="w-full" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 mb-1">
          <input
            type="checkbox"
            checked={includeZeroBalance}
            onChange={(e) => setIncludeZeroBalance(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          {t('trialBalance.includeZero')}
        </label>
        <div>
          <Button type="submit" className="bg-slate-900 hover:bg-black text-white">
            {t('trialBalance.generate')}
          </Button>
        </div>
      </div>
    </form>
  );
};

const TrialBalanceReportContent: React.FC<{ params: TrialBalanceParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const navigate = useNavigate();
  const [data, setData] = useState<TrialBalanceLine[]>([]);
  const [meta, setMeta] = useState<TrialBalanceMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await accountingApi.getTrialBalance({
          asOfDate: params.asOfDate,
          includeZeroBalance: params.includeZeroBalance,
        });
        setData(result.data || []);
        setMeta(result.meta || null);

        const tree = buildTree(result.data || []);
        const rootParents = tree.filter((node) => node.hasChildren).map((node) => node.accountId);
        setExpanded(new Set(rootParents));
      } catch (err: any) {
        setError(err?.message || t('trialBalance.loadError'));
        setData([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.asOfDate, params.includeZeroBalance, t]);

  const tree = useMemo(() => buildTree(data), [data]);

  const classificationLabels = useMemo(
    () => ({
      ASSET: t('trialBalance.classifications.asset'),
      LIABILITY: t('trialBalance.classifications.liability'),
      EQUITY: t('trialBalance.classifications.equity'),
      REVENUE: t('trialBalance.classifications.revenue'),
      EXPENSE: t('trialBalance.classifications.expense'),
    }),
    [t]
  );

  const displayRows = useMemo((): DisplayRow[] => {
    const flat = flattenTree(tree, expanded);
    const result: DisplayRow[] = [];

    for (const cls of CLASSIFICATION_ORDER) {
      const rows = flat.filter((node) => node.classification === cls);
      if (rows.length === 0) continue;

      result.push({ kind: 'header', classification: cls, label: classificationLabels[cls] || cls });
      for (const node of rows) {
        result.push({ kind: 'account', node });
      }

      const rootsInCls = tree.filter((node) => node.classification === cls);
      const subtotalDebit = rootsInCls.reduce((sum, node) => sum + node.rolledClosingDebit, 0);
      const subtotalCredit = rootsInCls.reduce((sum, node) => sum + node.rolledClosingCredit, 0);
      result.push({
        kind: 'subtotal',
        classification: cls,
        label: t('trialBalance.totalFor', { name: classificationLabels[cls] || cls }),
        closingDebit: subtotalDebit,
        closingCredit: subtotalCredit,
      });
    }

    return result;
  }, [classificationLabels, expanded, t, tree]);

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
      navigate(`/accounting/reports/account-statement?accountId=${accountId}`);
    },
    [navigate]
  );

  const fmtNum = (value: number) =>
    value !== 0
      ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '-';

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center gap-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {t('trialBalance.asOfInline', { date: formatCompanyDate(params.asOfDate, settings) })}
        </span>
        <span className="text-xs text-slate-500">
          {params.includeZeroBalance ? t('trialBalance.includeZero') : t('trialBalance.excludeZero', { defaultValue: 'Exclude Zero Balances' })}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={expandAll} className="text-xs font-semibold text-blue-700 hover:underline">
            {t('trialBalance.expandAll')}
          </button>
          <span className="text-slate-300">|</span>
          <button onClick={collapseAll} className="text-xs font-semibold text-blue-700 hover:underline">
            {t('trialBalance.collapseAll')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="min-w-full">
          <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-28">{t('trialBalance.code')}</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('trialBalance.accountName')}</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-44">{t('trialBalance.closingDebit')}</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-44">{t('trialBalance.closingCredit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-slate-500">
                  {t('trialBalance.loading')}
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-slate-400">
                  {t('trialBalance.noData')}
                </td>
              </tr>
            ) : (
              displayRows.map((item) => {
                if (item.kind === 'header') {
                  return (
                    <tr key={`h-${item.classification}`} className="bg-blue-50/60">
                      <td colSpan={4} className="px-5 py-2.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
                        {item.label}
                      </td>
                    </tr>
                  );
                }

                if (item.kind === 'subtotal') {
                  return (
                    <tr key={`s-${item.classification}`} className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={2} className="px-5 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {item.label}
                      </td>
                      <td className="px-5 py-2 text-right font-mono text-sm font-bold text-slate-900">{fmtNum(item.closingDebit)}</td>
                      <td className="px-5 py-2 text-right font-mono text-sm font-bold text-slate-900">{fmtNum(item.closingCredit)}</td>
                    </tr>
                  );
                }

                const node = item.node;
                const isExpanded = expanded.has(node.accountId);
                const isParent = node.hasChildren;
                const indent = node.depth * 20;

                return (
                  <tr key={node.accountId} className={`hover:bg-slate-50 transition-colors ${isParent ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-5 py-2.5 text-sm font-mono text-slate-500">
                      <span style={{ paddingLeft: indent }}>{node.code}</span>
                    </td>
                    <td className="px-5 py-2.5 text-sm">
                      <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
                        {isParent ? (
                          <button
                            onClick={() => toggleExpand(node.accountId)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200"
                            title={isExpanded ? t('trialBalance.collapse') : t('trialBalance.expand')}
                          >
                            <svg
                              className={`w-3.5 h-3.5 text-slate-500 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        <button
                          onClick={() => handleDrillDown(node.accountId)}
                          className="text-left text-slate-900 hover:text-blue-700 hover:underline truncate"
                          title={t('trialBalance.viewStatement', { code: node.code, name: node.name })}
                        >
                          {node.name}
                        </button>
                        {isParent && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                            {t('trialBalance.group')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-5 py-2.5 text-right font-mono text-sm ${isParent ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
                      {fmtNum(isParent ? node.rolledClosingDebit : node.closingDebit)}
                    </td>
                    <td className={`px-5 py-2.5 text-right font-mono text-sm ${isParent ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
                      {fmtNum(isParent ? node.rolledClosingCredit : node.closingCredit)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {meta && data.length > 0 && (
            <tfoot className="sticky bottom-0 bg-white border-t border-slate-200">
              <tr className="border-b border-slate-100">
                <td colSpan={2} className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('trialBalance.grandTotal')}
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm font-bold text-slate-900">
                  {meta.totalClosingDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm font-bold text-slate-900">
                  {meta.totalClosingCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-5 py-2.5">
                  <div className="flex items-center justify-end gap-3">
                    {meta.isBalanced ? (
                      <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-semibold">
                        {t('trialBalance.balanced')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-semibold">
                        {t('trialBalance.unbalancedDiff', {
                          diff: meta.difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
  );
};

const TrialBalancePage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();

  const handleExportExcel = async (params: TrialBalanceParams) => {
    const result = await accountingApi.getTrialBalance({
      asOfDate: params.asOfDate,
      includeZeroBalance: params.includeZeroBalance,
    });

    const rows = result.data || [];
    await exportToExcel(
      rows,
      [
        { header: t('trialBalance.code'), key: 'code' },
        { header: t('trialBalance.accountName'), key: 'name' },
        { header: t('trialBalance.classification', { defaultValue: 'Classification' }), key: 'classification' },
        { header: t('trialBalance.closingDebit'), key: 'closingDebit', isNumber: true },
        { header: t('trialBalance.closingCredit'), key: 'closingCredit', isNumber: true },
      ],
      `Trial-Balance-${params.asOfDate}`,
      t('trialBalance.title'),
      t('trialBalance.asOf', { defaultValue: 'As of {{date}}', date: formatCompanyDate(params.asOfDate, settings) })
    );
  };

  return (
    <ReportContainer<TrialBalanceParams>
      title={t('trialBalance.title')}
      subtitle={t('trialBalance.subtitle')}
      initiator={TrialBalanceInitiator}
      ReportContent={TrialBalanceReportContent}
      onExportExcel={handleExportExcel}
      defaultParams={{
        asOfDate: getCompanyToday(settings),
        includeZeroBalance: false,
      }}
      config={{ paginated: false }}
    />
  );
};

export default TrialBalancePage;

