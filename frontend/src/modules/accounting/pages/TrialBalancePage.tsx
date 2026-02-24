
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingApi, TrialBalanceLine, TrialBalanceMeta } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate, getCompanyToday } from '../../../utils/dateUtils';
import { exportToExcel, exportElementToPDF } from '../../../utils/exportUtils';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../components/shared/DatePicker';

const CLASSIFICATION_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

// ─── Tree node type ───────────────────────────────────────────────
interface TBTreeNode extends TrialBalanceLine {
  depth: number;
  children: TBTreeNode[];
  hasChildren: boolean;
  // Rolled-up totals (own + descendants)
  rolledClosingDebit: number;
  rolledClosingCredit: number;
}

// ─── Build tree from flat list ────────────────────────────────────
function buildTree(lines: TrialBalanceLine[]): TBTreeNode[] {
  const nodeMap = new Map<string, TBTreeNode>();
  const roots: TBTreeNode[] = [];

  // Phase 1: Create nodes
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

  // Phase 2: Link parent → children
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(node);
      parent.hasChildren = true;
    } else {
      roots.push(node);
    }
  }

  // Phase 3: Set depths + roll up balances (bottom-up via post-order)
  function setDepthAndRollUp(node: TBTreeNode, depth: number): void {
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
    // Sort children by code
    node.children.sort((a, b) => a.code.localeCompare(b.code));
  }

  for (const root of roots) {
    setDepthAndRollUp(root, 0);
  }

  roots.sort((a, b) => a.code.localeCompare(b.code));
  return roots;
}

// ─── Flatten tree respecting expanded state ───────────────────────
function flattenTree(
  nodes: TBTreeNode[],
  expanded: Set<string>
): TBTreeNode[] {
  const result: TBTreeNode[] = [];
  function walk(list: TBTreeNode[]) {
    for (const node of list) {
      result.push(node);
      if (node.hasChildren && expanded.has(node.accountId)) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}

// ─── Flat display row type ────────────────────────────────────────
type DisplayRow =
  | { kind: 'header'; classification: string; label: string }
  | { kind: 'account'; node: TBTreeNode }
  | { kind: 'subtotal'; classification: string; label: string; closingDebit: number; closingCredit: number };

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════
const TrialBalancePage: React.FC = () => {
  const { settings } = useCompanySettings();
  const navigate = useNavigate();
  const [data, setData] = useState<TrialBalanceLine[]>([]);
  const [meta, setMeta] = useState<TrialBalanceMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const { t } = useTranslation('accounting');

  // Localized classification labels
  const CLASSIFICATION_LABELS = useMemo(() => ({
    ASSET: t('trialBalance.classifications.asset', 'Assets'),
    LIABILITY: t('trialBalance.classifications.liability', 'Liabilities'),
    EQUITY: t('trialBalance.classifications.equity', 'Equity'),
    REVENUE: t('trialBalance.classifications.revenue', 'Revenue'),
    EXPENSE: t('trialBalance.classifications.expense', 'Expenses')
  }), [t]);

  // Report parameters
  const [asOfDate, setAsOfDate] = useState(() => getCompanyToday(null));
  const [includeZeroBalance, setIncludeZeroBalance] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(true);

  // Hierarchy expand/collapse
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Initialize asOfDate with company timezone once settings load
  useEffect(() => {
    if (settings) {
      setAsOfDate(getCompanyToday(settings));
    }
  }, [settings]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountingApi.getTrialBalance({ asOfDate, includeZeroBalance });
      setData(result.data || []);
      setMeta(result.meta || null);
      setGenerated(true);
      // Auto-expand root level (depth=0 parents)
      const tree = buildTree(result.data || []);
      const rootParents = tree.filter(n => n.hasChildren).map(n => n.accountId);
      setExpanded(new Set(rootParents));
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('trialBalance.loadError'));
      setData([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  // Build tree structure
  const tree = useMemo(() => buildTree(data), [data]);

  // Flat display rows grouped by classification
  const displayRows = useMemo((): DisplayRow[] => {
    const flat = flattenTree(tree, expanded);
    const result: DisplayRow[] = [];

    for (const cls of CLASSIFICATION_ORDER) {
      const rows = flat.filter(n => n.classification === cls);
      if (rows.length === 0) continue;

      result.push({ kind: 'header', classification: cls, label: CLASSIFICATION_LABELS[cls] || cls });

      for (const node of rows) {
        result.push({ kind: 'account', node });
      }

      // Subtotals use only root-level nodes for classification
      const rootsInCls = tree.filter(n => n.classification === cls);
      const subtotalDebit = rootsInCls.reduce((s, n) => s + n.rolledClosingDebit, 0);
      const subtotalCredit = rootsInCls.reduce((s, n) => s + n.rolledClosingCredit, 0);
      result.push({
        kind: 'subtotal',
        classification: cls,
        label: t('trialBalance.totalFor', { defaultValue: 'Total {{name}}', name: CLASSIFICATION_LABELS[cls] || cls }),
        closingDebit: subtotalDebit,
        closingCredit: subtotalCredit
      });
    }

    return result;
  }, [tree, expanded]);

  const toggleExpand = useCallback((accountId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allParents = new Set<string>();
    function collect(nodes: TBTreeNode[]) {
      for (const n of nodes) {
        if (n.hasChildren) {
          allParents.add(n.accountId);
          collect(n.children);
        }
      }
    }
    collect(tree);
    setExpanded(allParents);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const handleDrillDown = useCallback((accountId: string) => {
    // Navigate to Account Statement with pre-selected account
    navigate(`/accounting/reports/account-statement?accountId=${accountId}`);
  }, [navigate]);

  const fmtNum = (val: number) => val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] pb-4 print:!pb-0 print:!h-auto print:!block">
      {/* Page Header */}
      <div className="flex-none flex justify-between items-center mb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('trialBalance.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('trialBalance.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={data.length === 0}
            onClick={() =>
              exportToExcel(
                data,
                [
                  { header: t('trialBalance.code'), key: 'code' },
                  { header: t('trialBalance.accountName'), key: 'name' },
                  { header: 'Classification', key: 'classification' },
                  { header: 'Closing Debit', key: 'closingDebit', isNumber: true },
                  { header: 'Closing Credit', key: 'closingCredit', isNumber: true },
                  { header: t('trialBalance.debit'), key: 'totalDebit', isNumber: true },
                  { header: t('trialBalance.credit'), key: 'totalCredit', isNumber: true },
                  { header: t('trialBalance.netBalance'), key: 'netBalance', isNumber: true }
                ],
                `Trial-Balance-${asOfDate}`,
                t('trialBalance.title')
              )
            }
          >
            {t('trialBalance.exportExcel')}
          </Button>
          <Button variant="secondary" disabled={data.length === 0} onClick={() => exportElementToPDF('trial-balance-report', `Trial-Balance-${asOfDate}`)}>{t('trialBalance.exportPDF')}</Button>
          <Button onClick={() => window.print()} variant="secondary" disabled={data.length === 0}>{t('trialBalance.print')}</Button>
        </div>
      </div>

      {/* Parameters Toolbar */}
      <div className="flex-none mb-4 bg-white rounded-lg border border-gray-200 shadow-sm print:hidden">
        <button
          onClick={() => setParamsOpen(!paramsOpen)}
          className="w-full px-4 py-2 flex justify-between items-center text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-t-lg"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {t('trialBalance.paramsTitle', 'Report Parameters')}
          </span>
          <svg className={`w-4 h-4 transform transition-transform ${paramsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {paramsOpen && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600" htmlFor="tb-asOfDate">{t('trialBalance.asOfDate', 'As of Date')}:</label>
              <DatePicker
                value={asOfDate}
                onChange={setAsOfDate}
                className="w-40"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeZeroBalance}
                onChange={e => setIncludeZeroBalance(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {t('trialBalance.includeZero', 'Include Zero Balances')}
            </label>
            <Button onClick={fetchReport} variant="primary" className="ml-auto">
              {loading ? t('trialBalance.loading', 'Loading...') : t('trialBalance.generate', 'Generate Report')}
            </Button>
          </div>
        )}
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('trialBalance.title')}</h1>
        <p className="text-sm text-gray-600">
          {t('trialBalance.printLine', {
            defaultValue: 'As of {{asOf}} — Generated {{generated}}',
            asOf: formatCompanyDate(asOfDate, settings),
            generated: formatCompanyDate(new Date(), settings)
          })}
        </p>
      </div>

      {error && (
        <div className="flex-none bg-red-50 text-red-700 p-4 rounded border border-red-200 mb-4">
          {error}
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col print:shadow-none print:border print:block print:h-auto" id="trial-balance-report">

        {!generated && !loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-500">{t('trialBalance.prompt', 'Select parameters and click Generate Report')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('trialBalance.placeholder', 'Trial Balance will appear here')}</p>
          </div>
        ) : (
          <>
            {/* Expand/Collapse controls */}
            {generated && data.length > 0 && (
              <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/50 print:hidden">
                <span className="text-xs text-gray-500 font-medium">{t('trialBalance.hierarchy', 'Hierarchy')}:</span>
                <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline">
                  {t('trialBalance.expandAll', 'Expand All')}
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={collapseAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline">
                  {t('trialBalance.collapseAll', 'Collapse All')}
                </button>
              </div>
            )}

            {/* Scrollable table */}
            <div className="flex-1 min-h-0 overflow-auto relative print:!overflow-visible print:!min-h-full print:!flex-none">
              <table className="min-w-full relative">
                {/* Sticky Header */}
                <thead className="sticky top-0 z-20 print:!static">
                  <tr className="bg-gradient-to-b from-gray-50 to-gray-100 border-b-2 border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">{t('trialBalance.code')}</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('trialBalance.accountName')}</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-40">{t('trialBalance.closingDebit', 'Closing Debit')}</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-40">{t('trialBalance.closingCredit', 'Closing Credit')}</th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="animate-spin h-8 w-8 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('trialBalance.loading', 'Loading...')}
                      </div>
                    </td></tr>
                  ) : data.length === 0 && !error ? (
                    <tr><td colSpan={4} className="px-6 py-16 text-center text-gray-400">
                      <p className="text-sm">{t('trialBalance.noData')}</p>
                    </td></tr>
                  ) : (
                    displayRows.map((item, idx) => {
                      if (item.kind === 'header') {
                        return (
                          <tr key={`h-${item.classification}`} className="bg-blue-50/50">
                            <td colSpan={4} className="px-6 py-2.5 text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-blue-100">
                              {item.label}
                            </td>
                          </tr>
                        );
                      }
                      if (item.kind === 'subtotal') {
                        return (
                          <tr key={`s-${item.classification}`} className="bg-gray-50/80 border-t border-gray-200">
                            <td colSpan={2} className="px-6 py-2 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                              {item.label}
                            </td>
                            <td className="px-6 py-2 text-right font-mono text-sm font-bold text-gray-800 tabular-nums">
                              {fmtNum(item.closingDebit)}
                            </td>
                            <td className="px-6 py-2 text-right font-mono text-sm font-bold text-gray-800 tabular-nums">
                              {fmtNum(item.closingCredit)}
                            </td>
                          </tr>
                        );
                      }

                      // ── Account row (with hierarchy) ──
                      const node = item.node;
                      const isExpanded = expanded.has(node.accountId);
                      const isParent = node.hasChildren;
                      const indent = node.depth * 24;

                      return (
                        <tr
                          key={node.accountId}
                          className={`hover:bg-blue-50/30 transition-colors break-inside-avoid ${isParent ? 'bg-amber-50/30' : ''}`}
                        >
                          {/* Code */}
                          <td className="px-6 py-2.5 text-sm font-mono text-gray-500 font-medium">
                            <span style={{ paddingLeft: indent }}>
                              {node.code}
                            </span>
                          </td>

                          {/* Account Name — with expand toggle + drill-down */}
                          <td className="px-6 py-2.5 text-sm">
                            <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
                              {/* Expand/Collapse toggle for parents */}
                              {isParent ? (
                                <button
                                  onClick={() => toggleExpand(node.accountId)}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                  title={isExpanded ? t('trialBalance.collapse', 'Collapse') : t('trialBalance.expand', 'Expand')}
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="w-5 flex-shrink-0" />
                              )}

                              {/* Account name — clickable for drill-down */}
                              <button
                                onClick={() => handleDrillDown(node.accountId)}
                                className="text-left text-gray-900 hover:text-blue-700 hover:underline decoration-blue-300 underline-offset-2 transition-colors truncate"
                                title={t('trialBalance.viewStatement', { defaultValue: 'View Account Statement for {{code}} — {{name}}', code: node.code, name: node.name })}
                              >
                                {node.name}
                              </button>

                              {/* Parent badge */}
                              {isParent && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold flex-shrink-0">
                                  {t('trialBalance.group', 'GROUP')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Closing Debit — show rolled-up for parents */}
                          <td className={`px-6 py-2.5 text-right font-mono text-sm tabular-nums ${isParent ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
                            {fmtNum(isParent ? node.rolledClosingDebit : node.closingDebit)}
                          </td>

                          {/* Closing Credit — show rolled-up for parents */}
                          <td className={`px-6 py-2.5 text-right font-mono text-sm tabular-nums ${isParent ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
                            {fmtNum(isParent ? node.rolledClosingCredit : node.closingCredit)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Sticky Footer */}
                {meta && data.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 print:!static">
                    <tr>
                      <td colSpan={4} className="p-0">
                        <div className="h-[2px] bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300" />
                      </td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200">
                      <td colSpan={2} className="px-6 py-3 text-right bg-white">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('trialBalance.grandTotal', 'Grand Total')}</span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-sm font-bold text-gray-900 bg-white tabular-nums">
                        {meta.totalClosingDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-sm font-bold text-gray-900 bg-white tabular-nums">
                        {meta.totalClosingCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td colSpan={4} className="px-6 py-2 bg-white">
                        <div className="flex items-center justify-end gap-3">
                          {meta.isBalanced ? (
                            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              {t('trialBalance.balanced', 'Balanced')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                              {t('trialBalance.unbalancedDiff', { defaultValue: 'Unbalanced — Diff: {{diff}}', diff: meta.difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
                            </span>
                          )}
                          {meta.asOfDate && (
                            <span className="text-xs text-gray-400">
                              {t('trialBalance.asOfInline', { defaultValue: 'As of {{date}}', date: formatCompanyDate(meta.asOfDate, settings) })}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrialBalancePage;
