import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DataTable, ColumnDefinition, RowAction, BadgeConfig, ActiveFilters, FilterOption, DataTablePaginationState } from '../../components/ui/DataTable';
import { useVouchersWithCache } from '../../hooks/useVouchersWithCache';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { RotateCcw, RefreshCw, Lock, Eye, Printer } from 'lucide-react';
import { clsx } from 'clsx';

interface DisplayRow {
  id: string;
  isNested: boolean;
  parentId?: string;
  voucher: any;
  depth: number;
}

const getDerivedStatus = (
  voucher: any,
  hasReversalMap: Set<string>,
  isActuallyReversedMap: Set<string>
): string => {
  const hasVisibleReversal = hasReversalMap.has(voucher.id);
  const isReversed = !voucher.reversalOfVoucherId && (
    hasVisibleReversal
      ? isActuallyReversedMap.has(voucher.id)
      : !!voucher.metadata?.isReversed
  );
  if (isReversed) return 'Reversed';
  if (!!voucher.postedAt) return 'Posted';
  return voucher.status.charAt(0).toUpperCase() + voucher.status.slice(1);
};

const rowMatchesFilters = (
  voucher: any,
  filters: ActiveFilters,
  hasRevMap: Set<string>,
  isRevMap: Set<string>
): boolean => {
  const status = getDerivedStatus(voucher, hasRevMap, isRevMap);

  if (filters.status && filters.status !== 'ALL') {
    const filterStatuses = Array.isArray(filters.status) ? filters.status.filter((s): s is string => typeof s === 'string') : [filters.status].filter((s): s is string => typeof s === 'string');
    if (!filterStatuses.some((s) => s.toLowerCase() === status.toLowerCase())) return false;
  }

  if (filters.type && filters.type !== 'ALL') {
    const filterTypes = Array.isArray(filters.type) ? filters.type.filter((t): t is string => typeof t === 'string') : [filters.type].filter((t): t is string => typeof t === 'string');
    if (!filterTypes.some((t) => t.toLowerCase() === voucher.type?.toLowerCase())) return false;
  }

  if (filters.date) {
    const dateFilter = filters.date as { from?: string; to?: string };
    const itemDate = voucher.date?.split('T')[0];
    if (dateFilter.from && itemDate && itemDate < dateFilter.from) return false;
    if (dateFilter.to && itemDate && itemDate > dateFilter.to) return false;
  }

  if (filters.search) {
    const term = String(filters.search).toLowerCase();
    const searchable = `${voucher.voucherNo || ''} ${voucher.description || ''} ${voucher.id || ''}`.toLowerCase();
    if (!searchable.includes(term)) return false;
  }

  return true;
};

const SmartVoucherListPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();
  const { settings } = useCompanySettings();

  const {
    vouchers,
    isLoading,
    pagination: apiPagination,
    setPage,
    invalidateVouchers,
  } = useVouchersWithCache(companyId);

  const { reversalGroups, isActuallyReversedMap, hasReversalMap } = useMemo(() => {
    const reversals = vouchers.filter((v: any) => v.reversalOfVoucherId);

    const rGroups = reversals.reduce((acc: Record<string, any[]>, r: any) => {
      const pid = r.reversalOfVoucherId!;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(r);
      return acc;
    }, {} as Record<string, any[]>);

    const actuallyReversed = new Set(
      Object.entries(rGroups)
        .filter(([, group]: [string, any[]]) => group.some((r: any) => !!r.postedAt))
        .map(([pid]) => pid)
    );

    const hasReversal = new Set(Object.keys(rGroups));

    return { reversalGroups: rGroups, isActuallyReversedMap: actuallyReversed, hasReversalMap: hasReversal };
  }, [vouchers]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleExpandedChange = useCallback((ids: Set<string>) => {
    setExpandedIds(ids);
  }, []);

  const displayRows: DisplayRow[] = useMemo(() => {
    const topLevel = vouchers.filter((v: any) => !v.reversalOfVoucherId);
    const result: DisplayRow[] = [];

    topLevel.forEach((v: any) => {
      result.push({ id: v.id, isNested: false, voucher: v, depth: 0 });
      if (expandedIds.has(v.id) && reversalGroups[v.id]) {
        reversalGroups[v.id].forEach((rev: any) => {
          result.push({ id: rev.id, isNested: true, parentId: v.id, voucher: rev, depth: 1 });
        });
      }
    });

    return result;
  }, [vouchers, expandedIds, reversalGroups]);

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  useEffect(() => {
    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    if (!hasActiveFilters || vouchers.length === 0) return;

    const topLevel = vouchers.filter((v: any) => !v.reversalOfVoucherId);
    const reversals = vouchers.filter((v: any) => !!v.reversalOfVoucherId);

    const autoExpandIds: string[] = [];

    topLevel.forEach((v: any) => {
      const parentMatches = rowMatchesFilters(v, activeFilters, hasReversalMap, isActuallyReversedMap);
      if (!parentMatches) {
        const children = reversals.filter((r: any) => r.reversalOfVoucherId === v.id);
        const hasMatchingChild = children.some((c: any) => rowMatchesFilters(c, activeFilters, hasReversalMap, isActuallyReversedMap));
        if (hasMatchingChild) {
          autoExpandIds.push(v.id);
        }
      }
    });

    if (autoExpandIds.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        autoExpandIds.forEach((id) => {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [activeFilters, vouchers, hasReversalMap, isActuallyReversedMap]);

  const statusBadgeConfig: BadgeConfig = useMemo(
    () => ({
      variantMap: {
        Posted: 'success',
        Approved: 'info',
        Pending: 'warning',
        Draft: 'default',
        Cancelled: 'error',
        Rejected: 'error',
        Reversed: 'error',
      },
    }),
    []
  );

  const statusOptions: FilterOption[] = useMemo(() => {
    const statuses = new Set<string>();
    vouchers.forEach((v: any) => statuses.add(getDerivedStatus(v, hasReversalMap, isActuallyReversedMap)));
    return Array.from(statuses).sort().map((s) => ({ value: s, label: s }));
  }, [vouchers, hasReversalMap, isActuallyReversedMap]);

  const typeOptions: FilterOption[] = useMemo(() => {
    const types = new Set<string>();
    vouchers.forEach((v: any) => types.add(v.type));
    return Array.from(types).sort().map((t) => ({ value: t, label: t }));
  }, [vouchers]);

  const columns: ColumnDefinition<DisplayRow>[] = useMemo(
    () => [
      {
        key: 'date',
        label: t('voucherTable.columns.date'),
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: (row: DisplayRow) => row.voucher.date,
        render: (_value: any, row: DisplayRow) => (
          <div className={clsx('flex flex-col', row.isNested && 'pl-4')}>
            <span className="font-medium text-sm">{formatCompanyDate(row.voucher.date, settings)}</span>
            <span className="text-xs text-gray-400">
              {row.voucher.createdAt ? new Date(row.voucher.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ),
        filter: { type: 'date-range' },
      },
      {
        key: 'number',
        label: t('voucherTable.columns.number'),
        width: '130px',
        priority: 1,
        sortable: true,
        accessor: (row: DisplayRow) => row.voucher.voucherNo || row.voucher.id,
        render: (_value: any, row: DisplayRow) => (
          <div className="flex items-center gap-2 font-mono text-sm">
            {row.voucher.postingLockPolicy === 'STRICT_LOCKED' && <Lock size={12} className="text-amber-600 shrink-0" />}
            {row.isNested && <RotateCcw size={12} className="text-amber-600 shrink-0" />}
            {!row.isNested && hasReversalMap.has(row.voucher.id) && !isActuallyReversedMap.has(row.voucher.id) && (
              <RefreshCw size={12} className="text-amber-500 animate-pulse shrink-0" />
            )}
            <span className={clsx(row.isNested && 'italic', row.voucher.postingLockPolicy === 'STRICT_LOCKED' && 'font-bold')}>
              {(row.voucher.voucherNo || row.voucher.id)?.slice(-12) || '-'}
            </span>
          </div>
        ),
        filter: { type: 'text', placeholder: t('voucherTable.filters.searchNumber') },
      },
      {
        key: 'type',
        label: t('voucherTable.columns.type'),
        width: '110px',
        priority: 2,
        sortable: true,
        accessor: (row: DisplayRow) => row.voucher.type,
        render: (_value: any, row: DisplayRow) => (
          <span
            className={clsx(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              row.isNested
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            )}
          >
            {row.voucher.type}
          </span>
        ),
        filter: { type: 'multi-select', options: typeOptions },
      },
      {
        key: 'description',
        label: t('voucherTable.columns.name'),
        width: '200px',
        priority: 1,
        truncate: true,
        accessor: (row: DisplayRow) => row.voucher.description || '-',
      },
      {
        key: 'status',
        label: t('voucherTable.columns.status'),
        width: '100px',
        priority: 1,
        align: 'center',
        sortable: true,
        accessor: (row: DisplayRow) => getDerivedStatus(row.voucher, hasReversalMap, isActuallyReversedMap),
        badge: statusBadgeConfig,
        filter: { type: 'multi-select', options: statusOptions },
      },
      {
        key: 'currency',
        label: t('voucherTable.columns.currency'),
        width: '70px',
        priority: 3,
        align: 'center',
        accessor: (row: DisplayRow) => row.voucher.currency,
      },
      {
        key: 'amount',
        label: t('voucherTable.columns.amount'),
        width: '120px',
        priority: 1,
        align: 'right',
        sortable: true,
        accessor: (row: DisplayRow) => row.voucher.voucherAmount ?? row.voucher.totalDebit,
        render: (value: any) => (
          <span className="font-mono text-sm font-medium">
            {value != null ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
          </span>
        ),
      },
    ],
    [t, settings, hasReversalMap, isActuallyReversedMap, statusBadgeConfig, typeOptions, statusOptions]
  );

  const rowActions: RowAction<DisplayRow>[] = useMemo(
    () => [
      {
        key: 'view',
        label: t('voucherTable.actions.view'),
        icon: Eye,
        onClick: (row: DisplayRow) => navigate(`/accounting/vouchers/${row.voucher.id}/view`),
        primary: true,
      },
      {
        key: 'print',
        label: t('voucherTable.actions.print'),
        icon: Printer,
        onClick: (row: DisplayRow) => {
          window.dispatchEvent(new CustomEvent('print-voucher', { detail: { id: row.voucher.id } }));
        },
        primary: true,
      },
    ],
    [navigate, t]
  );

  const renderExpanded = useCallback(
    (row: DisplayRow) => {
      if (!row.isNested) return null;
      const parent = vouchers.find((v: any) => v.id === row.parentId);
      return (
        <div className="flex items-center gap-4 text-xs text-gray-500 px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10">
          <RotateCcw size={14} className="text-amber-600" />
          <span>
            Reversal of <span className="font-mono font-medium text-amber-700">{parent?.voucherNo || parent?.id?.slice(-8)}</span>
          </span>
          {row.voucher.postedAt && (
            <Badge variant="success">
              Posted
            </Badge>
          )}
        </div>
      );
    },
    [vouchers]
  );

  const isRowExpandable = useCallback(
    (row: DisplayRow) => !row.isNested && hasReversalMap.has(row.voucher.id),
    [hasReversalMap]
  );

  const getRowClassName = useCallback(
    (row: DisplayRow) =>
      clsx(
        row.isNested
          ? 'bg-amber-50/30 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10'
          : 'hover:bg-primary-50 dark:hover:bg-primary-900/10'
      ),
    []
  );

  const paginationState: DataTablePaginationState | undefined = apiPagination
    ? {
        page: apiPagination.page,
        pageSize: apiPagination.pageSize,
        totalItems: apiPagination.totalItems,
        totalPages: apiPagination.totalPages,
        onPageChange: setPage,
      }
    : undefined;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <div className="flex-none p-4 pb-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Smart Voucher List</h1>
            <p className="text-sm text-gray-500 mt-1">
              {vouchers.length} vouchers · {displayRows.length} rows (reversals shown inline)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={invalidateVouchers} className="gap-2">
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/accounting/vouchers')}>
              + New Voucher
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 overflow-hidden">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col h-full">
          <DataTable
            columns={columns}
            data={displayRows}
            loading={isLoading}
            emptyMessage="No vouchers found"
            onRowClick={(row: DisplayRow) => navigate(`/accounting/vouchers/${row.voucher.id}/view`)}
            rowActions={rowActions}
            expandable
            renderExpanded={renderExpanded}
            expandedIds={expandedIds}
            onExpandedChange={handleExpandedChange}
            isRowExpandable={isRowExpandable}
            getRowClassName={getRowClassName}
            searchable
            searchPlaceholder="Search vouchers..."
            onSearch={(term: string) => setActiveFilters((prev: ActiveFilters) => ({ ...prev, search: term }))}
            onFilterChange={setActiveFilters}
            activeFilters={activeFilters}
            pagination={paginationState}
            density="comfortable"
            idKey={(row: DisplayRow) => row.id}
          />
        </div>
      </div>
    </div>
  );
};

export default SmartVoucherListPage;
