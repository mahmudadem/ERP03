import React, { useEffect, useState } from 'react';
import { accountingApi } from '../../../api/accountingApi';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../components/shared/DatePicker';
import { CalendarDays } from 'lucide-react';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { exportToExcel } from '../../../utils/exportUtils';
import { useNavigate } from 'react-router-dom';
import i18n from '../../../i18n/config';

interface CashFlowParams {
  fromDate: string;
  toDate: string;
}

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

interface RowContextMenuState {
  x: number;
  y: number;
  rowKey: string;
  item: CashFlowItem;
}

const numberFmt = (n: number, currency?: string) =>
  `${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;

const Section: React.FC<{
  title: string;
  sectionKey: string;
  total: number;
  items: CashFlowItem[];
  currency: string;
  highlightedRows: Set<string>;
  onRowContextMenu: (e: React.MouseEvent, item: CashFlowItem, rowKey: string) => void;
}> = ({
  title,
  sectionKey,
  total,
  items,
  currency,
  highlightedRows,
  onRowContextMenu,
}) => {
  const { t } = useTranslation('accounting');

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <span className="text-sm font-semibold text-slate-700">{numberFmt(total, currency)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100/70 text-slate-600 uppercase text-[11px] tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">{t('cashFlow.item', { defaultValue: 'Item' })}</th>
              <th className="text-right px-4 py-2 font-semibold">{t('cashFlow.amount', { defaultValue: 'Amount' })}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-slate-400" colSpan={2}>—</td>
              </tr>
            ) : (
              items.map((i, idx) => {
                const rowKey = `${sectionKey}:${i.accountId || i.name}:${idx}`;
                const isHighlighted = highlightedRows.has(rowKey);
                return (
                  <tr
                    key={rowKey}
                    className={`border-t border-slate-100 hover:bg-blue-50/40 transition-colors ${
                      isHighlighted ? 'bg-amber-100/70' : ''
                    }`}
                    onContextMenu={(e) => onRowContextMenu(e, i, rowKey)}
                  >
                    <td className="px-4 py-2 text-slate-700">{i.name}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">{numberFmt(i.amount, currency)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CashFlowInitiator: React.FC<{
  onSubmit: (params: CashFlowParams) => void;
  initialParams?: CashFlowParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const [fromDate, setFromDate] = useState(
    initialParams?.fromDate || `${new Date().getFullYear()}-01-01`
  );
  const [toDate, setToDate] = useState(initialParams?.toDate || new Date().toISOString().split('T')[0]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ fromDate, toDate });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.from', { defaultValue: 'From' })}
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full text-base" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.to', { defaultValue: 'To' })}
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full text-base" />
        </div>
        <div>
          <Button type="submit" className="bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded text-xs font-bold uppercase tracking-widest">
            {t('cashFlow.apply')}
          </Button>
        </div>
      </div>
    </form>
  );
};

const CashFlowReportContent: React.FC<{ params: CashFlowParams }> = ({ params }) => {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');
  const [data, setData] = useState<CashFlowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<RowContextMenuState | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await accountingApi.getCashFlow(params.fromDate, params.toDate);
        setData(result);
      } catch (err: any) {
        console.error('Failed to load cash flow report', err);
        setError(err?.message || t('cashFlow.errors.loadFailed', { defaultValue: 'Failed to load cash flow report' }));
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.fromDate, params.toDate]);

  const currency = data?.baseCurrency || '';
  const effectiveFrom = data?.period?.from || params.fromDate;
  const effectiveTo = data?.period?.to || params.toDate;
  const periodText = t('cashFlow.period', {
    from: formatCompanyDate(effectiveFrom, settings),
    to: formatCompanyDate(effectiveTo, settings),
  });

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  const openAccountStatement = (accountId?: string) => {
    if (!accountId) return;
    navigate(`/accounting/reports/account-statement?accountId=${encodeURIComponent(accountId)}`);
  };

  const openAccountCard = (accountId?: string) => {
    if (!accountId) return;
    navigate(`/accounting/accounts?editId=${encodeURIComponent(accountId)}`);
  };

  const toggleRowHighlight = (rowKey: string) => {
    setHighlightedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
              {t('cashFlow.periodLabel', { defaultValue: 'Report Period' })}
            </span>
            <span className="text-sm font-semibold text-slate-800">{periodText}</span>
          </div>
          <span className="text-xs font-semibold text-slate-500 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
            {t('balanceSheet.baseCurrency', { defaultValue: 'Base Currency' })}: {currency || '—'}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading && !data ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-center min-h-[180px]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                  {t('cashFlow.processing', { defaultValue: 'Processing...' })}
                </p>
              </div>
            </div>
          </div>
        ) : data ? (
          <>
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  {t('cashFlow.summary', { defaultValue: 'Summary' })}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase text-[11px] tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">{t('cashFlow.metric', { defaultValue: 'Metric' })}</th>
                      <th className="text-right px-4 py-2 font-semibold">{t('cashFlow.amount', { defaultValue: 'Amount' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-2 text-slate-700">{t('cashFlow.netIncome')}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-900">{numberFmt(data.netIncome, currency)}</td>
                    </tr>
                    <tr className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-2 text-slate-700">{t('cashFlow.openingCash')}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-900">{numberFmt(data.openingCashBalance, currency)}</td>
                    </tr>
                    <tr className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-2 text-slate-700">{t('cashFlow.closingCash')}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-900">{numberFmt(data.closingCashBalance, currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Section
              title={t('cashFlow.operating')}
              sectionKey="operating"
              total={data.operating.total}
              items={data.operating.items}
              currency={currency}
              highlightedRows={highlightedRows}
              onRowContextMenu={(e, item, rowKey) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, item, rowKey });
              }}
            />
            <Section
              title={t('cashFlow.investing')}
              sectionKey="investing"
              total={data.investing.total}
              items={data.investing.items}
              currency={currency}
              highlightedRows={highlightedRows}
              onRowContextMenu={(e, item, rowKey) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, item, rowKey });
              }}
            />
            <Section
              title={t('cashFlow.financing')}
              sectionKey="financing"
              total={data.financing.total}
              items={data.financing.items}
              currency={currency}
              highlightedRows={highlightedRows}
              onRowContextMenu={(e, item, rowKey) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, item, rowKey });
              }}
            />

            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex justify-between text-lg font-bold">
                <span>{t('cashFlow.netChange')}</span>
                <span>{numberFmt(data.netCashChange, currency)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-center min-h-[180px]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                  {t('cashFlow.processing', { defaultValue: 'Processing...' })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-[1200] bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-52"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 170),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm ${
              contextMenu.item.accountId ? 'hover:bg-slate-50 text-slate-800' : 'text-slate-300 cursor-not-allowed'
            }`}
            onClick={() => {
              openAccountStatement(contextMenu.item.accountId);
              setContextMenu(null);
            }}
            disabled={!contextMenu.item.accountId}
          >
            {t('cashFlow.actions.accountStatement', { defaultValue: 'Account Statement' })}
          </button>
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm ${
              contextMenu.item.accountId ? 'hover:bg-slate-50 text-slate-800' : 'text-slate-300 cursor-not-allowed'
            }`}
            onClick={() => {
              openAccountCard(contextMenu.item.accountId);
              setContextMenu(null);
            }}
            disabled={!contextMenu.item.accountId}
          >
            {t('cashFlow.actions.accountCard', { defaultValue: 'Account Card' })}
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-800"
            onClick={() => {
              toggleRowHighlight(contextMenu.rowKey);
              setContextMenu(null);
            }}
          >
            {highlightedRows.has(contextMenu.rowKey)
              ? t('cashFlow.actions.unhighlightLine', { defaultValue: 'Unhighlight Line' })
              : t('cashFlow.actions.highlightLine', { defaultValue: 'Highlight Line' })}
          </button>
        </div>
      )}
    </div>
  );
};

const exportCashFlowToExcel = async (params: CashFlowParams) => {
  const t = i18n.getFixedT(i18n.language, 'accounting');
  const result: CashFlowResponse = await accountingApi.getCashFlow(params.fromDate, params.toDate);
  const rows: Array<{ section: string; item: string; amount: number }> = [
    { section: t('cashFlow.summary', { defaultValue: 'Summary' }), item: t('cashFlow.netIncome', { defaultValue: 'Net Income' }), amount: result.netIncome },
    { section: t('cashFlow.summary', { defaultValue: 'Summary' }), item: t('cashFlow.openingCash', { defaultValue: 'Opening Cash' }), amount: result.openingCashBalance },
    { section: t('cashFlow.summary', { defaultValue: 'Summary' }), item: t('cashFlow.closingCash', { defaultValue: 'Closing Cash' }), amount: result.closingCashBalance },
    { section: t('cashFlow.summary', { defaultValue: 'Summary' }), item: t('cashFlow.netChange', { defaultValue: 'Net Change in Cash' }), amount: result.netCashChange },
    ...result.operating.items.map((x) => ({ section: t('cashFlow.operating', { defaultValue: 'Operating' }), item: x.name, amount: x.amount })),
    { section: t('cashFlow.operating', { defaultValue: 'Operating' }), item: t('cashFlow.total', { defaultValue: 'Total' }), amount: result.operating.total },
    ...result.investing.items.map((x) => ({ section: t('cashFlow.investing', { defaultValue: 'Investing' }), item: x.name, amount: x.amount })),
    { section: t('cashFlow.investing', { defaultValue: 'Investing' }), item: t('cashFlow.total', { defaultValue: 'Total' }), amount: result.investing.total },
    ...result.financing.items.map((x) => ({ section: t('cashFlow.financing', { defaultValue: 'Financing' }), item: x.name, amount: x.amount })),
    { section: t('cashFlow.financing', { defaultValue: 'Financing' }), item: t('cashFlow.total', { defaultValue: 'Total' }), amount: result.financing.total },
  ];

  exportToExcel(
    rows,
    [
      { header: t('cashFlow.excel.section', { defaultValue: 'Section' }), key: 'section' },
      { header: t('cashFlow.excel.item', { defaultValue: 'Item' }), key: 'item' },
      { header: t('cashFlow.excel.amount', { defaultValue: 'Amount' }), key: 'amount', isNumber: true },
    ],
    `Cash-Flow-${result.period.from}-to-${result.period.to}`,
    t('cashFlow.title', { defaultValue: 'Cash Flow' })
  );
};

const CashFlowPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  return (
    <ReportContainer<CashFlowParams>
      title={t('cashFlow.title')}
      subtitle={t('cashFlow.periodLabel', { defaultValue: 'Indirect Method Report' })}
      initiator={CashFlowInitiator}
      ReportContent={CashFlowReportContent}
      onExportExcel={exportCashFlowToExcel}
      config={{ paginated: false }}
    />
  );
};

export default CashFlowPage;
