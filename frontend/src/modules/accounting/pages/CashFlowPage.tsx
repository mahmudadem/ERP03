import React, { useEffect, useState } from 'react';
import { accountingApi } from '../../../api/accountingApi';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../components/shared/DatePicker';

const numberFmt = (n: number, currency?: string) =>
  `${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;

const Section: React.FC<{ title: string; total: number; items: any[]; currency: string }> = ({ title, total, items, currency }) => (
  <div className="bg-white border rounded-xl p-4 shadow-sm">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <span className="text-sm font-semibold text-slate-700">{numberFmt(total, currency)}</span>
    </div>
    <div className="space-y-1">
      {items.map((i, idx) => (
        <div key={idx} className="flex justify-between text-sm text-slate-700">
          <span>{i.name}</span>
          <span className="font-mono">{numberFmt(i.amount, currency)}</span>
        </div>
      ))}
    </div>
  </div>
);

const CashFlowPage: React.FC = () => {
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');
  const [from, setFrom] = useState<string>(() => `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await accountingApi.getCashFlow(from, to);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return (
      <div className="p-6">
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border rounded" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('cashFlow.load')}
        </button>
      </div>
    );
  }

  const currency = data.baseCurrency || '';

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('cashFlow.title')}</h1>
          <p className="text-sm text-slate-600">
            {t('cashFlow.period', { from: formatCompanyDate(data.period.from, settings), to: formatCompanyDate(data.period.to, settings) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={from} onChange={setFrom} className="w-36" />
          <DatePicker value={to} onChange={setTo} className="w-36" />
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 border rounded text-sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('cashFlow.apply')}
          </button>
        </div>
      </div>

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

      <Section title={t('cashFlow.operating')} total={data.operating.total} items={data.operating.items} currency={currency} />
      <Section title={t('cashFlow.investing')} total={data.investing.total} items={data.investing.items} currency={currency} />
      <Section title={t('cashFlow.financing')} total={data.financing.total} items={data.financing.items} currency={currency} />

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex justify-between text-lg font-bold">
          <span>{t('cashFlow.netChange')}</span>
          <span>{numberFmt(data.netCashChange, currency)}</span>
        </div>
      </div>
    </div>
  );
};

export default CashFlowPage;
