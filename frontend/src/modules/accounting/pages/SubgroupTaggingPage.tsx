import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Save, Search } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { accountingApi, type AccountDTO } from '../../../api/accountingApi';
import type { EquitySubgroup, PlSubgroup } from '../../../api/accounting';

type SupportedClassification = 'REVENUE' | 'EXPENSE' | 'EQUITY';
type ClassificationFilter = 'ALL' | SupportedClassification;
type SubgroupFilter = 'ALL' | 'UNASSIGNED' | PlSubgroup | EquitySubgroup;

interface DraftSubgroupState {
  plSubgroup: PlSubgroup | null;
  equitySubgroup: EquitySubgroup | null;
}

const CLASSIFICATION_OPTIONS: Array<{ value: ClassificationFilter; label: string }> = [
  { value: 'ALL', label: 'All (Revenue + Expense + Equity)' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'EQUITY', label: 'Equity' },
];

const REVENUE_SUBGROUP_OPTIONS: Array<{ value: PlSubgroup | null; label: string }> = [
  { value: 'SALES', label: 'Sales' },
  { value: 'OTHER_REVENUE', label: 'Other Revenue' },
  { value: null, label: '(Clear)' },
];

const EXPENSE_SUBGROUP_OPTIONS: Array<{ value: PlSubgroup | null; label: string }> = [
  { value: 'COST_OF_SALES', label: 'Cost of Sales' },
  { value: 'OPERATING_EXPENSES', label: 'Operating Expenses' },
  { value: 'OTHER_EXPENSES', label: 'Other Expenses' },
  { value: null, label: '(Clear)' },
];

const EQUITY_SUBGROUP_OPTIONS: Array<{ value: EquitySubgroup | null; label: string }> = [
  { value: 'RETAINED_EARNINGS', label: 'Retained Earnings' },
  { value: 'CONTRIBUTED_CAPITAL', label: 'Contributed Capital' },
  { value: 'RESERVES', label: 'Reserves' },
  { value: null, label: '(Clear)' },
];

const SUBGROUP_LABELS: Record<string, string> = {
  SALES: 'Sales',
  COST_OF_SALES: 'Cost of Sales',
  OPERATING_EXPENSES: 'Operating Expenses',
  OTHER_REVENUE: 'Other Revenue',
  OTHER_EXPENSES: 'Other Expenses',
  RETAINED_EARNINGS: 'Retained Earnings',
  CONTRIBUTED_CAPITAL: 'Contributed Capital',
  RESERVES: 'Reserves',
};

const SUPPORTED_CLASSIFICATIONS: SupportedClassification[] = ['REVENUE', 'EXPENSE', 'EQUITY'];

const normalizeClassification = (value?: string | null): SupportedClassification | null => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'INCOME') return 'REVENUE';
  if (SUPPORTED_CLASSIFICATIONS.includes(normalized as SupportedClassification)) {
    return normalized as SupportedClassification;
  }
  return null;
};

const getSubgroupOptions = (classification: SupportedClassification | null) => {
  if (classification === 'REVENUE') return REVENUE_SUBGROUP_OPTIONS;
  if (classification === 'EXPENSE') return EXPENSE_SUBGROUP_OPTIONS;
  if (classification === 'EQUITY') return EQUITY_SUBGROUP_OPTIONS;
  return [];
};

const subgroupLabel = (value: string | null | undefined) => {
  if (!value) return '(none)';
  return SUBGROUP_LABELS[value] || value;
};

const classificationBadgeClass = (classification: SupportedClassification) => {
  if (classification === 'REVENUE') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (classification === 'EXPENSE') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-indigo-100 text-indigo-800 border-indigo-200';
};

const SubgroupTaggingPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Array<AccountDTO & { normalizedClassification: SupportedClassification }>>([]);
  const [draftMap, setDraftMap] = useState<Record<string, DraftSubgroupState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [batchErrors, setBatchErrors] = useState<Array<{ accountId: string; error: string }>>([]);
  const [search, setSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('ALL');
  const [subgroupFilter, setSubgroupFilter] = useState<SubgroupFilter>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubgroupValue, setBulkSubgroupValue] = useState<string>('');
  const [confirmPending, setConfirmPending] = useState<{ updates: Array<{ accountId: string; plSubgroup?: PlSubgroup | null; equitySubgroup?: EquitySubgroup | null }> } | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setBatchErrors([]);

    try {
      const result = await accountingApi.getAccounts();
      const mapped = result
        .map((account) => {
          const normalizedClassification = normalizeClassification(account.classification || account.type);
          if (!normalizedClassification) return null;
          return {
            ...account,
            normalizedClassification,
            plSubgroup: (account.plSubgroup ?? null) as PlSubgroup | null,
            equitySubgroup: (account.equitySubgroup ?? null) as EquitySubgroup | null,
          };
        })
        .filter(Boolean) as Array<AccountDTO & { normalizedClassification: SupportedClassification }>;

      const initialDraftMap: Record<string, DraftSubgroupState> = {};
      for (const account of mapped) {
        initialDraftMap[account.id] = {
          plSubgroup: (account.plSubgroup ?? null) as PlSubgroup | null,
          equitySubgroup: (account.equitySubgroup ?? null) as EquitySubgroup | null,
        };
      }

      setAccounts(mapped);
      setDraftMap(initialDraftMap);
      setSelectedIds(new Set());
      setBulkSubgroupValue('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load accounts');
      setAccounts([]);
      setDraftMap({});
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const getCurrentSubgroup = (accountId: string, classification: SupportedClassification): string | null => {
    const draft = draftMap[accountId];
    if (!draft) return null;
    return classification === 'EQUITY' ? draft.equitySubgroup : draft.plSubgroup;
  };

  const updateAccountSubgroup = (
    accountId: string,
    classification: SupportedClassification,
    subgroup: string | null
  ) => {
    setDraftMap((prev) => {
      const current = prev[accountId] || { plSubgroup: null, equitySubgroup: null };
      if (classification === 'EQUITY') {
        return {
          ...prev,
          [accountId]: {
            ...current,
            equitySubgroup: (subgroup as EquitySubgroup | null) ?? null,
          },
        };
      }

      return {
        ...prev,
        [accountId]: {
          ...current,
          plSubgroup: (subgroup as PlSubgroup | null) ?? null,
        },
      };
    });
  };

  const availableSubgroupFilters = useMemo(() => {
    const options: Array<{ value: SubgroupFilter; label: string }> = [
      { value: 'ALL', label: 'All' },
      { value: 'UNASSIGNED', label: 'Unassigned' },
    ];

    if (classificationFilter === 'REVENUE') {
      REVENUE_SUBGROUP_OPTIONS.filter((item) => item.value).forEach((item) => {
        options.push({ value: item.value as SubgroupFilter, label: item.label });
      });
      return options;
    }

    if (classificationFilter === 'EXPENSE') {
      EXPENSE_SUBGROUP_OPTIONS.filter((item) => item.value).forEach((item) => {
        options.push({ value: item.value as SubgroupFilter, label: item.label });
      });
      return options;
    }

    if (classificationFilter === 'EQUITY') {
      EQUITY_SUBGROUP_OPTIONS.filter((item) => item.value).forEach((item) => {
        options.push({ value: item.value as SubgroupFilter, label: item.label });
      });
      return options;
    }

    [
      ...REVENUE_SUBGROUP_OPTIONS,
      ...EXPENSE_SUBGROUP_OPTIONS,
      ...EQUITY_SUBGROUP_OPTIONS,
    ]
      .filter((item) => item.value)
      .forEach((item) => {
        if (!options.some((opt) => opt.value === item.value)) {
          options.push({ value: item.value as SubgroupFilter, label: item.label });
        }
      });

    return options;
  }, [classificationFilter]);

  useEffect(() => {
    if (!availableSubgroupFilters.some((item) => item.value === subgroupFilter)) {
      setSubgroupFilter('ALL');
    }
  }, [availableSubgroupFilters, subgroupFilter]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (classificationFilter !== 'ALL' && account.normalizedClassification !== classificationFilter) {
        return false;
      }

      const currentSubgroup = getCurrentSubgroup(account.id, account.normalizedClassification);
      if (subgroupFilter === 'UNASSIGNED' && currentSubgroup) {
        return false;
      }
      if (subgroupFilter !== 'ALL' && subgroupFilter !== 'UNASSIGNED' && currentSubgroup !== subgroupFilter) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(account.userCode || account.code || '').toLowerCase().includes(q) ||
        String(account.name || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, classificationFilter, subgroupFilter, search, draftMap]);

  useEffect(() => {
    const visibleIds = new Set(filteredAccounts.map((item) => item.id));
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => visibleIds.has(id))));
  }, [filteredAccounts]);

  const isModified = (account: AccountDTO & { normalizedClassification: SupportedClassification }) => {
    const draft = draftMap[account.id];
    if (!draft) return false;
    return (
      (draft.plSubgroup ?? null) !== ((account.plSubgroup ?? null) as PlSubgroup | null) ||
      (draft.equitySubgroup ?? null) !== ((account.equitySubgroup ?? null) as EquitySubgroup | null)
    );
  };

  const selectedAccounts = useMemo(
    () => filteredAccounts.filter((account) => selectedIds.has(account.id)),
    [filteredAccounts, selectedIds]
  );

  const selectedClassificationSet = useMemo(
    () => Array.from(new Set(selectedAccounts.map((account) => account.normalizedClassification))),
    [selectedAccounts]
  );

  const bulkClassification = useMemo(() => {
    if (classificationFilter !== 'ALL') return classificationFilter;
    if (selectedClassificationSet.length === 1) return selectedClassificationSet[0];
    return null;
  }, [classificationFilter, selectedClassificationSet]);

  const bulkOptions = useMemo(() => getSubgroupOptions(bulkClassification), [bulkClassification]);

  const allVisibleSelected =
    filteredAccounts.length > 0 && filteredAccounts.every((account) => selectedIds.has(account.id));

  const modifiedCount = useMemo(
    () => accounts.filter((account) => isModified(account)).length,
    [accounts, draftMap]
  );

  const summaryText = useMemo(() => {
    const scope = accounts.filter((account) =>
      classificationFilter === 'ALL' ? true : account.normalizedClassification === classificationFilter
    );
    const scopeLabel = classificationFilter === 'ALL' ? 'eligible' : classificationFilter.toLowerCase();

    if (scope.length === 0) return `0 accounts in ${scopeLabel} scope`;

    if (subgroupFilter !== 'ALL' && subgroupFilter !== 'UNASSIGNED') {
      const tagged = scope.filter(
        (account) => getCurrentSubgroup(account.id, account.normalizedClassification) === subgroupFilter
      ).length;
      return `${tagged} of ${scope.length} ${scopeLabel} accounts tagged as ${subgroupLabel(subgroupFilter)}`;
    }

    if (subgroupFilter === 'UNASSIGNED') {
      const unassigned = scope.filter(
        (account) => !getCurrentSubgroup(account.id, account.normalizedClassification)
      ).length;
      return `${unassigned} of ${scope.length} ${scopeLabel} accounts are unassigned`;
    }

    const tagged = scope.filter(
      (account) => !!getCurrentSubgroup(account.id, account.normalizedClassification)
    ).length;
    return `${tagged} of ${scope.length} ${scopeLabel} accounts are tagged`;
  }, [accounts, classificationFilter, subgroupFilter, draftMap]);

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredAccounts.map((account) => account.id)));
  };

  const handleToggleRow = (accountId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleApplyBulk = () => {
    setError(null);
    setSuccessMessage(null);

    if (selectedAccounts.length === 0) {
      setError('Select at least one account to apply subgroup changes.');
      return;
    }
    if (!bulkClassification) {
      setError('Bulk assign requires same classification selection (or apply a classification filter).');
      return;
    }
    if (bulkSubgroupValue === '') {
      setError('Choose a subgroup value before applying.');
      return;
    }

    const castedValue = bulkSubgroupValue === '__CLEAR__' ? null : bulkSubgroupValue;
    for (const account of selectedAccounts) {
      if (account.normalizedClassification !== bulkClassification) {
        setError('Selected accounts contain multiple classifications. Narrow selection first.');
        return;
      }
    }

    setDraftMap((prev) => {
      const next = { ...prev };
      for (const account of selectedAccounts) {
        const current = next[account.id] || { plSubgroup: null, equitySubgroup: null };
        if (bulkClassification === 'EQUITY') {
          next[account.id] = {
            ...current,
            equitySubgroup: castedValue as EquitySubgroup | null,
          };
        } else {
          next[account.id] = {
            ...current,
            plSubgroup: castedValue as PlSubgroup | null,
          };
        }
      }
      return next;
    });

    setSuccessMessage(`Prepared subgroup update for ${selectedAccounts.length} account(s).`);
    setBatchErrors([]);
  };

  const handleSaveChanges = () => {
    const updates = accounts
      .filter((account) => isModified(account))
      .map((account) => {
        const draft = draftMap[account.id] || { plSubgroup: null, equitySubgroup: null };
        if (account.normalizedClassification === 'EQUITY') {
          return {
            accountId: account.id,
            equitySubgroup: draft.equitySubgroup ?? null,
          };
        }

        return {
          accountId: account.id,
          plSubgroup: draft.plSubgroup ?? null,
        };
      });

    if (updates.length === 0) {
      setError('No pending subgroup changes to save.');
      return;
    }

    setConfirmPending({ updates });
  };

  const executeSave = async () => {
    if (!confirmPending) return;
    const { updates } = confirmPending;
    setConfirmPending(null);

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setBatchErrors([]);

    try {
      const result = await accountingApi.batchUpdateSubgroups(updates);
      if (result.errors.length > 0) {
        setBatchErrors(result.errors);
      }
      setSuccessMessage(`Updated ${result.updated} account(s).`);
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to save subgroup updates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subgroup Tagging Tool</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tag accounts for Trading Account and structured Profit &amp; Loss reporting.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">
          {successMessage}
        </div>
      )}
      {batchErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          <p className="font-semibold mb-1">Some updates failed:</p>
          <ul className="list-disc ml-5 space-y-1">
            {batchErrors.map((item, idx) => (
              <li key={`${item.accountId}-${idx}`}>
                {item.accountId || '(missing accountId)'}: {item.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Classification
            </label>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value as ClassificationFilter)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CLASSIFICATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Current Subgroup
            </label>
            <select
              value={subgroupFilter}
              onChange={(e) => setSubgroupFilter(e.target.value as SubgroupFilter)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableSubgroupFilters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Code or name"
                className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={handleToggleSelectAll}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Select All ({filteredAccounts.length})
          </label>

          <div className="flex items-center gap-2">
            <select
              value={bulkSubgroupValue}
              onChange={(e) => setBulkSubgroupValue(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!bulkClassification || selectedAccounts.length === 0}
            >
              <option value="">
                {!bulkClassification
                  ? 'Select one classification first'
                  : `Assign ${bulkClassification.toLowerCase()} subgroup`}
              </option>
              {bulkOptions.map((option) => (
                <option
                  key={`${bulkClassification || 'bulk'}-${option.value ?? 'CLEAR'}`}
                  value={option.value === null ? '__CLEAR__' : option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              onClick={handleApplyBulk}
              disabled={selectedAccounts.length === 0 || !bulkClassification}
              className="bg-slate-900 hover:bg-black text-white"
            >
              Apply to Selected
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-12">Sel</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-24">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Account</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-36">Classification</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-80">Subgroup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading accounts...
                    </span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No accounts found for this filter.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const currentSubgroup = getCurrentSubgroup(account.id, account.normalizedClassification);
                  const unassigned = !currentSubgroup;
                  const modified = isModified(account);

                  return (
                    <tr
                      key={account.id}
                      className={[
                        modified ? 'bg-blue-50' : '',
                        !modified && unassigned ? 'bg-amber-50/60' : '',
                        'hover:bg-slate-50 transition-colors',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(account.id)}
                          onChange={() => handleToggleRow(account.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-slate-700">{account.userCode || account.code}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-900">{account.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {account.accountRole || 'POSTING'}
                          {unassigned && (
                            <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                              <AlertTriangle className="w-3 h-3" />
                              Unassigned
                            </span>
                          )}
                          {modified && <span className="ml-2 text-blue-700 font-semibold">Modified</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${classificationBadgeClass(
                            account.normalizedClassification
                          )}`}
                        >
                          {account.normalizedClassification}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={currentSubgroup ?? '__NONE__'}
                          onChange={(e) =>
                            updateAccountSubgroup(
                              account.id,
                              account.normalizedClassification,
                              e.target.value === '__NONE__' ? null : e.target.value
                            )
                          }
                          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {getSubgroupOptions(account.normalizedClassification).map((option) => (
                            <option
                              key={`${account.id}-${option.value ?? '__NONE__'}`}
                              value={option.value ?? '__NONE__'}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-slate-600">
            Selected: <span className="font-semibold">{selectedIds.size}</span> account(s) | Pending changes:{' '}
            <span className="font-semibold">{modifiedCount}</span>
            <div className="text-xs text-slate-500 mt-1">{summaryText}</div>
          </div>
          <Button
            onClick={handleSaveChanges}
            disabled={saving || modifiedCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmPending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Save</h3>
            <p className="text-sm text-slate-600 mb-6">
              Update <span className="font-semibold">{confirmPending.updates.length}</span> account(s) with new subgroup assignments?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmPending(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Yes, Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubgroupTaggingPage;

