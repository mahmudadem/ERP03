import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccountDTO,
  BudgetDTO,
  CostCenterDTO,
  FiscalYearDTO,
  accountingApi
} from '../../../api/accountingApi';
import { DatePicker } from '../components/shared/DatePicker';
import { errorHandler } from '../../../services/errorHandler';

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
  return 'text-slate-600';
};

const BudgetVsActualPage: React.FC = () => {
  const { t } = useTranslation('accounting');

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearDTO[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);

  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);

  const [rows, setRows] = useState<BudgetActualRow[]>([]);

  const selectedBudget = useMemo(
    () => budgets.find((budget) => budget.id === selectedBudgetId) || null,
    [budgets, selectedBudgetId]
  );

  const fiscalYearById = useMemo(() => {
    const map = new Map<string, FiscalYearDTO>();
    fiscalYears.forEach((fy) => map.set(fy.id, fy));
    return map;
  }, [fiscalYears]);

  const accountById = useMemo(() => {
    const map = new Map<string, AccountDTO>();
    accounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts]);

  const selectedFiscalYear = selectedBudget ? fiscalYearById.get(selectedBudget.fiscalYearId) || null : null;
  const monthIndexesInRange = useMemo(
    () => getMonthIndexesInRange(selectedFiscalYear, fromDate, toDate),
    [selectedFiscalYear, fromDate, toDate]
  );

  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      setLoadingMeta(true);
      try {
        const [budgetList, fiscalYearList, costCenterList, accountList] = await Promise.all([
          accountingApi.listBudgets(),
          accountingApi.listFiscalYears(),
          accountingApi.listCostCenters(),
          accountingApi.getAccounts()
        ]);
        if (!mounted) return;

        const sortedBudgets = [...budgetList].sort((a, b) => {
          if (a.status === b.status) return b.version - a.version;
          if (a.status === 'APPROVED') return -1;
          if (b.status === 'APPROVED') return 1;
          return b.version - a.version;
        });

        setBudgets(sortedBudgets);
        setFiscalYears(fiscalYearList);
        setCostCenters(costCenterList.filter((cc) => cc.status === 'ACTIVE'));
        setAccounts(accountList);

        if (sortedBudgets.length > 0) {
          const preferredBudget = sortedBudgets.find((budget) => budget.status === 'APPROVED') || sortedBudgets[0];
          setSelectedBudgetId(preferredBudget.id);
          const fy = fiscalYearList.find((item) => item.id === preferredBudget.fiscalYearId);
          setFromDate(fy?.startDate || '');
          setToDate(fy?.endDate || '');
        }
      } catch (loadError: any) {
        errorHandler.showError(loadError);
        if (mounted) setError(loadError?.message || t('budgetVsActual.loadError', { defaultValue: 'Failed to load report metadata.' }));
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    };

    loadMeta();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedBudget) return;
    const fiscalYear = fiscalYearById.get(selectedBudget.fiscalYearId);
    if (!fiscalYear) return;
    setFromDate(fiscalYear.startDate);
    setToDate(fiscalYear.endDate);
    setRows([]);
    setError(null);
  }, [selectedBudgetId, selectedBudget, fiscalYearById]);

  const loadLedgerEntries = async (from: string, to: string, costCenterId?: string) => {
    const allEntries: LedgerEntryLike[] = [];
    const pageSize = 500;
    let offset = 0;
    let totalItems = Number.POSITIVE_INFINITY;
    let guard = 0;

    while (offset < totalItems && guard < 50) {
      const response: any = await accountingApi.getGeneralLedger(undefined, from, to, pageSize, offset, costCenterId);
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

  const runReport = async () => {
    if (!selectedBudget) {
      setError(t('budgetVsActual.selectBudget', { defaultValue: 'Select a budget first.' }));
      return;
    }
    if (!selectedFiscalYear) {
      setError(t('budgetVsActual.missingFiscalYear', { defaultValue: 'Fiscal year not found for selected budget.' }));
      return;
    }

    const rangeStart = fromDate || selectedFiscalYear.startDate;
    const rangeEnd = toDate || selectedFiscalYear.endDate;
    const monthIndexes = getMonthIndexesInRange(selectedFiscalYear, rangeStart, rangeEnd);
    if (monthIndexes.length === 0) {
      setError(t('budgetVsActual.invalidRange', { defaultValue: 'Date range is outside the selected fiscal year.' }));
      setRows([]);
      return;
    }

    setLoadingReport(true);
    setError(null);
    try {
      const budgetLines = (selectedBudget.lines || [])
        .map((line) => ({
          accountId: line.accountId,
          costCenterId: line.costCenterId,
          monthlyBudget: normalizeMonthly(line.monthlyAmounts)
        }))
        .filter((line) => !selectedCostCenterId || line.costCenterId === selectedCostCenterId);

      const actualMonthlyMap = new Map<string, number[]>();
      const ledgerEntries = await loadLedgerEntries(selectedFiscalYear.startDate, selectedFiscalYear.endDate, selectedCostCenterId || undefined);

      ledgerEntries.forEach((entry) => {
        if (!entry.accountId || !entry.date) return;
        if (selectedCostCenterId && entry.costCenterId !== selectedCostCenterId) return;
        if (entry.date < rangeStart || entry.date > rangeEnd) return;

        const monthIndex = getFiscalMonthIndex(entry.date, selectedFiscalYear.startDate);
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

      const nextRows: BudgetActualRow[] = budgetLines.map((line) => {
        const key = lineKey(line.accountId, line.costCenterId);
        const monthlyActual = actualMonthlyMap.get(key) || Array(12).fill(0);
        const budget = round2(sumForIndexes(line.monthlyBudget, monthIndexes));
        const actual = round2(sumForIndexes(monthlyActual, monthIndexes));
        const variance = round2(budget - actual);
        const variancePct = budget === 0 ? 0 : round2((variance / budget) * 100);
        const account = accountById.get(line.accountId);
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
          monthlyActual
        };
      });

      nextRows.sort((a, b) => a.accountLabel.localeCompare(b.accountLabel));
      setRows(nextRows);
    } catch (reportError: any) {
      errorHandler.showError(reportError);
      setRows([]);
      setError(reportError?.message || t('budgetVsActual.loadError', { defaultValue: 'Failed to load report.' }));
    } finally {
      setLoadingReport(false);
    }
  };

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        budget: round2(acc.budget + row.budget),
        actual: round2(acc.actual + row.actual),
        variance: round2(acc.variance + row.variance)
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
        variancePct
      };
    });
  }, [rows, monthIndexesInRange, selectedFiscalYear]);

  if (loadingMeta) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500">{t('budgetVsActual.loading', { defaultValue: 'Loading...' })}</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('budgetVsActual.selectBudget')}</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedBudgetId}
              onChange={(event) => setSelectedBudgetId(event.target.value)}
            >
              <option value="">{t('budgetVsActual.selectBudget')}</option>
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {t('budgetVsActual.option', {
                    name: budget.name,
                    version: budget.version,
                    status: t(`budget.statuses.${budget.status.toLowerCase()}`, budget.status)
                  })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('budget.costCenter')}</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedCostCenterId}
              onChange={(event) => setSelectedCostCenterId(event.target.value)}
            >
              <option value="">{t('budget.allCostCenters', { defaultValue: 'All cost centers' })}</option>
              {costCenters.map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>{costCenter.code} - {costCenter.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profitLoss.fromDate', { defaultValue: 'From Date' })}</label>
            <DatePicker value={fromDate} onChange={setFromDate} className="w-full text-base" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profitLoss.toDate', { defaultValue: 'To Date' })}</label>
            <DatePicker value={toDate} onChange={setToDate} className="w-full text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={showMonthlyBreakdown}
                onChange={(event) => setShowMonthlyBreakdown(event.target.checked)}
              />
              {t('budgetVsActual.monthlyBreakdown', { defaultValue: 'Monthly breakdown' })}
            </label>
            <button
              type="button"
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              onClick={runReport}
              disabled={!selectedBudgetId || loadingReport}
            >
              {loadingReport ? t('cashFlow.load', { defaultValue: 'Load' }) : t('trialBalance.generate', { defaultValue: 'Generate Report' })}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">{t('budgetVsActual.account')}</th>
              <th className="p-2 text-right">{t('budgetVsActual.budget')}</th>
              <th className="p-2 text-right">{t('budgetVsActual.actual')}</th>
              <th className="p-2 text-right">{t('budgetVsActual.variance')}</th>
              <th className="p-2 text-right">{t('budgetVsActual.variancePct')}</th>
              <th className="p-2 text-left">{t('budgetVsActual.status', { defaultValue: 'Indicator' })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={6}>
                  {t('budgetVsActual.empty', { defaultValue: 'No report rows loaded yet.' })}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.accountId}-${row.costCenterId || 'all'}`} className="border-t">
                  <td className="p-2">
                    {row.accountLabel}
                    {row.costCenterId ? ` · ${t('budgetVsActual.costCenter', { id: row.costCenterId })}` : ''}
                  </td>
                  <td className="p-2 text-right">{row.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right">{row.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={`p-2 text-right font-semibold ${varianceClass(row.variance)}`}>
                    {row.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`p-2 text-right font-semibold ${varianceClass(row.variance)}`}>
                    {row.variancePct.toFixed(2)}%
                  </td>
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
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td className="p-2 font-semibold">{t('accountStatement.totals', { defaultValue: 'Totals' })}</td>
                <td className="p-2 text-right font-semibold">{summary.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-2 text-right font-semibold">{summary.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className={`p-2 text-right font-semibold ${varianceClass(summary.variance)}`}>{summary.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className={`p-2 text-right font-semibold ${varianceClass(summary.variance)}`}>
                  {(summary.budget === 0 ? 0 : (summary.variance / summary.budget) * 100).toFixed(2)}%
                </td>
                <td className="p-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showMonthlyBreakdown && rows.length > 0 && (
        <div className="bg-white border rounded overflow-hidden">
          <div className="px-3 py-2 border-b bg-gray-50 font-semibold">
            {t('budgetVsActual.monthlyBreakdown', { defaultValue: 'Monthly breakdown' })}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">{t('budgetVsActual.month', { defaultValue: 'Month' })}</th>
                <th className="p-2 text-right">{t('budgetVsActual.budget')}</th>
                <th className="p-2 text-right">{t('budgetVsActual.actual')}</th>
                <th className="p-2 text-right">{t('budgetVsActual.variance')}</th>
                <th className="p-2 text-right">{t('budgetVsActual.variancePct')}</th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdown.map((month) => (
                <tr key={month.label} className="border-t">
                  <td className="p-2">{month.label}</td>
                  <td className="p-2 text-right">{month.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right">{month.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={`p-2 text-right font-semibold ${varianceClass(month.variance)}`}>{month.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={`p-2 text-right font-semibold ${varianceClass(month.variance)}`}>{month.variancePct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td className="p-2 font-semibold">{t('accountStatement.totals', { defaultValue: 'Totals' })}</td>
                <td className="p-2 text-right font-semibold">{summary.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-2 text-right font-semibold">{summary.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className={`p-2 text-right font-semibold ${varianceClass(summary.variance)}`}>{summary.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className={`p-2 text-right font-semibold ${varianceClass(summary.variance)}`}>
                  {(summary.budget === 0 ? 0 : (summary.variance / summary.budget) * 100).toFixed(2)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default BudgetVsActualPage;
