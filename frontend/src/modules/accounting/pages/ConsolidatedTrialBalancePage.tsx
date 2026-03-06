import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../components/shared/DatePicker';
import { Button } from '../../../components/ui/Button';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { accountingApi, CompanyGroupDTO, ConsolidatedTrialBalanceDTO } from '../../../api/accountingApi';
import { getCompanyToday } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { exportToExcel } from '../../../utils/exportUtils';

interface ConsolidatedTrialBalanceParams {
  groupId: string;
  asOfDate: string;
}

const ConsolidatedTrialBalanceInitiator: React.FC<{
  onSubmit: (params: ConsolidatedTrialBalanceParams) => void;
  initialParams?: ConsolidatedTrialBalanceParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const [groups, setGroups] = useState<CompanyGroupDTO[]>([]);
  const [groupId, setGroupId] = useState(initialParams?.groupId || '');
  const [asOfDate, setAsOfDate] = useState(initialParams?.asOfDate || getCompanyToday(settings));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialParams) {
      setAsOfDate(getCompanyToday(settings));
      setGroupId('');
      return;
    }
    setGroupId(initialParams.groupId);
    setAsOfDate(initialParams.asOfDate);
  }, [initialParams, settings]);

  useEffect(() => {
    const loadGroups = async () => {
      setLoading(true);
      try {
        const response = await accountingApi.listCompanyGroups();
        setGroups(response || []);
        if (!groupId && response.length > 0) {
          setGroupId(response[0].id);
        }
      } finally {
        setLoading(false);
      }
    };
    loadGroups();
  }, []);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!groupId) return;
        onSubmit({ groupId, asOfDate });
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t('consolidated.selectGroup')}
          </label>
          <select
            className="w-full border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            disabled={loading}
          >
            <option value="">{t('consolidated.selectGroup')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.reportingCurrency})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t('trialBalance.asOfDate')}
          </label>
          <DatePicker value={asOfDate} onChange={setAsOfDate} className="w-full" />
        </div>
        <div>
          <Button type="submit" disabled={!groupId} className="bg-slate-900 hover:bg-black text-white">
            {t('consolidated.load')}
          </Button>
        </div>
      </div>
    </form>
  );
};

const ConsolidatedTrialBalanceReportContent: React.FC<{ params: ConsolidatedTrialBalanceParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const [data, setData] = useState<ConsolidatedTrialBalanceDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await accountingApi.getConsolidatedTrialBalance(params.groupId, params.asOfDate);
        setData(response || null);
      } catch (err: any) {
        setError(err?.message || t('consolidated.loadError', { defaultValue: 'Failed to load consolidated trial balance.' }));
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.groupId, params.asOfDate, t]);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 min-h-0 overflow-auto p-6">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
            {t('trialBalance.loading')}
          </div>
        ) : !data ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
            {t('consolidated.empty', { defaultValue: 'No consolidated data available for selected parameters.' })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden dark:bg-slate-900 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    {t('consolidated.account')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    {t('consolidated.debit', { currency: data.reportingCurrency })}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    {t('consolidated.credit', { currency: data.reportingCurrency })}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    {t('consolidated.balance')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lines.map((line) => (
                  <tr key={line.accountId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">
                      {line.accountCode} - {line.accountName}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-200">
                      {line.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-200">
                      {line.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {line.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <tr className="font-semibold">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{t('consolidated.totals')}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">
                    {data.totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">
                    {data.totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">
                    {data.totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ConsolidatedTrialBalancePage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();

  const handleExportExcel = async (params: ConsolidatedTrialBalanceParams) => {
    const data = await accountingApi.getConsolidatedTrialBalance(params.groupId, params.asOfDate);
    const rows = data.lines.map((line) => ({
      account: `${line.accountCode} - ${line.accountName}`,
      debit: line.debit,
      credit: line.credit,
      balance: line.balance,
    }));

    rows.push({
      account: t('consolidated.totals'),
      debit: data.totals.debit,
      credit: data.totals.credit,
      balance: data.totals.balance,
    });

    await exportToExcel(
      rows,
      [
        { header: t('consolidated.account'), key: 'account' },
        { header: t('consolidated.debit', { currency: data.reportingCurrency }), key: 'debit', isNumber: true },
        { header: t('consolidated.credit', { currency: data.reportingCurrency }), key: 'credit', isNumber: true },
        { header: t('consolidated.balance'), key: 'balance', isNumber: true },
      ],
      `Consolidated-TB-${params.asOfDate}`,
      t('consolidated.title', { defaultValue: 'Consolidated Trial Balance' }),
      params.asOfDate
    );
  };

  return (
    <ReportContainer<ConsolidatedTrialBalanceParams>
      title={t('consolidated.title', { defaultValue: 'Consolidated Trial Balance' })}
      subtitle={t('consolidated.subtitle', { defaultValue: 'Group-level trial balance across companies' })}
      initiator={ConsolidatedTrialBalanceInitiator}
      ReportContent={ConsolidatedTrialBalanceReportContent}
      onExportExcel={handleExportExcel}
      defaultParams={{ groupId: '', asOfDate: getCompanyToday(settings) }}
      config={{ paginated: false }}
    />
  );
};

export default ConsolidatedTrialBalancePage;

