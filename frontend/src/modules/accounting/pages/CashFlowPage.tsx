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

const numberFmt = (n: number, currency?: string) =>
  `${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;

const Section: React.FC<{ title: string; total: number; items: CashFlowItem[]; currency: string }> = ({
  title,
  total,
  items,
  currency,
}) => (
  <div className="bg-white border rounded-xl p-4 shadow-sm">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <span className="text-sm font-semibold text-slate-700">{numberFmt(total, currency)}</span>
    </div>
    <div className="space-y-1">
      {items.length === 0 ? (
        <div className="text-sm text-slate-400">—</div>
      ) : (
        items.map((i, idx) => (
          <div key={`${i.accountId || 'item'}-${idx}`} className="flex justify-between text-sm text-slate-700">
            <span>{i.name}</span>
            <span className="font-mono">{numberFmt(i.amount, currency)}</span>
          </div>
        ))
      )}
    </div>
  </div>
);

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
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');
  const [data, setData] = useState<CashFlowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await accountingApi.getCashFlow(params.fromDate, params.toDate);
        setData(result);
      } catch (err: any) {
        console.error('Failed to load cash flow report', err);
        setError(err?.message || 'Failed to load cash flow report');
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
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Processing...</p>
              </div>
            </div>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 uppercase font-semibold">{t('cashFlow.netIncome')}</div>
                <div className="text-2xl font-bold">{numberFmt(data.netIncome, currency)}</div>
              </div>
              <div className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 uppercase font-semibold">{t('cashFlow.openingCash')}</div>
                <div className="text-2xl font-bold">{numberFmt(data.openingCashBalance, currency)}</div>
              </div>
              <div className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 uppercase font-semibold">{t('cashFlow.closingCash')}</div>
                <div className="text-2xl font-bold">{numberFmt(data.closingCashBalance, currency)}</div>
              </div>
            </div>

            <Section
              title={t('cashFlow.operating')}
              total={data.operating.total}
              items={data.operating.items}
              currency={currency}
            />
            <Section
              title={t('cashFlow.investing')}
              total={data.investing.total}
              items={data.investing.items}
              currency={currency}
            />
            <Section
              title={t('cashFlow.financing')}
              total={data.financing.total}
              items={data.financing.items}
              currency={currency}
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
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Processing...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const exportCashFlowToExcel = async (params: CashFlowParams) => {
  const result: CashFlowResponse = await accountingApi.getCashFlow(params.fromDate, params.toDate);
  const rows: Array<{ section: string; item: string; amount: number }> = [
    { section: 'Summary', item: 'Net Income', amount: result.netIncome },
    { section: 'Summary', item: 'Opening Cash', amount: result.openingCashBalance },
    { section: 'Summary', item: 'Closing Cash', amount: result.closingCashBalance },
    { section: 'Summary', item: 'Net Change in Cash', amount: result.netCashChange },
    ...result.operating.items.map((x) => ({ section: 'Operating', item: x.name, amount: x.amount })),
    { section: 'Operating', item: 'Total', amount: result.operating.total },
    ...result.investing.items.map((x) => ({ section: 'Investing', item: x.name, amount: x.amount })),
    { section: 'Investing', item: 'Total', amount: result.investing.total },
    ...result.financing.items.map((x) => ({ section: 'Financing', item: x.name, amount: x.amount })),
    { section: 'Financing', item: 'Total', amount: result.financing.total },
  ];

  exportToExcel(
    rows,
    [
      { header: 'Section', key: 'section' },
      { header: 'Item', key: 'item' },
      { header: 'Amount', key: 'amount', isNumber: true },
    ],
    `Cash-Flow-${result.period.from}-to-${result.period.to}`,
    'Cash Flow'
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
