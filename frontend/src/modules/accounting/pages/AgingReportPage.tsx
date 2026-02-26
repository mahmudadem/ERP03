import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { accountingApi, AgingReportData } from '../../../api/accountingApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { DatePicker } from '../components/shared/DatePicker';
import { AccountSelector } from '../components/shared/AccountSelector';

interface AgingParams {
  type: 'AR' | 'AP';
  asOfDate: string;
  includeZeroBalance: boolean;
  accountId?: string;
  accountLabel?: string;
}

const bucketColors = [
  'text-green-700',
  'text-green-600',
  'text-amber-600',
  'text-amber-700',
  'text-orange-700',
  'text-red-700',
];

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AgingReportInitiator: React.FC<{
  onSubmit: (params: AgingParams) => void;
  initialParams?: AgingParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const [type, setType] = useState<'AR' | 'AP'>(initialParams?.type || 'AR');
  const [asOfDate, setAsOfDate] = useState(
    initialParams?.asOfDate || new Date().toISOString().slice(0, 10)
  );
  const [includeZeroBalance, setIncludeZeroBalance] = useState(
    initialParams?.includeZeroBalance || false
  );
  const [accountId, setAccountId] = useState(initialParams?.accountId || '');
  const [accountLabel, setAccountLabel] = useState(initialParams?.accountLabel || '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ type, asOfDate, includeZeroBalance, accountId: accountId || undefined, accountLabel: accountLabel || undefined });
      }}
      className="space-y-6 animate-fade-in"
    >
      <div className="flex flex-col gap-6 relative group/form pt-2">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 relative z-10 items-end">
          
          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              {t('aging.type', { defaultValue: 'Report Type' })}
            </label>
            <div className="relative group">
              <select
                className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 text-slate-800 transition-all hover:bg-white hover:border-indigo-300 hover:shadow-sm focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer outline-none"
                value={type}
                onChange={(e) => setType(e.target.value as 'AR' | 'AP')}
              >
                <option value="AR">{t('aging.accountsReceivable', { defaultValue: 'Accounts Receivable' })}</option>
                <option value="AP">{t('aging.accountsPayable', { defaultValue: 'Accounts Payable' })}</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
              {t('aging.asOfDate', { defaultValue: 'As Of Date' })}
            </label>
            <div className="[&_input]:w-full [&_input]:appearance-none [&_input]:border [&_input]:border-slate-200 [&_input]:rounded-xl [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_input]:font-semibold [&_input]:bg-slate-50/50 [&_input]:text-slate-800 [&_input]:transition-all [&_input]:hover:bg-white [&_input]:hover:border-blue-300 [&_input]:hover:shadow-sm [&_input]:focus:bg-white [&_input]:focus:border-blue-500 [&_input]:focus:ring-4 [&_input]:focus:ring-blue-500/10 [&_input]:outline-none group relative">
              <DatePicker value={asOfDate} onChange={setAsOfDate} className="w-full" />
            </div>
          </div>

          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              {t('aging.account', { defaultValue: 'Account Filter' })}
            </label>
            <div className="[&_input]:w-full [&_input]:appearance-none [&_input]:border [&_input]:border-slate-200 [&_input]:rounded-xl [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_input]:font-semibold [&_input]:bg-slate-50/50 [&_input]:text-slate-800 [&_input]:transition-all [&_input]:hover:bg-white [&_input]:hover:border-amber-300 [&_input]:hover:shadow-sm [&_input]:focus:bg-white [&_input]:focus:border-amber-500 [&_input]:focus:ring-4 [&_input]:focus:ring-amber-500/10 [&_input]:outline-none group">
              <AccountSelector
                value={accountId}
                scope="all"
                onChange={(account) => {
                  if (!account) {
                    setAccountId('');
                    setAccountLabel('');
                    return;
                  }
                  setAccountId(account.id);
                  setAccountLabel(`${account.code} - ${account.name}`);
                }}
                placeholder={t('aging.targetAccount', { defaultValue: 'Optional: target a specific account' })}
              />
            </div>
          </div>

          <div className="md:col-span-12 space-y-2 mt-2">
            <label className="inline-flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-[11px] bg-slate-50/50 hover:bg-white hover:shadow-sm hover:border-slate-300 transition-all cursor-pointer group focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 w-auto">
              <div className="relative flex items-center justify-center shrink-0">
                <input
                  type="checkbox"
                  checked={includeZeroBalance}
                  onChange={(e) => setIncludeZeroBalance(e.target.checked)}
                  className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[4px] border-2 border-slate-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus:outline-none transition-all"
                />
                <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity drop-shadow-sm" viewBox="0 0 14 14" fill="none">
                  <path d="M3 8L6 11L11 3.5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-600 select-none group-hover:text-slate-900 transition-colors whitespace-nowrap overflow-hidden text-ellipsis">
                {t('aging.includeZeroBalance', { defaultValue: 'Include zero-balance accounts' })}
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-4 mt-2 border-t border-slate-100 relative z-10 w-full">
          <Button
            type="submit"
            className="w-full md:w-auto relative overflow-hidden group bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5 transition-all active:scale-[0.98] duration-200"
          >
            <span className="relative z-10 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest">
              {t('aging.load', { defaultValue: 'Generate Report' })}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
};

const AgingReportContent: React.FC<{ params: AgingParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const [data, setData] = useState<AgingReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setExpandedAccountId(null);
      try {
        const result = await accountingApi.getAgingReport(
          params.type,
          params.asOfDate,
          params.accountId,
          params.includeZeroBalance
        );
        setData(result);
      } catch (err: any) {
        setError(err?.message || t('aging.loadError', { defaultValue: 'Failed to load aging report.' }));
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.type, params.asOfDate, params.accountId, params.includeZeroBalance, t]);

  const totalsRow = useMemo(() => data?.totals || [], [data]);
  const reportTypeLabel =
    params.type === 'AR' ? t('aging.accountsReceivable') : t('aging.accountsPayable');
  const effectiveAsOfDate = data?.asOfDate || params.asOfDate;

  const toggle = (accountId: string) => {
    setExpandedAccountId((prev) => (prev === accountId ? null : accountId));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
              {t('aging.asOfDate', { defaultValue: 'As Of Date' })}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {formatCompanyDate(effectiveAsOfDate, settings)}
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
            {reportTypeLabel}
          </span>
          {params.includeZeroBalance && (
            <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-amber-50 rounded-full px-2 py-1">
              {t('aging.includeZeroBalance', { defaultValue: 'Include zero-balance accounts' })}
            </span>
          )}
          {params.accountLabel && (
            <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-indigo-50 rounded-full px-2 py-1">
              {params.accountLabel}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500">
            {data?.accounts.length || 0} {t('aging.account', { defaultValue: 'Account' })}
            {(data?.accounts.length || 0) === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {!params.accountId ? (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            {t('aging.modeAutoInfo', {
              defaultValue:
                'Automatic mode: report includes posting AR/AP-style accounts only. Cash and header/group accounts are excluded by design. Use Account filter to target a specific account or group.'
            })}
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
            {t('aging.modeManualInfo', {
              defaultValue:
                'Manual mode: report is scoped to the selected account (and its descendants when applicable). Use this when you know the exact AP/AR structure to analyze.'
            })}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        {loading ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-center min-h-[180px]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                  {t('aging.loading', { defaultValue: 'Loading report...' })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                <tr>
                  <th className="p-3 text-left font-semibold">{t('aging.account')}</th>
                  {(data?.buckets || []).map((bucket) => (
                    <th key={bucket} className="p-3 text-right font-semibold">
                      {bucket}
                    </th>
                  ))}
                  <th className="p-3 text-right font-semibold">{t('aging.total')}</th>
                </tr>
              </thead>

              <tbody>
                {!data || data.accounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(data?.buckets.length || 0) + 2}
                      className="px-4 py-20 text-center text-slate-500 text-sm bg-slate-50/30"
                    >
                      <div className="flex flex-col items-center justify-center gap-2 animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="font-bold text-slate-600 tracking-tight">{t('aging.empty', { defaultValue: 'No outstanding balances found' })}</p>
                        <p className="text-xs text-slate-400 font-medium max-w-xs">{t('aging.emptyDesc', { defaultValue: 'Adjust your filters or date range to see results.' })}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.accounts.map((account) => (
                    <React.Fragment key={account.accountId}>
                      <tr
                        className="border-t border-slate-100 hover:bg-blue-50/40 cursor-pointer"
                        onClick={() => toggle(account.accountId)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {expandedAccountId === account.accountId ? (
                              <ChevronDown className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="font-semibold text-slate-800">
                              {account.accountCode} - {account.accountName}
                            </span>
                          </div>
                        </td>
                        {account.bucketAmounts.map((amount, idx) => (
                          <td key={`${account.accountId}-bucket-${idx}`} className={`p-3 text-right font-medium ${bucketColors[idx] || 'text-slate-700'}`}>
                            {formatAmount(amount)}
                          </td>
                        ))}
                        <td className="p-3 text-right font-bold text-slate-900">{formatAmount(account.total)}</td>
                      </tr>

                      {expandedAccountId === account.accountId && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={(data?.buckets.length || 0) + 2} className="p-3">
                            <div className="text-xs font-semibold text-slate-600 mb-2">{t('aging.transactions')}</div>
                            <div className="overflow-auto rounded border border-slate-200 bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="text-left py-2 px-3 font-semibold">{t('aging.date')}</th>
                                    <th className="text-left py-2 px-3 font-semibold">{t('aging.description')}</th>
                                    <th className="text-right py-2 px-3 font-semibold">{t('aging.amount')}</th>
                                    <th className="text-right py-2 px-3 font-semibold">{t('aging.days')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {!account.entries || account.entries.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="py-3 px-3 text-center text-slate-400">
                                        {t('aging.noTransactions', { defaultValue: 'No transaction details available.' })}
                                      </td>
                                    </tr>
                                  ) : (
                                    account.entries.map((entry, index) => (
                                      <tr key={`${entry.id}-${index}`} className="border-t border-slate-100">
                                        <td className="py-2 px-3">{formatCompanyDate(entry.date, settings)}</td>
                                        <td className="py-2 px-3 text-slate-700">{entry.description || '-'}</td>
                                        <td className="py-2 px-3 text-right font-medium">{formatAmount(entry.amount)}</td>
                                        <td className="py-2 px-3 text-right font-medium">{entry.days}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>

              {data && data.accounts.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="p-3">{t('aging.totals')}</td>
                    {totalsRow.map((value, idx) => (
                      <td key={`totals-${idx}`} className="p-3 text-right">
                        {formatAmount(value)}
                      </td>
                    ))}
                    <td className="p-3 text-right">{formatAmount(data.grandTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const AgingReportPage: React.FC = () => {
  const { t } = useTranslation('accounting');

  return (
    <ReportContainer<AgingParams>
      title={t('aging.title', { defaultValue: 'Aging Report' })}
      subtitle={t('aging.subtitle', { defaultValue: 'Track outstanding receivables and payables by age buckets.' })}
      initiator={AgingReportInitiator}
      ReportContent={AgingReportContent}
      config={{ paginated: false }}
    />
  );
};

export default AgingReportPage;
