import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { accountingApi } from '../../../api/accountingApi';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate, getCompanyToday } from '../../../utils/dateUtils';
import { exportToExcel } from '../../../utils/exportUtils';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { DatePicker } from '../components/shared/DatePicker';
import { useTranslation } from 'react-i18next';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { ReportContainer } from '../../../components/reports/ReportContainer';

interface ProfitAndLossParams {
  fromDate: string;
  toDate: string;
}

interface StructuredProfitAndLoss {
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  otherRevenue: number;
  otherExpenses: number;
  salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  opexByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  otherRevenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  otherExpensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  unclassifiedRevenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  unclassifiedExpensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
}

interface ProfitAndLossData {
  revenue: number;
  expenses: number;
  netProfit: number;
  revenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  expensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  period: { from: string; to: string };
  structured?: StructuredProfitAndLoss;
}

const moneyFmt = (value: number, currency: string) =>
  `${value.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;

const expenseFmt = (value: number, currency: string) => `(${moneyFmt(Math.abs(value), currency)})`;

const ProfitAndLossInitiator: React.FC<{
  onSubmit: (params: ProfitAndLossParams) => void;
  initialParams?: ProfitAndLossParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');
  const today = getCompanyToday(settings);
  const defaultFrom = `${today.split('-')[0]}-01-01`;

  const [fromDate, setFromDate] = useState(initialParams?.fromDate || defaultFrom);
  const [toDate, setToDate] = useState(initialParams?.toDate || today);

  useEffect(() => {
    if (!initialParams) {
      setFromDate(defaultFrom);
      setToDate(today);
    }
  }, [defaultFrom, today, initialParams]);

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
            {t('profitLoss.fromDate')}
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full text-base" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('profitLoss.toDate')}
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full text-base" />
        </div>
        <div>
          <Button type="submit" className="bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded text-xs font-bold uppercase tracking-widest">
            {t('profitLoss.generate')}
          </Button>
        </div>
      </div>
    </form>
  );
};

const BreakdownCard: React.FC<{
  title: string;
  rows: Array<{ accountId: string; accountName: string; amount: number }>;
  totalLabel: string;
  total: number;
  emptyLabel: string;
  totalClassName: string;
  currency: string;
}> = ({ title, rows, totalLabel, total, emptyLabel, totalClassName, currency }) => (
  <div className="bg-white border rounded-xl p-4 shadow-sm">
    <h3 className="text-lg font-bold text-slate-900 mb-4">{title}</h3>
    {rows.length === 0 ? (
      <div className="text-sm text-slate-400 py-4 text-center">{emptyLabel}</div>
    ) : (
      <div className="space-y-1">
        {rows.map((row, index) => (
          <div key={`${row.accountId}-${index}`} className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-700">{row.accountName || row.accountId}</span>
            <span className={`font-mono font-semibold ${totalClassName}`}>{moneyFmt(row.amount, currency)}</span>
          </div>
        ))}
      </div>
    )}
    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200">
      <span className="font-bold text-slate-900">{totalLabel}</span>
      <span className={`font-mono text-lg font-bold ${totalClassName}`}>{moneyFmt(total, currency)}</span>
    </div>
  </div>
);

const ProfitAndLossReportContent: React.FC<{ params: ProfitAndLossParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const { company } = useCompanyAccess();
  const currency = company?.baseCurrency || 'USD';
  const [data, setData] = useState<ProfitAndLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedView, setDetailedView] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await accountingApi.getProfitAndLoss(params.fromDate, params.toDate);
        setData(response);
      } catch (err: any) {
        setError(err?.message || t('profitLoss.loadError'));
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.fromDate, params.toDate, t]);

  useEffect(() => {
    if (!data?.structured) {
      setDetailedView(false);
    }
  }, [data?.structured]);

  const periodFrom = data?.period?.from || params.fromDate;
  const periodTo = data?.period?.to || params.toDate;
  const periodText = t('profitLoss.periodLabel', {
    from: formatCompanyDate(periodFrom, settings),
    to: formatCompanyDate(periodTo, settings),
  });

  const margin = useMemo(() => {
    if (!data || data.revenue === 0) return 0;
    return (data.netProfit / data.revenue) * 100;
  }, [data]);

  const hasStructured = !!data?.structured;

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
            {t('balanceSheet.baseCurrency', { defaultValue: 'Base Currency' })}: {currency}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading && !data ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center gap-3 text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>{t('profitLoss.loading')}</span>
          </div>
        ) : data ? (
          <>
            {hasStructured && (
              <div className="flex justify-end">
                <button
                  onClick={() => setDetailedView((prev) => !prev)}
                  className="text-xs font-bold uppercase tracking-widest px-3 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                >
                  {detailedView
                    ? t('profitLoss.summaryView', { defaultValue: 'Summary View' })
                    : t('profitLoss.detailedView', { defaultValue: 'Detailed View' })}
                </button>
              </div>
            )}

            {data.structured ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    {t('profitLoss.netSales', { defaultValue: 'Net Sales' })}
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{moneyFmt(data.structured.netSales, currency)}</div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    {t('profitLoss.cogs', { defaultValue: 'COGS' })}
                  </div>
                  <div className="text-2xl font-bold text-rose-700">{moneyFmt(data.structured.costOfSales, currency)}</div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    {t('profitLoss.grossProfit', { defaultValue: 'Gross Profit' })}
                  </div>
                  <div className={`text-2xl font-bold ${data.structured.grossProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    {moneyFmt(Math.abs(data.structured.grossProfit), currency)}
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    {t('profitLoss.operatingProfit', { defaultValue: 'Operating Profit' })}
                  </div>
                  <div className={`text-2xl font-bold ${data.structured.operatingProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    {moneyFmt(Math.abs(data.structured.operatingProfit), currency)}
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    {data.netProfit >= 0 ? t('profitLoss.netProfit') : t('profitLoss.netLoss')}
                  </div>
                  <div className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    {moneyFmt(Math.abs(data.netProfit), currency)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">{t('profitLoss.totalRevenue')}</div>
                  <div className="text-2xl font-bold text-emerald-700">{moneyFmt(data.revenue, currency)}</div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">{t('profitLoss.totalExpenses')}</div>
                  <div className="text-2xl font-bold text-rose-700">{moneyFmt(data.expenses, currency)}</div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    {data.netProfit >= 0 ? t('profitLoss.netProfit') : t('profitLoss.netLoss')}
                  </div>
                  <div className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    {moneyFmt(Math.abs(data.netProfit), currency)}
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">{t('profitLoss.margin')}</div>
                  <div className="text-2xl font-bold text-slate-900">{isFinite(margin) ? margin.toFixed(2) : '0.00'}%</div>
                </div>
              </div>
            )}

            {data.structured && detailedView ? (
              <>
                <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
                  <div>
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-slate-900">{t('profitLoss.netSales', { defaultValue: 'Net Sales' })}</span>
                      <span className="font-mono font-bold text-emerald-700">{moneyFmt(data.structured.netSales, currency)}</span>
                    </div>
                    {data.structured.salesByAccount.length > 0 && (
                      <div className="pl-4 mt-2 space-y-1">
                        {data.structured.salesByAccount.map((row, index) => (
                          <div key={`${row.accountId}-${index}`} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{row.accountName || row.accountId}</span>
                            <span className="font-mono text-emerald-700">{moneyFmt(row.amount, currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-slate-900">{t('profitLoss.costOfSales', { defaultValue: 'Cost of Sales' })}</span>
                      <span className="font-mono font-bold text-rose-700">{expenseFmt(data.structured.costOfSales, currency)}</span>
                    </div>
                    {data.structured.cogsByAccount.length > 0 && (
                      <div className="pl-4 mt-2 space-y-1">
                        {data.structured.cogsByAccount.map((row, index) => (
                          <div key={`${row.accountId}-${index}`} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{row.accountName || row.accountId}</span>
                            <span className="font-mono text-rose-700">{expenseFmt(row.amount, currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900">{t('profitLoss.grossProfit', { defaultValue: 'Gross Profit' })}</span>
                    <span className={`font-mono text-xl font-bold ${data.structured.grossProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                      {moneyFmt(Math.abs(data.structured.grossProfit), currency)}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-slate-900">{t('profitLoss.operatingExpenses', { defaultValue: 'Operating Expenses' })}</span>
                      <span className="font-mono font-bold text-rose-700">{expenseFmt(data.structured.operatingExpenses, currency)}</span>
                    </div>
                    {data.structured.opexByAccount.length > 0 && (
                      <div className="pl-4 mt-2 space-y-1">
                        {data.structured.opexByAccount.map((row, index) => (
                          <div key={`${row.accountId}-${index}`} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{row.accountName || row.accountId}</span>
                            <span className="font-mono text-rose-700">{expenseFmt(row.amount, currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900">{t('profitLoss.operatingProfit', { defaultValue: 'Operating Profit' })}</span>
                    <span className={`font-mono text-xl font-bold ${data.structured.operatingProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                      {moneyFmt(Math.abs(data.structured.operatingProfit), currency)}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{t('profitLoss.otherRevenue', { defaultValue: 'Other Revenue' })}</span>
                      <span className="font-mono font-bold text-emerald-700">{moneyFmt(data.structured.otherRevenue, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{t('profitLoss.otherExpenses', { defaultValue: 'Other Expenses' })}</span>
                      <span className="font-mono font-bold text-rose-700">{expenseFmt(data.structured.otherExpenses, currency)}</span>
                    </div>
                    {data.structured.unclassifiedRevenueByAccount.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{t('profitLoss.unclassifiedRevenue', { defaultValue: 'Unclassified Revenue' })}</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {moneyFmt(data.structured.unclassifiedRevenueByAccount.reduce((sum, row) => sum + row.amount, 0), currency)}
                        </span>
                      </div>
                    )}
                    {data.structured.unclassifiedExpensesByAccount.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{t('profitLoss.unclassifiedExpenses', { defaultValue: 'Unclassified Expenses' })}</span>
                        <span className="font-mono font-bold text-rose-700">
                          {expenseFmt(data.structured.unclassifiedExpensesByAccount.reduce((sum, row) => sum + row.amount, 0), currency)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-300 pt-3 flex items-center justify-between">
                    <span className="text-lg font-black text-slate-900">{t('profitLoss.netProfit', { defaultValue: 'Net Profit' })}</span>
                    <span className={`font-mono text-2xl font-black ${data.netProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                      {moneyFmt(Math.abs(data.netProfit), currency)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <BreakdownCard
                    title={t('profitLoss.salesBreakdown', { defaultValue: 'Sales Breakdown' })}
                    rows={data.structured.salesByAccount}
                    totalLabel={t('profitLoss.netSales', { defaultValue: 'Net Sales' })}
                    total={data.structured.netSales}
                    emptyLabel={t('profitLoss.noSalesAccounts', { defaultValue: 'No sales accounts' })}
                    totalClassName="text-emerald-700"
                    currency={currency}
                  />
                  <BreakdownCard
                    title={t('profitLoss.costOfSalesBreakdown', { defaultValue: 'Cost of Sales Breakdown' })}
                    rows={data.structured.cogsByAccount}
                    totalLabel={t('profitLoss.costOfSales', { defaultValue: 'Cost of Sales' })}
                    total={data.structured.costOfSales}
                    emptyLabel={t('profitLoss.noCogsAccounts', { defaultValue: 'No COGS accounts' })}
                    totalClassName="text-rose-700"
                    currency={currency}
                  />
                  <BreakdownCard
                    title={t('profitLoss.operatingExpensesBreakdown', { defaultValue: 'Operating Expenses Breakdown' })}
                    rows={data.structured.opexByAccount}
                    totalLabel={t('profitLoss.operatingExpenses', { defaultValue: 'Operating Expenses' })}
                    total={data.structured.operatingExpenses}
                    emptyLabel={t('profitLoss.noOperatingExpenseAccounts', { defaultValue: 'No operating expense accounts' })}
                    totalClassName="text-rose-700"
                    currency={currency}
                  />
                  <BreakdownCard
                    title={t('profitLoss.otherRevenueBreakdown', { defaultValue: 'Other Revenue Breakdown' })}
                    rows={data.structured.otherRevenueByAccount}
                    totalLabel={t('profitLoss.otherRevenue', { defaultValue: 'Other Revenue' })}
                    total={data.structured.otherRevenue}
                    emptyLabel={t('profitLoss.noOtherRevenueAccounts', { defaultValue: 'No other revenue accounts' })}
                    totalClassName="text-emerald-700"
                    currency={currency}
                  />
                  <BreakdownCard
                    title={t('profitLoss.otherExpensesBreakdown', { defaultValue: 'Other Expenses Breakdown' })}
                    rows={data.structured.otherExpensesByAccount}
                    totalLabel={t('profitLoss.otherExpenses', { defaultValue: 'Other Expenses' })}
                    total={data.structured.otherExpenses}
                    emptyLabel={t('profitLoss.noOtherExpenseAccounts', { defaultValue: 'No other expense accounts' })}
                    totalClassName="text-rose-700"
                    currency={currency}
                  />
                  {(data.structured.unclassifiedRevenueByAccount.length > 0 || data.structured.unclassifiedExpensesByAccount.length > 0) && (
                    <BreakdownCard
                      title={t('profitLoss.unclassifiedAccounts', { defaultValue: 'Unclassified Accounts' })}
                      rows={[
                        ...data.structured.unclassifiedRevenueByAccount,
                        ...data.structured.unclassifiedExpensesByAccount.map((row) => ({
                          ...row,
                          amount: -Math.abs(row.amount),
                        })),
                      ]}
                      totalLabel={t('profitLoss.netUnclassifiedImpact', { defaultValue: 'Net Unclassified Impact' })}
                      total={
                        data.structured.unclassifiedRevenueByAccount.reduce((sum, row) => sum + row.amount, 0) -
                        data.structured.unclassifiedExpensesByAccount.reduce((sum, row) => sum + row.amount, 0)
                      }
                      emptyLabel={t('profitLoss.noUnclassifiedAccounts', { defaultValue: 'No unclassified accounts' })}
                      totalClassName="text-slate-700"
                      currency={currency}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownCard
                  title={t('profitLoss.revenueBreakdown')}
                  rows={data.revenueByAccount}
                  totalLabel={t('profitLoss.total')}
                  total={data.revenue}
                  emptyLabel={t('profitLoss.noRevenue')}
                  totalClassName="text-emerald-700"
                  currency={currency}
                />
                <BreakdownCard
                  title={t('profitLoss.expenseBreakdown')}
                  rows={data.expensesByAccount}
                  totalLabel={t('profitLoss.total')}
                  total={data.expenses}
                  emptyLabel={t('profitLoss.noExpense')}
                  totalClassName="text-rose-700"
                  currency={currency}
                />
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border rounded-xl p-6 shadow-sm text-slate-500">{t('profitLoss.loading')}</div>
        )}
      </div>
    </div>
  );
};

const ProfitAndLossPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();

  const handleExportExcel = async (params: ProfitAndLossParams) => {
    const response: ProfitAndLossData = await accountingApi.getProfitAndLoss(params.fromDate, params.toDate);
    const rows: any[] = [];

    if (response.structured) {
      const pushSection = (
        section: string,
        sectionRows: Array<{ accountId: string; accountName: string; amount: number }>,
        subtotalLabel: string,
        subtotalValue: number
      ) => {
        sectionRows.forEach((acc) =>
          rows.push({ section, account: acc.accountName || acc.accountId, amount: acc.amount })
        );
        rows.push({ section, account: subtotalLabel, amount: subtotalValue });
      };

      pushSection(
        t('profitLoss.netSales', { defaultValue: 'Net Sales' }),
        response.structured.salesByAccount,
        t('profitLoss.netSalesTotal', { defaultValue: 'Net Sales Total' }),
        response.structured.netSales
      );
      pushSection(
        t('profitLoss.costOfSales', { defaultValue: 'Cost of Sales' }),
        response.structured.cogsByAccount,
        t('profitLoss.costOfSalesTotal', { defaultValue: 'Cost of Sales Total' }),
        response.structured.costOfSales
      );
      rows.push({
        section: t('profitLoss.summary', { defaultValue: 'Summary' }),
        account: t('profitLoss.grossProfit', { defaultValue: 'Gross Profit' }),
        amount: response.structured.grossProfit,
      });

      pushSection(
        t('profitLoss.operatingExpenses', { defaultValue: 'Operating Expenses' }),
        response.structured.opexByAccount,
        t('profitLoss.operatingExpensesTotal', { defaultValue: 'Operating Expenses Total' }),
        response.structured.operatingExpenses
      );
      rows.push({
        section: t('profitLoss.summary', { defaultValue: 'Summary' }),
        account: t('profitLoss.operatingProfit', { defaultValue: 'Operating Profit' }),
        amount: response.structured.operatingProfit,
      });

      pushSection(
        t('profitLoss.otherRevenue', { defaultValue: 'Other Revenue' }),
        response.structured.otherRevenueByAccount,
        t('profitLoss.otherRevenueTotal', { defaultValue: 'Other Revenue Total' }),
        response.structured.otherRevenue
      );
      pushSection(
        t('profitLoss.otherExpenses', { defaultValue: 'Other Expenses' }),
        response.structured.otherExpensesByAccount,
        t('profitLoss.otherExpensesTotal', { defaultValue: 'Other Expenses Total' }),
        response.structured.otherExpenses
      );

      if (response.structured.unclassifiedRevenueByAccount.length > 0) {
        pushSection(
          t('profitLoss.unclassifiedRevenue', { defaultValue: 'Unclassified Revenue' }),
          response.structured.unclassifiedRevenueByAccount,
          t('profitLoss.unclassifiedRevenueTotal', { defaultValue: 'Unclassified Revenue Total' }),
          response.structured.unclassifiedRevenueByAccount.reduce((sum, row) => sum + row.amount, 0)
        );
      }
      if (response.structured.unclassifiedExpensesByAccount.length > 0) {
        pushSection(
          t('profitLoss.unclassifiedExpenses', { defaultValue: 'Unclassified Expenses' }),
          response.structured.unclassifiedExpensesByAccount,
          t('profitLoss.unclassifiedExpensesTotal', { defaultValue: 'Unclassified Expenses Total' }),
          response.structured.unclassifiedExpensesByAccount.reduce((sum, row) => sum + row.amount, 0)
        );
      }

      rows.push({
        section: t('profitLoss.summary', { defaultValue: 'Summary' }),
        account: t('profitLoss.netProfit', { defaultValue: 'Net Profit' }),
        amount: response.netProfit,
      });
    } else {
      response.revenueByAccount.forEach((acc) =>
        rows.push({ section: t('profitLoss.revenue'), account: acc.accountName || acc.accountId, amount: acc.amount })
      );
      rows.push({ section: t('profitLoss.revenue'), account: t('profitLoss.totalRevenue'), amount: response.revenue });
      response.expensesByAccount.forEach((acc) =>
        rows.push({ section: t('profitLoss.expenses'), account: acc.accountName || acc.accountId, amount: acc.amount })
      );
      rows.push({ section: t('profitLoss.expenses'), account: t('profitLoss.totalExpenses'), amount: response.expenses });
      rows.push({ section: t('profitLoss.net'), account: t('profitLoss.netProfitLoss'), amount: response.netProfit });
    }

    await exportToExcel(
      rows,
      [
        { header: t('profitLoss.section'), key: 'section' },
        { header: t('profitLoss.account'), key: 'account' },
        { header: t('profitLoss.amount'), key: 'amount', isNumber: true },
      ],
      `Profit-Loss-${response.period.from}-${response.period.to}`,
      t('profitLoss.title'),
      t('profitLoss.periodLabel', {
        from: formatCompanyDate(response.period.from, settings),
        to: formatCompanyDate(response.period.to, settings),
      })
    );
  };

  return (
    <ReportContainer<ProfitAndLossParams>
      title={t('profitLoss.title')}
      subtitle={t('profitLoss.subtitle')}
      initiator={ProfitAndLossInitiator}
      ReportContent={ProfitAndLossReportContent}
      onExportExcel={handleExportExcel}
      config={{ paginated: false }}
    />
  );
};

export default ProfitAndLossPage;
