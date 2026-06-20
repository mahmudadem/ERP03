import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, CalendarDays, ChevronRight, CircleDollarSign, FileSpreadsheet, PackageSearch } from 'lucide-react';
import { clsx } from 'clsx';
import {
  GrossProfitDocumentType,
  GrossProfitReportDTO,
  GrossProfitRowDTO,
  salesReportingApi,
} from '../../../api/salesReportingApi';
import type { InventoryItemDTO } from '../../../api/inventoryApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { ItemSelector } from '../../../components/shared/selectors/ItemSelector';
import { DatePicker } from '../../accounting/components/shared/DatePicker';

export type GrossProfitMode = 'BY_DOCUMENT' | 'BY_ITEM';
type DocumentScope =
  | 'SALES'
  | 'ALL'
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN';

export interface GrossProfitParams {
  fromDate: string;
  toDate: string;
  documentScope: DocumentScope;
  itemId?: string;
  itemLabel?: string;
  docCurrency?: string;
  limit: number;
}

interface SalesGrossProfitReportPageProps {
  mode: GrossProfitMode;
}

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

export const grossProfitDefaultParams: GrossProfitParams = {
  fromDate: firstOfYear(),
  toDate: today(),
  documentScope: 'SALES',
  limit: 1000,
};

const salesScopeTypes: GrossProfitDocumentType[] = ['SALES_INVOICE', 'SALES_RETURN'];
const allScopeTypes: GrossProfitDocumentType[] = [
  'SALES_INVOICE',
  'SALES_RETURN',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
];

const documentTypesForScope = (scope: DocumentScope): GrossProfitDocumentType[] | GrossProfitDocumentType | undefined => {
  if (scope === 'SALES') return undefined;
  if (scope === 'ALL') return allScopeTypes;
  return scope;
};

const formatAmount = (value: number) =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const profitColor = (value: number) =>
  value < 0 ? 'text-red-700 dark:text-red-300' : value > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300';

const getScopeLabel = (scope: DocumentScope) => {
  switch (scope) {
    case 'SALES':
      return 'Sales invoices and returns';
    case 'ALL':
      return 'All tracked document types';
    case 'SALES_INVOICE':
      return 'Sales invoices only';
    case 'SALES_RETURN':
      return 'Sales returns only';
    case 'PURCHASE_INVOICE':
      return 'Purchase invoices only';
    case 'PURCHASE_RETURN':
      return 'Purchase returns only';
    default:
      return scope;
  }
};

export const grossProfitReportColumns = [
  { id: 'group', label: 'Document / Item', permanent: true },
  { id: 'lineCount', label: 'Lines' },
  { id: 'revenueBaseIn', label: 'Revenue In' },
  { id: 'revenueBaseOut', label: 'Revenue Out' },
  { id: 'costBaseIn', label: 'Cost In' },
  { id: 'costBaseOut', label: 'Cost Out' },
  { id: 'profitBaseIn', label: 'Profit In' },
  { id: 'profitBaseOut', label: 'Profit Out' },
  { id: 'profitBaseNet', label: 'Net Profit' },
  { id: 'docCurrency', label: 'Document Currency' },
];

export const GrossProfitInitiator: React.FC<{
  onSubmit: (p: GrossProfitParams) => void;
  initialParams?: GrossProfitParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('common');
  const [fromDate, setFromDate] = useState(initialParams?.fromDate || grossProfitDefaultParams.fromDate);
  const [toDate, setToDate] = useState(initialParams?.toDate || grossProfitDefaultParams.toDate);
  const [documentScope, setDocumentScope] = useState<DocumentScope>(initialParams?.documentScope || 'SALES');
  const [itemId, setItemId] = useState(initialParams?.itemId || '');
  const [itemLabel, setItemLabel] = useState(initialParams?.itemLabel || '');
  const [docCurrency, setDocCurrency] = useState(initialParams?.docCurrency || '');
  const [limit, setLimit] = useState(initialParams?.limit || grossProfitDefaultParams.limit);

  const handleItemChange = (item: InventoryItemDTO | null) => {
    setItemId(item?.id || '');
    setItemLabel(item ? `${item.code} - ${item.name}` : '');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          fromDate,
          toDate,
          documentScope,
          itemId: itemId || undefined,
          itemLabel: itemLabel || undefined,
          docCurrency: docCurrency.trim().toUpperCase() || undefined,
          limit,
        });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <div className="space-y-2 md:col-span-3">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {t('salesGrossProfit.fromDate', { defaultValue: 'From Date' })}
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full" />
        </div>

        <div className="space-y-2 md:col-span-3">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {t('salesGrossProfit.toDate', { defaultValue: 'To Date' })}
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full" />
        </div>

        <div className="space-y-2 md:col-span-3">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            {t('salesGrossProfit.documentScope', { defaultValue: 'Document Scope' })}
          </label>
          <select
            value={documentScope}
            onChange={(event) => setDocumentScope(event.target.value as DocumentScope)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold outline-none transition-all hover:border-violet-300 hover:bg-white focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="SALES">{t('salesGrossProfit.scopeSales', { defaultValue: 'Sales invoices and returns' })}</option>
            <option value="SALES_INVOICE">{t('salesGrossProfit.scopeSalesInvoices', { defaultValue: 'Sales invoices only' })}</option>
            <option value="SALES_RETURN">{t('salesGrossProfit.scopeSalesReturns', { defaultValue: 'Sales returns only' })}</option>
            <option value="ALL">{t('salesGrossProfit.scopeAll', { defaultValue: 'All tracked document types' })}</option>
            <option value="PURCHASE_INVOICE">{t('salesGrossProfit.scopePurchaseInvoices', { defaultValue: 'Purchase invoices only' })}</option>
            <option value="PURCHASE_RETURN">{t('salesGrossProfit.scopePurchaseReturns', { defaultValue: 'Purchase returns only' })}</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-3">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t('salesGrossProfit.limit', { defaultValue: 'Row Limit' })}
          </label>
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold outline-none transition-all hover:border-emerald-300 hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {[500, 1000, 2500, 5000].map((value) => (
              <option key={value} value={value}>{value.toLocaleString()} rows</option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-7">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            {t('salesGrossProfit.itemFilter', { defaultValue: 'Item Filter' })}
          </label>
          <ItemSelector
            value={itemId}
            onChange={handleItemChange}
            placeholder={t('salesGrossProfit.allItems', { defaultValue: 'All items' })}
            className="w-full"
          />
        </div>

        <div className="space-y-2 md:col-span-5">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t('salesGrossProfit.docCurrency', { defaultValue: 'Document Currency' })}
          </label>
          <input
            value={docCurrency}
            maxLength={3}
            onChange={(event) => setDocCurrency(event.target.value.toUpperCase())}
            placeholder={t('salesGrossProfit.anyCurrency', { defaultValue: 'Any currency' })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold uppercase outline-none transition-all hover:border-amber-300 hover:bg-white focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button
          type="submit"
          className="rounded-xl bg-slate-900 px-10 py-3 text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-black hover:shadow-xl"
        >
          <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            {t('salesGrossProfit.generate', { defaultValue: 'Generate Report' })}
            <ChevronRight className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </form>
  );
};

const SummaryMetric: React.FC<{ label: string; value: string; tone?: 'profit' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className={clsx('mt-1 text-lg font-black tabular-nums', tone === 'profit' ? profitColor(Number(value.replace(/,/g, ''))) : 'text-slate-900 dark:text-slate-100')}>
      {value}
    </p>
  </div>
);

const CurrencyBreakdown: React.FC<{ row: GrossProfitRowDTO }> = ({ row }) => {
  if (!row.hasMixedDocCurrencies && row.docCurrency) {
    return (
      <span className={clsx('font-bold tabular-nums', profitColor(row.profitAmountDocNet))}>
        {row.docCurrency} {formatAmount(row.profitAmountDocNet)}
      </span>
    );
  }

  if (!row.docCurrencyBreakdown?.length) return <span className="text-slate-400">-</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      {row.docCurrencyBreakdown.map((entry) => (
        <span key={entry.docCurrency} className={clsx('text-[11px] font-semibold tabular-nums', profitColor(entry.profitAmountDocNet))}>
          {entry.docCurrency} {formatAmount(entry.profitAmountDocNet)}
        </span>
      ))}
    </div>
  );
};

export const GrossProfitReportContent: React.FC<{
  params: GrossProfitParams & { mode: GrossProfitMode };
  setTotalItems?: (total: number) => void;
  visibleColumns?: string[];
  density?: 'compact' | 'comfortable';
}> = ({ params, setTotalItems, visibleColumns, density }) => {
  const { t } = useTranslation('common');
  const [report, setReport] = useState<GrossProfitReportDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);

    const query = {
      fromDate: params.fromDate,
      toDate: params.toDate,
      documentType: documentTypesForScope(params.documentScope),
      itemId: params.itemId,
      docCurrency: params.docCurrency,
      limit: params.limit,
    };

    const promise = params.mode === 'BY_DOCUMENT'
      ? salesReportingApi.getGrossProfitByDocument(query)
      : salesReportingApi.getGrossProfitByItem(query);

    promise
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.docCurrency, params.documentScope, params.fromDate, params.itemId, params.limit, params.mode, params.toDate]);

  const rows = report?.rows || [];
  useEffect(() => {
    setTotalItems?.(rows.length);
  }, [rows.length, setTotalItems]);

  const visible = (id: string) => !visibleColumns?.length || visibleColumns.includes(id);
  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const title = params.mode === 'BY_DOCUMENT'
    ? t('salesGrossProfit.titleByDocument', { defaultValue: 'Gross Profit by Document' })
    : t('salesGrossProfit.titleByItem', { defaultValue: 'Gross Profit by Item' });

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-slate-100">
            <CircleDollarSign className="h-3 w-3 text-emerald-600" />
            {title}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-slate-100">
            <CalendarDays className="h-3 w-3 text-blue-600" />
            {params.fromDate} - {params.toDate}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-slate-100">
            <FileSpreadsheet className="h-3 w-3 text-violet-600" />
            {getScopeLabel(params.documentScope)}
          </span>
          {params.itemLabel && (
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <PackageSearch className="h-3 w-3 text-slate-500" />
              {params.itemLabel}
            </span>
          )}
          {params.docCurrency && (
            <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              {params.docCurrency}
            </span>
          )}
          <span className="ml-auto text-xs font-bold text-slate-500">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && (
            <div className="py-20 text-center text-sm text-slate-400">Loading report...</div>
          )}

          {!loading && report && (
            <>
              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                <SummaryMetric label={t('salesGrossProfit.netProfit', { defaultValue: 'Net Profit Base' })} value={formatAmount(report.totals.profitBaseNet)} tone="profit" />
                <SummaryMetric label={t('salesGrossProfit.profitIn', { defaultValue: 'Profit IN Base' })} value={formatAmount(report.totals.profitBaseIn)} tone="profit" />
                <SummaryMetric label={t('salesGrossProfit.profitOut', { defaultValue: 'Profit OUT Base' })} value={formatAmount(report.totals.profitBaseOut)} />
                <SummaryMetric label={t('salesGrossProfit.lines', { defaultValue: 'Fact Lines' })} value={report.totals.lineCount.toLocaleString()} />
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('salesGrossProfit.managementNote', {
                      defaultValue: 'Management report from historical profit facts. This does not recalculate inventory valuation or COGS.',
                    })}
                  </p>
                </div>

                {rows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">{t('salesGrossProfit.noData', { defaultValue: 'No gross profit facts match these filters.' })}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                          {visible('group') && <th className={clsx(cellPad, 'text-left text-[10px] font-black uppercase tracking-widest text-slate-400')}>{params.mode === 'BY_DOCUMENT' ? 'Document' : 'Item'}</th>}
                          {visible('lineCount') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Lines</th>}
                          {visible('revenueBaseIn') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Revenue In</th>}
                          {visible('revenueBaseOut') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Revenue Out</th>}
                          {visible('costBaseIn') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Cost In</th>}
                          {visible('costBaseOut') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Cost Out</th>}
                          {visible('profitBaseIn') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Profit In</th>}
                          {visible('profitBaseOut') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Profit Out</th>}
                          {visible('profitBaseNet') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Net Profit</th>}
                          {visible('docCurrency') && <th className={clsx(cellPad, 'text-right text-[10px] font-black uppercase tracking-widest text-slate-400')}>Doc Currency Profit</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.groupKey} className="border-b border-slate-100 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40">
                            {visible('group') && (
                              <td className={clsx(cellPad, 'text-xs font-bold text-slate-800 dark:text-slate-100')}>
                                <span className="block max-w-[320px] truncate">{row.groupLabel || row.groupKey}</span>
                                <span className="mt-0.5 block font-mono text-[10px] font-medium text-slate-400">{row.groupKey}</span>
                              </td>
                            )}
                            {visible('lineCount') && <td className={clsx(cellPad, 'text-right text-xs tabular-nums text-slate-600 dark:text-slate-300')}>{row.lineCount.toLocaleString()}</td>}
                            {visible('revenueBaseIn') && <td className={clsx(cellPad, 'text-right text-xs tabular-nums text-slate-700 dark:text-slate-200')}>{formatAmount(row.revenueAmountBaseIn)}</td>}
                            {visible('revenueBaseOut') && <td className={clsx(cellPad, 'text-right text-xs tabular-nums text-slate-500 dark:text-slate-400')}>{formatAmount(row.revenueAmountBaseOut)}</td>}
                            {visible('costBaseIn') && <td className={clsx(cellPad, 'text-right text-xs tabular-nums text-slate-700 dark:text-slate-200')}>{formatAmount(row.costAmountBaseIn)}</td>}
                            {visible('costBaseOut') && <td className={clsx(cellPad, 'text-right text-xs tabular-nums text-slate-500 dark:text-slate-400')}>{formatAmount(row.costAmountBaseOut)}</td>}
                            {visible('profitBaseIn') && <td className={clsx(cellPad, 'text-right text-xs font-semibold tabular-nums', profitColor(row.profitAmountBaseIn))}>{formatAmount(row.profitAmountBaseIn)}</td>}
                            {visible('profitBaseOut') && <td className={clsx(cellPad, 'text-right text-xs font-semibold tabular-nums', profitColor(-row.profitAmountBaseOut))}>{formatAmount(row.profitAmountBaseOut)}</td>}
                            {visible('profitBaseNet') && <td className={clsx(cellPad, 'text-right text-xs font-black tabular-nums', profitColor(row.profitAmountBaseNet))}>{formatAmount(row.profitAmountBaseNet)}</td>}
                            {visible('docCurrency') && <td className={clsx(cellPad, 'text-right text-xs')}><CurrencyBreakdown row={row} /></td>}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                          {visible('group') && <td className={clsx(cellPad, 'text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-100')}>Totals</td>}
                          {visible('lineCount') && <td className={clsx(cellPad, 'text-right text-xs font-bold tabular-nums text-slate-700 dark:text-slate-100')}>{report.totals.lineCount.toLocaleString()}</td>}
                          {visible('revenueBaseIn') && <td className={clsx(cellPad, 'text-right text-xs font-bold tabular-nums text-slate-700 dark:text-slate-100')}>{formatAmount(report.totals.revenueBaseIn)}</td>}
                          {visible('revenueBaseOut') && <td className={clsx(cellPad, 'text-right text-xs font-bold tabular-nums text-slate-500 dark:text-slate-300')}>{formatAmount(report.totals.revenueBaseOut)}</td>}
                          {visible('costBaseIn') && <td className={clsx(cellPad, 'text-right text-xs font-bold tabular-nums text-slate-700 dark:text-slate-100')}>{formatAmount(report.totals.costBaseIn)}</td>}
                          {visible('costBaseOut') && <td className={clsx(cellPad, 'text-right text-xs font-bold tabular-nums text-slate-500 dark:text-slate-300')}>{formatAmount(report.totals.costBaseOut)}</td>}
                          {visible('profitBaseIn') && <td className={clsx(cellPad, 'text-right text-xs font-black tabular-nums', profitColor(report.totals.profitBaseIn))}>{formatAmount(report.totals.profitBaseIn)}</td>}
                          {visible('profitBaseOut') && <td className={clsx(cellPad, 'text-right text-xs font-black tabular-nums', profitColor(-report.totals.profitBaseOut))}>{formatAmount(report.totals.profitBaseOut)}</td>}
                          {visible('profitBaseNet') && <td className={clsx(cellPad, 'text-right text-xs font-black tabular-nums', profitColor(report.totals.profitBaseNet))}>{formatAmount(report.totals.profitBaseNet)}</td>}
                          {visible('docCurrency') && <td className={clsx(cellPad, 'text-right text-[10px] font-bold uppercase tracking-widest text-slate-400')}>Per row</td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SalesGrossProfitReportPage: React.FC<SalesGrossProfitReportPageProps> = ({ mode }) => {
  const { t } = useTranslation('common');
  const isDocumentMode = mode === 'BY_DOCUMENT';
  const title = isDocumentMode
    ? t('salesGrossProfit.titleByDocument', { defaultValue: 'Gross Profit by Document' })
    : t('salesGrossProfit.titleByItem', { defaultValue: 'Gross Profit by Item' });

  const pageDefaultParams = useMemo(() => ({ ...grossProfitDefaultParams, mode }), [mode]);

  return (
    <ReportContainer<GrossProfitParams & { mode: GrossProfitMode }>
      title={title}
      subtitle={t('salesGrossProfit.subtitle', { defaultValue: 'Historical gross profit facts by invoice currency and base currency' })}
      initiator={({ onSubmit, initialParams }) => (
          <GrossProfitInitiator
          initialParams={initialParams}
          onSubmit={(params) => onSubmit({ ...params, mode })}
        />
      )}
      ReportContent={GrossProfitReportContent}
      defaultParams={pageDefaultParams}
      config={{
        paginated: false,
        density: 'comfortable',
        availableColumns: grossProfitReportColumns,
      }}
    />
  );
};

export default SalesGrossProfitReportPage;
