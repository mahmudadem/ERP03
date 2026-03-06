import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccountDTO,
  BudgetDTO,
  CostCenterDTO,
  FiscalYearDTO,
  accountingApi,
} from '../../../api/accountingApi';
import { DatePicker } from '../components/shared/DatePicker';
import { errorHandler } from '../../../services/errorHandler';
import { Button } from '../../../components/ui/Button';
import { ReportContainer } from '../../../components/reports/ReportContainer';

interface BudgetVsActualParams {
  budgetId: string;
  costCenterId?: string;
  fromDate: string;
  toDate: string;
  showMonthlyBreakdown: boolean;
}

interface BudgetActualRow {
  accountId: string;
  costCenterId?: string;
  accountLabel: string;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number;
  monthlyBudget: number[];
  monthlyActual: number[];
}

interface LedgerEntryLike {
  accountId?: string;
  costCenterId?: string;
  date?: string;
  debit?: number;
  credit?: number;
  amount?: number;
  side?: 'Debit' | 'Credit' | string;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const safeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeMonthly = (values?: number[]) => {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: 12 }, (_, idx) => safeNumber(source[idx] ?? 0));
};

const lineKey = (accountId: string, costCenterId?: string) => `${accountId}|${costCenterId || ''}`;

const getFiscalMonthIndex = (dateText: string, fiscalStart: string) => {
  const date = new Date(dateText);
  const start = new Date(fiscalStart);
  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime())) return -1;
  return (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
};

const sumForIndexes = (values: number[], indexes: number[]) =>
  indexes.reduce((sum, index) => sum + safeNumber(values[index] ?? 0), 0);

const getMonthIndexesInRange = (fiscalYear: FiscalYearDTO | null, fromDate: string, toDate: string) => {
  if (!fiscalYear) return [];
  const rangeStart = new Date(fromDate);
  const rangeEnd = new Date(toDate);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) return [];

  const fiscalStart = new Date(fiscalYear.startDate);
  return Array.from({ length: 12 }, (_, idx) => {
    const monthStart = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + idx, 1);
    const monthEnd = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + idx + 1, 0);
    return monthEnd >= rangeStart && monthStart <= rangeEnd ? idx : -1;
  }).filter((idx) => idx >= 0);
};

const monthLabelForIndex = (fiscalYear: FiscalYearDTO | null, monthIndex: number) => {
  if (!fiscalYear) return `M${monthIndex + 1}`;
  const fiscalStart = new Date(fiscalYear.startDate);
  const date = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + monthIndex, 1);
  return date.toLocaleString(undefined, { month: 'short', year: 'numeric' });
};

const varianceClass = (variance: number) => {
  if (variance < 0) return 'text-red-600';
  if (variance > 0) return 'text-green-600';
  return 'text-slate-600 dark:text-slate-300';
};

const BudgetVsActualInitiator: React.FC<{
  onSubmit: (params: BudgetVsActualParams) => void;
  initialParams?: BudgetVsActualParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearDTO[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterDTO[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState(initialParams?.budgetId || '');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState(initialParams?.costCenterId || '');
  const [fromDate, setFromDate] = useState(initialParams?.fromDate || '');
  const [toDate, setToDate] = useState(initialParams?.toDate || '');
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(
    initialParams?.showMonthlyBreakdown || false
  );

  const fiscalYearById = useMemo(() => {
    const map = new Map<string, FiscalYearDTO>();
    fiscalYears.forEach((fy) => map.set(fy.id, fy));
    return map;
  }, [fiscalYears]);

  const selectedBudget = useMemo(
    () => budgets.find((budget) => budget.id === selectedBudgetId) || null,
    [budgets, selectedBudgetId]
  );

  useEffect(() => {
    const loadMeta = async () => {
      setLoadingMeta(true);
      try {
        const [budgetList, fiscalYearList, costCenterList] = await Promise.all([
          accountingApi.listBudgets(),
          accountingApi.listFiscalYears(),
          accountingApi.listCostCenters(),
        ]);

        const sortedBudgets = [...budgetList].sort((a, b) => {
          if (a.status === b.status) return b.version - a.version;
          if (a.status === 'APPROVED') return -1;
          if (b.status === 'APPROVED') return 1;
          return b.version - a.version;
        });

        setBudgets(sortedBudgets);
        setFiscalYears(fiscalYearList);
        setCostCenters(costCenterList.filter((cc) => cc.status === 'ACTIVE'));

        if (!selectedBudgetId && sortedBudgets.length > 0) {
          const preferredBudget = sortedBudgets.find((budget) => budget.status === 'APPROVED') || sortedBudgets[0];
          setSelectedBudgetId(preferredBudget.id);
          const fy = fiscalYearList.find((item) => item.id === preferredBudget.fiscalYearId);
          setFromDate(fy?.startDate || '');
          setToDate(fy?.endDate || '');
        }
      } catch (err) {
        errorHandler.showError(err);
      } finally {
        setLoadingMeta(false);
      }
    };

    loadMeta();
  }, []);

  useEffect(() => {
    if (!selectedBudget) return;
    const fiscalYear = fiscalYearById.get(selectedBudget.fiscalYearId);
    if (!fiscalYear) return;
    if (!fromDate) setFromDate(fiscalYear.startDate);
    if (!toDate) setToDate(fiscalYear.endDate);
  }, [selectedBudget, fiscalYearById, fromDate, toDate]);

  if (loadingMeta) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-300">
        {t('budgetVsActual.loading', { defaultValue: 'Loading...' })}
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selectedBudgetId) return;
        onSubmit({
          budgetId: selectedBudgetId,
          costCenterId: selectedCostCenterId || undefined,
          fromDate,
          toDate,
          showMonthlyBreakdown,
        });
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-300">
            {t('budgetVsActual.selectBudget')}
          </label>
          <select
            className="w-full border rounded px-3 py-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
            value={selectedBudgetId}
            onChange={(event) => setSelectedBudgetId(event.target.value)}
          >
            <option value="">{t('budgetVsActual.selectBudget')}</option>
            {budgets.map((budget) => (
              <option key={budget.id} value={budget.id}>
                {t('budgetVsActual.option', {
                  name: budget.name,
                  version: budget.version,
                  status: t(`budget.statuses.${budget.status.toLowerCase()}`, budget.status),
                })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-300">
            {t('budget.costCenter')}
          </label>
          <select
            className="w-full border rounded px-3 py-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
            value={selectedCostCenterId}
            onChange={(event) => setSelectedCostCenterId(event.target.value)}
          >
            <option value="">{t('budget.allCostCenters', { defaultValue: 'All cost centers' })}</option>
            {costCenters.map((costCenter) => (
              <option key={costCenter.id} value={costCenter.id}>
                {costCenter.code} - {costCenter.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-300">
            {t('profitLoss.fromDate')}
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full text-base" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-300">
            {t('profitLoss.toDate')}
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full text-base" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showMonthlyBreakdown}
              onChange={(event) => setShowMonthlyBreakdown(event.target.checked)}
            />
            {t('budgetVsActual.monthlyBreakdown', { defaultValue: 'Monthly breakdown' })}
          </label>
          <Button type="submit" disabled={!selectedBudgetId} className="bg-slate-900 hover:bg-black text-white">
            {t('trialBalance.generate')}
          </Button>
        </div>
      </div>
    </form>
  );
};

const BudgetVsActualReportContent: React.FC<{ params: BudgetVsActualParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BudgetActualRow[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<FiscalYearDTO | null>(null);
  const [accountsMap, setAccountsMap] = useState<Map<string, AccountDTO>>(new Map());
  const [budgetsMap, setBudgetsMap] = useState<Map<string, BudgetDTO>>(new Map());

  const loadLedgerEntries = async (from: string, to: string, costCenterId?: string) => {
    const allEntries: LedgerEntryLike[] = [];
    const pageSize = 500;
    let offset = 0;
    let totalItems = Number.POSITIVE_INFINITY;
    let guard = 0;

    while (offset < totalItems && guard < 50) {
      const response: any = await accountingApi.getGeneralLedger(
        undefined,
        from,
        to,
        pageSize,
        offset,
        costCenterId
      );
      const page: LedgerEntryLike[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];

      allEntries.push(...page);
      const reportedTotal =
        response?.meta?.pagination?.totalItems ??
        response?.meta?.totalItems ??
        response?.meta?.pagination?.total ??
        null;

      if (reportedTotal !== null && Number.isFinite(Number(reportedTotal))) {
        totalItems = Number(reportedTotal);
      } else if (page.length < pageSize) {
        totalItems = offset + page.length;
      }

      if (page.length === 0) break;
      offset += page.length;
      guard += 1;
    }

    return allEntries;
  };

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const [budgets, fiscalYears, accounts] = await Promise.all([
          accountingApi.listBudgets(),
          accountingApi.listFiscalYears(),
          accountingApi.getAccounts(),
        ]);

        const budgetMap = new Map<string, BudgetDTO>();
        budgets.forEach((budget) => budgetMap.set(budget.id, budget));
        setBudgetsMap(budgetMap);

        const accountMap = new Map<string, AccountDTO>();
        accounts.forEach((account) => accountMap.set(account.id, account));
        setAccountsMap(accountMap);

        const selectedBudget = budgetMap.get(params.budgetId);
        if (!selectedBudget) {
          setRows([]);
          setError(t('budgetVsActual.selectBudget', { defaultValue: 'Select a budget first.' }));
          return;
        }

        const fiscalYear = fiscalYears.find((fy) => fy.id === selectedBudget.fiscalYearId) || null;
        setSelectedFiscalYear(fiscalYear);
        if (!fiscalYear) {
          setRows([]);
          setError(t('budgetVsActual.missingFiscalYear', { defaultValue: 'Fiscal year not found for selected budget.' }));
          return;
        }

        const rangeStart = params.fromDate || fiscalYear.startDate;
        const rangeEnd = params.toDate || fiscalYear.endDate;
        const monthIndexes = getMonthIndexesInRange(fiscalYear, rangeStart, rangeEnd);
        if (monthIndexes.length === 0) {
          setRows([]);
          setError(t('budgetVsActual.invalidRange', { defaultValue: 'Date range is outside selected fiscal year.' }));
          return;
        }

        const budgetLines = (selectedBudget.lines || [])
          .map((line) => ({
            accountId: line.accountId,
            costCenterId: line.costCenterId,
            monthlyBudget: normalizeMonthly(line.monthlyAmounts),
          }))
          .filter((line) => !params.costCenterId || line.costCenterId === params.costCenterId);

        const actualMonthlyMap = new Map<string, number[]>();
        const ledgerEntries = await loadLedgerEntries(
          fiscalYear.startDate,
          fiscalYear.endDate,
          params.costCenterId || undefined
        );

        ledgerEntries.forEach((entry) => {
          if (!entry.accountId || !entry.date) return;
          if (params.costCenterId && entry.costCenterId !== params.costCenterId) return;
          if (entry.date < rangeStart || entry.date > rangeEnd) return;

          const monthIndex = getFiscalMonthIndex(entry.date, fiscalYear.startDate);
          if (monthIndex < 0 || monthIndex > 11) return;

          const key = lineKey(entry.accountId, entry.costCenterId);
          const current = actualMonthlyMap.get(key) || Array(12).fill(0);
          const signedAmount =
            safeNumber(entry.debit) > 0 || safeNumber(entry.credit) > 0
              ? safeNumber(entry.debit) - safeNumber(entry.credit)
              : (entry.side || 'Debit') === 'Debit'
                ? safeNumber(entry.amount)
                : -safeNumber(entry.amount);
          current[monthIndex] = round2(current[monthIndex] + signedAmount);
          actualMonthlyMap.set(key, current);
        });

        const reportRows: BudgetActualRow[] = budgetLines.map((line) => {
          const key = lineKey(line.accountId, line.costCenterId);
          const monthlyActual = actualMonthlyMap.get(key) || Array(12).fill(0);
          const budget = round2(sumForIndexes(line.monthlyBudget, monthIndexes));
          const actual = round2(sumForIndexes(monthlyActual, monthIndexes));
          const variance = round2(budget - actual);
          const variancePct = budget === 0 ? 0 : round2((variance / budget) * 100);
          const account = accountMap.get(line.accountId);
          const accountLabel = account ? `${account.userCode} - ${account.name}` : line.accountId;

          return {
            accountId: line.accountId,
            costCenterId: line.costCenterId,
            accountLabel,
            budget,
            actual,
            variance,
            variancePct,
            monthlyBudget: line.monthlyBudget,
            monthlyActual,
          };
        });

        reportRows.sort((a, b) => a.accountLabel.localeCompare(b.accountLabel));
        setRows(reportRows);
      } catch (err: any) {
        errorHandler.showError(err);
        setRows([]);
        setError(err?.message || t('budgetVsActual.loadError', { defaultValue: 'Failed to load report.' }));
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [params, t]);

  const monthIndexesInRange = useMemo(
    () => getMonthIndexesInRange(selectedFiscalYear, params.fromDate, params.toDate),
    [params.fromDate, params.toDate, selectedFiscalYear]
  );

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        budget: round2(acc.budget + row.budget),
        actual: round2(acc.actual + row.actual),
        variance: round2(acc.variance + row.variance),
      }),
      { budget: 0, actual: 0, variance: 0 }
    );
  }, [rows]);

  const monthlyBreakdown = useMemo(() => {
    if (!selectedFiscalYear || monthIndexesInRange.length === 0) return [];
    return monthIndexesInRange.map((monthIndex) => {
      const budget = round2(rows.reduce((sum, row) => sum + safeNumber(row.monthlyBudget[monthIndex]), 0));
      const actual = round2(rows.reduce((sum, row) => sum + safeNumber(row.monthlyActual[monthIndex]), 0));
      const variance = round2(budget - actual);
      const variancePct = budget === 0 ? 0 : round2((variance / budget) * 100);
      return {
        label: monthLabelForIndex(selectedFiscalYear, monthIndex),
        budget,
        actual,
        variance,
        variancePct,
      };
    });
  }, [monthIndexesInRange, rows, selectedFiscalYear]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm dark:bg-red-900/20 dark:border-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded overflow-hidden dark:bg-slate-900 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="p-2 text-left text-slate-700 dark:text-slate-200">{t('budgetVsActual.account')}</th>
                <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.budget')}</th>
                <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.actual')}</th>
                <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.variance')}</th>
                <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.variancePct')}</th>
                <th className="p-2 text-left text-slate-700 dark:text-slate-200">{t('budgetVsActual.status', { defaultValue: 'Indicator' })}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-slate-500 dark:text-slate-300" colSpan={6}>
                    {t('trialBalance.loading')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="p-4 text-slate-500 dark:text-slate-300" colSpan={6}>
                    {t('budgetVsActual.empty', { defaultValue: 'No report rows loaded yet.' })}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.accountId}-${row.costCenterId || 'all'}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-2 text-slate-900 dark:text-slate-100">
                      {row.accountLabel}
                      {row.costCenterId ? ` - ${t('budgetVsActual.costCenter', { id: row.costCenterId })}` : ''}
                    </td>
                    <td className="p-2 text-right text-slate-700 dark:text-slate-200">
                      {row.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right text-slate-700 dark:text-slate-200">
                      {row.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-2 text-right font-semibold ${varianceClass(row.variance)}`}>
                      {row.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-2 text-right font-semibold ${varianceClass(row.variance)}`}>{row.variancePct.toFixed(2)}%</td>
                    <td className="p-2">
                      <span className={`text-xs font-semibold ${varianceClass(row.variance)}`}>
                        {row.variance < 0
                          ? t('budgetVsActual.overBudget', { defaultValue: 'Over budget' })
                          : row.variance > 0
                            ? t('budgetVsActual.underBudget', { defaultValue: 'Under budget' })
                            : t('budgetVsActual.onBudget', { defaultValue: 'On budget' })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <tr>
                  <td className="p-2 font-semibold text-slate-900 dark:text-slate-100">
                    {t('accountStatement.totals', { defaultValue: 'Totals' })}
                  </td>
                  <td className="p-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {summary.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {summary.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`p-2 text-right font-semibold ${varianceClass(summary.variance)}`}>
                    {summary.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`p-2 text-right font-semibold ${varianceClass(summary.variance)}`}>
                    {(summary.budget === 0 ? 0 : (summary.variance / summary.budget) * 100).toFixed(2)}%
                  </td>
                  <td className="p-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {params.showMonthlyBreakdown && rows.length > 0 && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden dark:bg-slate-900 dark:border-slate-700">
            <div className="px-3 py-2 border-b bg-slate-50 font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
              {t('budgetVsActual.monthlyBreakdown', { defaultValue: 'Monthly breakdown' })}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="p-2 text-left text-slate-700 dark:text-slate-200">{t('budgetVsActual.month', { defaultValue: 'Month' })}</th>
                  <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.budget')}</th>
                  <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.actual')}</th>
                  <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.variance')}</th>
                  <th className="p-2 text-right text-slate-700 dark:text-slate-200">{t('budgetVsActual.variancePct')}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyBreakdown.map((month) => (
                  <tr key={month.label} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-2 text-slate-900 dark:text-slate-100">{month.label}</td>
                    <td className="p-2 text-right text-slate-700 dark:text-slate-200">
                      {month.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right text-slate-700 dark:text-slate-200">
                      {month.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-2 text-right font-semibold ${varianceClass(month.variance)}`}>
                      {month.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-2 text-right font-semibold ${varianceClass(month.variance)}`}>{month.variancePct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const BudgetVsActualPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  return (
    <ReportContainer<BudgetVsActualParams>
      title={t('budgetVsActual.title', { defaultValue: 'Budget vs Actual' })}
      subtitle={t('budgetVsActual.subtitle', {
        defaultValue: 'Compare approved budgets with actual postings over a selected period',
      })}
      initiator={BudgetVsActualInitiator}
      ReportContent={BudgetVsActualReportContent}
      config={{ paginated: false }}
    />
  );
};

export default BudgetVsActualPage;

