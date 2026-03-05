import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { accountingApi } from '../../../api/accountingApi';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate, getCompanyToday } from '../../../utils/dateUtils';
import { exportToExcel } from '../../../utils/exportUtils';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { DatePicker } from '../components/shared/DatePicker';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';
import { ReportContainer } from '../../../components/reports/ReportContainer';

interface TradingAccountParams {
  fromDate: string;
  toDate: string;
}

interface TradingAccountData {
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  grossProfitMargin: number;
  salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  period: { from: string; to: string };
  hasData: boolean;
}

const moneyFmt = (value: number, currency: string) =>
  `${value.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;

const TradingAccountInitiator: React.FC<{
  onSubmit: (params: TradingAccountParams) => void;
  initialParams?: TradingAccountParams | null;
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
            {t('profitLoss.fromDate', { defaultValue: 'From Date' })}
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full text-base" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('profitLoss.toDate', { defaultValue: 'To Date' })}
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full text-base" />
        </div>
        <div>
          <Button type="submit" className="bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded text-xs font-bold uppercase tracking-widest">
            {t('profitLoss.generate', { defaultValue: 'Generate' })}
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

const TradingAccountReportContent: React.FC<{ params: TradingAccountParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const { company } = useCompanyAccess();
  const currency = company?.baseCurrency || 'USD';
  const [data, setData] = useState<TradingAccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await accountingApi.getTradingAccount(params.fromDate, params.toDate);
        setData(response);
      } catch (err: any) {
        setError(err?.message || t('profitLoss.loadError', { defaultValue: 'Failed to load report' }));
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.fromDate, params.toDate, t]);

  const periodFrom = data?.period?.from || params.fromDate;
  const periodTo = data?.period?.to || params.toDate;
  const periodText = t('profitLoss.periodLabel', {
    defaultValue: '{{from}} - {{to}}',
    from: formatCompanyDate(periodFrom, settings),
    to: formatCompanyDate(periodTo, settings),
  });

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
            <span>{t('profitLoss.loading', { defaultValue: 'Loading...' })}</span>
          </div>
        ) : data ? (
          data.hasData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Net Sales</div>
                  <div className="text-2xl font-bold text-emerald-700">{moneyFmt(data.netSales, currency)}</div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Cost of Sales</div>
                  <div className="text-2xl font-bold text-rose-700">{moneyFmt(data.costOfSales, currency)}</div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Gross Profit</div>
                  <div className={`text-2xl font-bold ${data.grossProfit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    {moneyFmt(Math.abs(data.grossProfit), currency)}
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 uppercase font-semibold">GP Margin</div>
                  <div className="text-2xl font-bold text-slate-900">{isFinite(data.grossProfitMargin) ? data.grossProfitMargin.toFixed(2) : '0.00'}%</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownCard
                  title="Sales Breakdown"
                  rows={data.salesByAccount}
                  totalLabel={t('profitLoss.total', { defaultValue: 'Total' })}
                  total={data.netSales}
                  emptyLabel="No sales accounts in this period"
                  totalClassName="text-emerald-700"
                  currency={currency}
                />
                <BreakdownCard
                  title="Cost of Sales Breakdown"
                  rows={data.cogsByAccount}
                  totalLabel={t('profitLoss.total', { defaultValue: 'Total' })}
                  total={data.costOfSales}
                  emptyLabel="No cost of sales accounts in this period"
                  totalClassName="text-rose-700"
                  currency={currency}
                />
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">No Sales or COGS accounts configured.</p>
                <p className="text-sm mt-1">Assign P&amp;L Subgroups in Chart of Accounts to enable this report.</p>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white border rounded-xl p-6 shadow-sm text-slate-500">{t('profitLoss.loading', { defaultValue: 'Loading...' })}</div>
        )}
      </div>
    </div>
  );
};

const TradingAccountPage: React.FC = () => {
  const { settings } = useCompanySettings();

  const handleExportExcel = async (params: TradingAccountParams) => {
    const response: TradingAccountData = await accountingApi.getTradingAccount(params.fromDate, params.toDate);
    const rows: any[] = [];

    response.salesByAccount.forEach((acc) =>
      rows.push({ section: 'Sales', account: acc.accountName || acc.accountId, amount: acc.amount })
    );
    rows.push({ section: 'Sales', account: 'Total Net Sales', amount: response.netSales });

    response.cogsByAccount.forEach((acc) =>
      rows.push({ section: 'Cost of Sales', account: acc.accountName || acc.accountId, amount: acc.amount })
    );
    rows.push({ section: 'Cost of Sales', account: 'Total Cost of Sales', amount: response.costOfSales });

    rows.push({ section: 'Summary', account: 'Gross Profit', amount: response.grossProfit });
    rows.push({ section: 'Summary', account: 'Gross Profit Margin %', amount: response.grossProfitMargin });

    await exportToExcel(
      rows,
      [
        { header: 'Section', key: 'section' },
        { header: 'Account', key: 'account' },
        { header: 'Amount', key: 'amount', isNumber: true },
      ],
      `Trading-Account-${response.period.from}-${response.period.to}`,
      'Trading Account (Gross Profit)',
      `Period: ${formatCompanyDate(response.period.from, settings)} - ${formatCompanyDate(response.period.to, settings)}`
    );
  };

  return (
    <ReportContainer<TradingAccountParams>
      title="Trading Account (Gross Profit)"
      subtitle="Revenue vs Direct Costs"
      initiator={TradingAccountInitiator}
      ReportContent={TradingAccountReportContent}
      onExportExcel={handleExportExcel}
      config={{ paginated: false }}
    />
  );
};

export default TradingAccountPage;
