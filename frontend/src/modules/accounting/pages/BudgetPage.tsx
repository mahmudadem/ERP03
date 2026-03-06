import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, CheckCircle2, ClipboardList, FilePenLine, Plus } from 'lucide-react';
import { useRBAC } from '../../../api/rbac/useRBAC';
import {
  AccountDTO,
  BudgetDTO,
  BudgetLineDTO,
  CostCenterDTO,
  FiscalYearDTO,
  accountingApi
} from '../../../api/accountingApi';
import { errorHandler } from '../../../services/errorHandler';

const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ACTIVE_BUDGET_CLASSES = new Set(['EXPENSE', 'REVENUE', 'INCOME']);

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeMonthlyAmounts = (amounts?: number[]) => {
  const values = Array.isArray(amounts) ? amounts : [];
  return Array.from({ length: 12 }, (_, idx) => toNumber(values[idx] ?? 0));
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sumMonths = (months: number[]) => months.reduce((sum, current) => sum + toNumber(current), 0);

const distributeAnnualEvenly = (annual: number) => {
  const safeAnnual = round2(toNumber(annual));
  const base = round2(safeAnnual / 12);
  const months = Array(12).fill(base);
  const first11 = round2(base * 11);
  months[11] = round2(safeAnnual - first11);
  return months;
};

const normalizeLine = (line?: Partial<BudgetLineDTO>): BudgetLineDTO => {
  const monthlyAmounts = normalizeMonthlyAmounts(line?.monthlyAmounts);
  return {
    accountId: line?.accountId || '',
    costCenterId: line?.costCenterId || undefined,
    monthlyAmounts,
    annualTotal: round2(sumMonths(monthlyAmounts))
  };
};

const emptyLine = (): BudgetLineDTO => normalizeLine();
const getLineKey = (line: BudgetLineDTO) => `${line.accountId}|${line.costCenterId || ''}`;

const BudgetPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const { hasPermission } = useRBAC();

  const canWrite = hasPermission('accounting.settings.write');
  const canRead = hasPermission('accounting.settings.read');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterDTO[]>([]);

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [lines, setLines] = useState<BudgetLineDTO[]>([emptyLine()]);
  const [name, setName] = useState('');
  const [fiscalYearId, setFiscalYearId] = useState('');
  const [version, setVersion] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const postingAccounts = useMemo(
    () =>
      accounts
        .filter((account) => ACTIVE_BUDGET_CLASSES.has((account.classification || '').toUpperCase()))
        .filter((account) => (account.accountRole || '').toUpperCase() !== 'HEADER')
        .sort((a, b) => (a.userCode || '').localeCompare(b.userCode || '')),
    [accounts]
  );

  const activeCostCenters = useMemo(
    () => costCenters.filter((costCenter) => costCenter.status === 'ACTIVE'),
    [costCenters]
  );

  const fiscalYearById = useMemo(() => {
    const map = new Map<string, FiscalYearDTO>();
    fiscalYears.forEach((fy) => map.set(fy.id, fy));
    return map;
  }, [fiscalYears]);

  const budgetsByFiscalYear = useMemo(() => {
    const map = new Map<string, BudgetDTO[]>();
    budgets.forEach((budget) => {
      const current = map.get(budget.fiscalYearId) || [];
      current.push(budget);
      map.set(budget.fiscalYearId, current);
    });
    map.forEach((list, key) => {
      map.set(
        key,
        [...list].sort((a, b) => {
          if (a.version !== b.version) return b.version - a.version;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
      );
    });
    return map;
  }, [budgets]);

  const activeApprovedByFiscalYear = useMemo(() => {
    const result = new Map<string, string>();
    budgetsByFiscalYear.forEach((fyBudgets, fiscalId) => {
      const approved = fyBudgets.filter((budget) => budget.status === 'APPROVED');
      if (approved.length > 0) {
        result.set(fiscalId, approved[0].id);
      }
    });
    return result;
  }, [budgetsByFiscalYear]);

  const selectedBudget = useMemo(
    () => budgets.find((budget) => budget.id === selectedBudgetId) || null,
    [budgets, selectedBudgetId]
  );

  const isEditorReadOnly = !!selectedBudget && selectedBudget.status !== 'DRAFT';
  const monthLabels = useMemo(() => monthKeys.map((key) => t(`budget.months.${key}`)), [t]);

  const getNextVersion = (targetFiscalYearId: string) => {
    const fyBudgets = budgetsByFiscalYear.get(targetFiscalYearId) || [];
    const maxVersion = fyBudgets.reduce((max, budget) => Math.max(max, budget.version || 1), 0);
    return maxVersion + 1;
  };

  const refreshBudgets = async () => {
    const data = await accountingApi.listBudgets();
    setBudgets(data);
    return data;
  };

  const setEditorFromBudget = (budget: BudgetDTO) => {
    setSelectedBudgetId(budget.id);
    setFiscalYearId(budget.fiscalYearId);
    setName(budget.name);
    setVersion(budget.version || 1);
    setLines((budget.lines || []).map((line) => normalizeLine(line)));
  };

  const resetEditor = (targetFiscalYearId?: string) => {
    const nextFiscalYear = targetFiscalYearId || fiscalYearId || fiscalYears[0]?.id || '';
    setSelectedBudgetId(null);
    setFiscalYearId(nextFiscalYear);
    setName('');
    setVersion(nextFiscalYear ? getNextVersion(nextFiscalYear) : 1);
    setLines([emptyLine()]);
  };

  useEffect(() => {
    if (!canRead) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [budgetsData, fiscalYearsData, accountsData, costCentersData] = await Promise.all([
          accountingApi.listBudgets(),
          accountingApi.listFiscalYears(),
          accountingApi.getAccounts(),
          accountingApi.listCostCenters()
        ]);

        if (!mounted) return;
        setBudgets(budgetsData);
        setFiscalYears(fiscalYearsData);
        setAccounts(accountsData);
        setCostCenters(costCentersData);

        const preferredFiscalYear = fiscalYearsData.find((fy) => fy.status === 'OPEN')?.id || fiscalYearsData[0]?.id || '';
        setFiscalYearId(preferredFiscalYear);
      } catch (error) {
        errorHandler.showError(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [canRead]);

  useEffect(() => {
    if (!selectedBudgetId && fiscalYearId) {
      setVersion(getNextVersion(fiscalYearId));
    }
  }, [fiscalYearId, selectedBudgetId, budgetsByFiscalYear]);

  const updateLine = (lineIndex: number, updater: (line: BudgetLineDTO) => BudgetLineDTO) => {
    setLines((previous) => {
      const next = [...previous];
      const current = previous[lineIndex] || emptyLine();
      const updated = normalizeLine(updater(current));
      next[lineIndex] = updated;
      return next;
    });
  };

  const removeLine = (lineIndex: number) => {
    setLines((previous) => {
      if (previous.length <= 1) return previous;
      return previous.filter((_, idx) => idx !== lineIndex);
    });
  };

  const addLine = () => setLines((previous) => [...previous, emptyLine()]);

  const applyAnnualDistribution = (lineIndex: number, annual: number) => {
    const distributed = distributeAnnualEvenly(annual);
    updateLine(lineIndex, (line) => ({ ...line, monthlyAmounts: distributed }));
  };

  const startRevision = (budget: BudgetDTO) => {
    const revisionVersion = getNextVersion(budget.fiscalYearId);
    setSelectedBudgetId(null);
    setFiscalYearId(budget.fiscalYearId);
    setName(budget.name);
    setVersion(revisionVersion);
    setLines((budget.lines || []).map((line) => normalizeLine(line)));
    setStatusMessage(
      t('budget.revisionPrepared', {
        defaultValue: 'Prepared revision v{{version}} from selected budget.',
        version: revisionVersion
      })
    );
  };

  const saveBudget = async () => {
    if (!canWrite || saving) return;
    if (!fiscalYearId) {
      errorHandler.showError(t('budget.selectFiscalYear', { defaultValue: 'Please select a fiscal year.' }));
      return;
    }
    if (!name.trim()) {
      errorHandler.showError(t('budget.nameRequired', { defaultValue: 'Budget name is required.' }));
      return;
    }

    const sanitizedLines = lines
      .map((line) => normalizeLine(line))
      .filter((line) => !!line.accountId);

    if (sanitizedLines.length === 0) {
      errorHandler.showError(t('budget.lineRequired', { defaultValue: 'At least one account line is required.' }));
      return;
    }

    const duplicateKeys = new Set<string>();
    let hasDuplicate = false;
    sanitizedLines.forEach((line) => {
      const key = getLineKey(line);
      if (duplicateKeys.has(key)) hasDuplicate = true;
      duplicateKeys.add(key);
    });
    if (hasDuplicate) {
      errorHandler.showError(
        t('budget.duplicateLines', { defaultValue: 'Duplicate account/cost-center lines are not allowed.' })
      );
      return;
    }

    const payload = {
      fiscalYearId,
      name: name.trim(),
      version,
      lines: sanitizedLines.map((line) => ({
        accountId: line.accountId,
        costCenterId: line.costCenterId || undefined,
        monthlyAmounts: normalizeMonthlyAmounts(line.monthlyAmounts),
        annualTotal: round2(sumMonths(line.monthlyAmounts))
      }))
    };

    setSaving(true);
    try {
      let saved: BudgetDTO;
      if (selectedBudget && selectedBudget.status === 'DRAFT') {
        saved = await accountingApi.updateBudget(selectedBudget.id, payload);
      } else {
        saved = await accountingApi.createBudget(payload);
      }
      await refreshBudgets();
      setEditorFromBudget(saved);
      setStatusMessage(t('budget.saved'));
      errorHandler.showSuccess(t('budget.saved'));
    } catch (error) {
      errorHandler.showError(error);
    } finally {
      setSaving(false);
    }
  };

  const approveBudget = async (budgetId: string) => {
    if (!canWrite || approvingId) return;
    setApprovingId(budgetId);
    try {
      await accountingApi.approveBudget(budgetId);
      await refreshBudgets();
      setStatusMessage(t('budget.approved'));
      errorHandler.showSuccess(t('budget.approved'));
    } catch (error) {
      errorHandler.showError(error);
    } finally {
      setApprovingId(null);
    }
  };

  const totalBudget = useMemo(
    () => round2(lines.reduce((sum, line) => sum + toNumber(line.annualTotal), 0)),
    [lines]
  );

  const budgetStats = useMemo(() => {
    const draft = budgets.filter((item) => item.status === 'DRAFT').length;
    const approved = budgets.filter((item) => item.status === 'APPROVED').length;
    const closed = budgets.filter((item) => item.status === 'CLOSED').length;
    return {
      total: budgets.length,
      draft,
      approved,
      closed
    };
  }, [budgets]);

  const selectedFiscalYearName = useMemo(
    () => fiscalYearById.get(fiscalYearId)?.name || t('budget.selectFiscalYear', { defaultValue: 'Select fiscal year' }),
    [fiscalYearById, fiscalYearId, t]
  );

  if (!canRead) {
    return (
      <div className="p-6">
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('budget.readPermissionRequired', { defaultValue: 'You do not have permission to view budgets.' })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500">{t('budget.loading', { defaultValue: 'Loading budgets...' })}</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 min-h-full overflow-x-hidden">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-4 sm:px-5 py-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight">{t('budget.title', { defaultValue: 'Budget Management' })}</h1>
            <p className="text-sm text-slate-200">
              {t('budget.subtitle', {
                defaultValue: 'Create, approve, and monitor budget versions by fiscal year.'
              })}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5">
            <BarChart3 className="h-4 w-4 text-emerald-300" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-100">
              {selectedFiscalYearName}
            </span>
          </div>
        </div>
      </div>
      {!canWrite && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('budget.readOnlyMode', {
            defaultValue: 'Read-only mode: you can view budgets, but create/update/approve is disabled.'
          })}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <ClipboardList className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">{t('budget.existing', { defaultValue: 'Existing Budgets' })}</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{budgetStats.total}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700">{t('budget.statuses.draft', 'Draft')}</div>
          <div className="mt-2 text-2xl font-black text-amber-900">{budgetStats.draft}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">{t('budget.statuses.approved', 'Approved')}</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-900">{budgetStats.approved}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('budget.statuses.closed', 'Closed')}</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{budgetStats.closed}</div>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 sm:px-5 py-4">
          <div className="flex items-center gap-2">
            <FilePenLine className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
              {t('budget.editor', { defaultValue: 'Budget Editor' })}
            </h3>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5 min-w-0">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-3">
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-500">{t('budget.fiscalYear')}</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
              value={fiscalYearId}
              onChange={(event) => setFiscalYearId(event.target.value)}
              disabled={!canWrite || saving || !!selectedBudgetId}
            >
              <option value="">{t('budget.selectFiscalYear', { defaultValue: 'Select fiscal year' })}</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.name} ({fy.startDate} - {fy.endDate})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 xl:col-span-5">
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-500">{t('budget.name')}</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canWrite || saving || isEditorReadOnly}
              placeholder={t('budget.name', { defaultValue: 'Budget Name' })}
            />
          </div>
          <div className="min-w-0 xl:col-span-1">
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-500">{t('budget.version')}</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
              type="number"
              min={1}
              value={version}
              onChange={(event) => setVersion(Math.max(1, toNumber(event.target.value)))}
              disabled={!canWrite || saving || !!selectedBudgetId}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2 xl:col-span-3">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              disabled={!canWrite || saving || isEditorReadOnly}
              onClick={saveBudget}
            >
              {saving
                ? t('budget.saving', { defaultValue: 'Saving...' })
                : selectedBudgetId
                  ? t('budget.save', { defaultValue: 'Save Budget' })
                  : t('budget.create', { defaultValue: 'Create Budget' })}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => resetEditor()}
              disabled={saving}
            >
              {t('budget.newDraft', { defaultValue: 'New Draft' })}
            </button>
          </div>
        </div>

        {isEditorReadOnly && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {t('budget.approvedReadOnly', {
              defaultValue: 'Approved/closed budgets are read-only. Use "Create Revision" to make changes.'
            })}
          </div>
        )}

        <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-2 py-2 text-left font-bold w-64">{t('budget.accountId')}</th>
                <th className="px-2 py-2 text-left font-bold w-52">{t('budget.costCenter')}</th>
                <th className="px-2 py-2 text-right font-bold w-44">{t('budget.annualDistribute', { defaultValue: 'Annual (Auto-Distribute)' })}</th>
                {monthLabels.map((monthLabel) => (
                  <th key={monthLabel} className="px-2 py-2 text-right font-bold w-24">{monthLabel}</th>
                ))}
                <th className="px-2 py-2 text-right font-bold w-36">{t('budget.total')}</th>
                <th className="px-2 py-2 text-center font-bold w-24">{t('budget.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, lineIndex) => (
                <tr key={`${lineIndex}-${line.accountId}-${line.costCenterId || 'none'}`} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="p-2 align-top">
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                      value={line.accountId}
                      onChange={(event) => updateLine(lineIndex, (current) => ({ ...current, accountId: event.target.value }))}
                      disabled={!canWrite || saving || isEditorReadOnly}
                    >
                      <option value="">{t('budget.selectAccount', { defaultValue: 'Select account' })}</option>
                      {postingAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.userCode} - {account.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 align-top">
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                      value={line.costCenterId || ''}
                      onChange={(event) => updateLine(lineIndex, (current) => ({ ...current, costCenterId: event.target.value || undefined }))}
                      disabled={!canWrite || saving || isEditorReadOnly}
                    >
                      <option value="">{t('budget.allCostCenters', { defaultValue: 'All cost centers' })}</option>
                      {activeCostCenters.map((costCenter) => (
                        <option key={costCenter.id} value={costCenter.id}>{costCenter.code} - {costCenter.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 align-top">
                    <input
                      type="number"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm focus:border-slate-500 focus:outline-none"
                      value={line.annualTotal}
                      onChange={(event) => applyAnnualDistribution(lineIndex, toNumber(event.target.value))}
                      disabled={!canWrite || saving || isEditorReadOnly}
                    />
                    <div className="mt-1 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {t('budget.evenSplitHint', { defaultValue: 'Even split over 12 months' })}
                    </div>
                  </td>
                  {line.monthlyAmounts.map((value, monthIndex) => (
                    <td key={`${lineIndex}-${monthIndex}`} className="p-1.5">
                      <input
                        type="number"
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm focus:border-slate-500 focus:outline-none"
                        value={value}
                        onChange={(event) => updateLine(lineIndex, (current) => {
                          const monthlyAmounts = normalizeMonthlyAmounts(current.monthlyAmounts);
                          monthlyAmounts[monthIndex] = toNumber(event.target.value);
                          return { ...current, monthlyAmounts };
                        })}
                        disabled={!canWrite || saving || isEditorReadOnly}
                      />
                    </td>
                  ))}
                  <td className="p-2 text-right font-mono font-semibold text-slate-900">
                    {round2(line.annualTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:text-slate-300"
                      onClick={() => removeLine(lineIndex)}
                      disabled={!canWrite || saving || isEditorReadOnly || lines.length <= 1}
                    >
                      {t('budget.removeLine', { defaultValue: 'Remove' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center border-t border-slate-200 bg-slate-50 px-3 py-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={addLine}
              disabled={!canWrite || saving || isEditorReadOnly}
            >
              <Plus className="h-4 w-4" />
              {t('budget.addLine')}
            </button>
            <div className="text-right font-bold text-slate-900">
              {t('budget.totalBudget')}: {totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 sm:px-5 py-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">{t('budget.existing')}</h3>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-bold">{t('budget.name')}</th>
              <th className="px-3 py-2 text-left font-bold">{t('budget.fiscalYear')}</th>
              <th className="px-3 py-2 text-left font-bold">{t('budget.version')}</th>
              <th className="px-3 py-2 text-left font-bold">{t('budget.status')}</th>
              <th className="px-3 py-2 text-left font-bold">{t('budget.active', { defaultValue: 'Active' })}</th>
              <th className="px-3 py-2 text-left font-bold">{t('budget.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {budgets.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>{t('budget.emptyList', { defaultValue: 'No budgets created yet.' })}</td></tr>
            ) : (
              budgets.map((budget) => {
                const fy = fiscalYearById.get(budget.fiscalYearId);
                const activeBudgetId = activeApprovedByFiscalYear.get(budget.fiscalYearId);
                const isActive = activeBudgetId === budget.id;
                const statusClass = budget.status === 'APPROVED'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : budget.status === 'DRAFT'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200';

                return (
                  <tr key={budget.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{budget.name}</td>
                    <td className="px-3 py-2.5 text-slate-700">{fy?.name || budget.fiscalYearId}</td>
                    <td className="px-3 py-2.5 text-slate-700">{budget.version}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                        {t(`budget.statuses.${budget.status.toLowerCase()}`, budget.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {isActive ? (
                        <span className="text-xs font-semibold text-blue-700">{t('budget.activeForReports', { defaultValue: 'Yes (default in reports)' })}</span>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                      <button type="button" className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-300" onClick={() => setEditorFromBudget(budget)} disabled={saving}>
                        {t('budget.edit')}
                      </button>
                      <button type="button" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 disabled:text-slate-300" onClick={() => startRevision(budget)} disabled={!canWrite || saving}>
                        {t('budget.createRevision', { defaultValue: 'Create Revision' })}
                      </button>
                      {budget.status === 'DRAFT' && (
                        <button
                          type="button"
                          className="text-sm font-semibold text-green-600 hover:text-green-700 disabled:text-slate-300"
                          onClick={() => approveBudget(budget.id)}
                          disabled={!canWrite || !!approvingId}
                        >
                          {approvingId === budget.id ? t('budget.approving', { defaultValue: 'Approving...' }) : t('budget.approve')}
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default BudgetPage;
