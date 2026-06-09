import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import { GRNStatus, GoodsReceiptDTO, purchasesApi } from '../../../api/purchasesApi';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { clsx } from 'clsx';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: GRNStatus | 'ALL'; color: string }> = [
  { label: 'All', value: 'ALL', color: 'bg-slate-400' },
  { label: 'Draft', value: 'DRAFT', color: 'bg-slate-500' },
  { label: 'Posted', value: 'POSTED', color: 'bg-emerald-500' },
  { label: 'Cancelled', value: 'CANCELLED', color: 'bg-rose-500' },
];

const statusChipClasses = (status: GRNStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'POSTED':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
};

const GoodsReceiptsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<GRNStatus | 'ALL'>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [receipts, setReceipts] = useState<GoodsReceiptDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const warehouseNameById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses],
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [grnResult, warehouseResult] = await Promise.all([
        purchasesApi.listGRNs({ limit: 200 }),
        inventoryApi.listWarehouses({ active: true, limit: 200 }),
      ]);
      setReceipts(unwrap<GoodsReceiptDTO[]>(grnResult) || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehouseResult) || []);
    } catch (err: any) {
      console.error('Failed to load goods receipts', err);
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to load goods receipts.');
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredReceipts = useMemo(() => {
    const term = searchFilter.trim().toLowerCase();
    return receipts.filter((grn) => {
      if (statusFilter !== 'ALL' && grn.status !== statusFilter) return false;
      if (!term) return true;
      return [grn.grnNumber, grn.vendorName, grn.vendorId, grn.warehouseId, warehouseNameById[grn.warehouseId]]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [receipts, searchFilter, statusFilter, warehouseNameById]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: receipts.length };
    STATUS_OPTIONS.forEach((option) => {
      if (option.value !== 'ALL') counts[option.value] = receipts.filter((grn) => grn.status === option.value).length;
    });
    return counts;
  }, [receipts]);

  const pagedReceipts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReceipts.slice(start, start + pageSize);
  }, [filteredReceipts, page, pageSize]);

  const columns = useMemo<ColumnDefinition<GoodsReceiptDTO>[]>(
    () => [
      { key: 'grnNumber', label: 'GRN #', width: '150px', priority: 1, sortable: true, accessor: 'grnNumber', align: 'center', render: (value) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'vendorName', label: 'Vendor', width: '220px', priority: 1, sortable: true, accessor: 'vendorName', align: 'center', render: (value) => <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'receiptDate', label: 'Receipt Date', width: '150px', priority: 1, sortable: true, accessor: 'receiptDate', align: 'center' },
      { key: 'warehouseId', label: 'Warehouse', width: '220px', priority: 1, accessor: 'warehouseId', align: 'center', render: (value) => warehouseNameById[value] || value || '-' },
      {
        key: 'status',
        label: 'Status',
        width: '130px',
        priority: 1,
        sortable: true,
        accessor: 'status',
        align: 'center',
        render: (value) => (
          <span className={clsx('whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset', statusChipClasses(value))}>
            {value}
          </span>
        ),
      },
    ],
    [warehouseNameById],
  );

  const rowActions = useMemo<RowAction<GoodsReceiptDTO>[]>(
    () => [
      { key: 'open', label: 'Open', icon: Eye, onClick: (row) => navigate(`/purchases/goods-receipts/${row.id}`), primary: false },
    ],
    [navigate],
  );

  const hasActiveFilters = statusFilter !== 'ALL' || !!searchFilter;

  return (
    <OperationalListLayout<GoodsReceiptDTO>
      title="Goods Receipts"
      subtitle="Receive stock into inventory and post operational receipts."
      newButtonLabel="New GRN"
      onNewClick={() => navigate('/purchases/goods-receipts/new')}
      onRefresh={load}
      loading={loading}
      error={error}
      filters={
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSearchFilter(localSearch);
                  setPage(1);
                }
              }}
              placeholder="GRN #, vendor, warehouse..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as GRNStatus | 'ALL');
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:w-40"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button type="button" className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white" onClick={() => { setSearchFilter(localSearch); setPage(1); }}>
            Apply
          </button>
        </div>
      }
      hasActiveFilters={hasActiveFilters}
      onClearFilters={() => {
        setStatusFilter('ALL');
        setLocalSearch('');
        setSearchFilter('');
        setPage(1);
      }}
      statusFilterConfig={{
        options: STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label, color: option.color })),
        activeValue: statusFilter,
        onChange: (value) => {
          setStatusFilter(value as GRNStatus | 'ALL');
          setPage(1);
        },
        counts: statusCounts,
      }}
      columns={columns}
      data={pagedReceipts}
      rowActions={rowActions}
      onRowClick={(row) => navigate(`/purchases/goods-receipts/${row.id}`)}
      emptyMessage="No goods receipts found."
      pagination={{
        page,
        pageSize,
        totalItems: filteredReceipts.length,
        totalPages: Math.max(1, Math.ceil(filteredReceipts.length / pageSize)),
        onPageChange: setPage,
        onPageSizeChange: (nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        },
        pageSizeOptions: [10, 25, 50, 100],
      }}
    />
  );
};

export default GoodsReceiptsListPage;
