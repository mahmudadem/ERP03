import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search, Filter, RotateCcw } from 'lucide-react';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import { GRNStatus, GoodsReceiptDTO, purchasesApi } from '../../../api/purchasesApi';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

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
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
    case 'POSTED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-500/20';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-500/20';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
  }
};

const GoodsReceiptsListPage: React.FC = () => { 
  const { t } = useTranslation(['purchases', 'common']);
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
      { key: 'grnNumber', label: t('goodsReceiptsList.labels.gRN', 'GRN #'), width: '150px', priority: 1, sortable: true, accessor: 'grnNumber', align: 'center', render: (value) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'vendorName', label: t('goodsReceiptsList.labels.vendor', 'Vendor'), width: '220px', priority: 1, sortable: true, accessor: 'vendorName', align: 'center', render: (value) => <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'receiptDate', label: t('goodsReceiptsList.labels.receiptDate', 'Receipt Date'), width: '150px', priority: 1, sortable: true, accessor: 'receiptDate', align: 'center' },
      { key: 'warehouseId', label: t('goodsReceiptsList.labels.warehouse', 'Warehouse'), width: '220px', priority: 1, accessor: 'warehouseId', align: 'center', render: (value) => warehouseNameById[value] || value || '-' },
      {
        key: 'status',
        label: t('goodsReceiptsList.labels.status', 'Status'),
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
      { key: 'open', label: t('goodsReceiptsList.labels.open', 'Open'), icon: Eye, onClick: (row) => navigate(`/purchases/goods-receipts/${row.id}`), primary: false },
    ],
    [navigate],
  );

  const handleApply = () => {
    setSearchFilter(localSearch);
    setPage(1);
  };

  const handleClear = () => {
    setLocalSearch('');
    setSearchFilter('');
    setStatusFilter('ALL');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'ALL' || !!searchFilter;

  return (
    <OperationalListLayout<GoodsReceiptDTO>
      title={t('goodsReceiptsList.title', 'Goods Receipts')}
      subtitle=""
      compactHeader
      newButtonLabel={t('goodsReceiptsList.newButton', 'New GRN')}
      onNewClick={() => navigate('/purchases/goods-receipts/new')}
      onRefresh={load}
      loading={loading}
      error={error}
      filters={
        <div className="flex flex-row items-center gap-2.5 w-full overflow-x-auto whitespace-nowrap pb-1.5 lg:pb-0 scrollbar-thin">
          {/* SEARCH */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder={t("auto.GoodsReceiptsListPage.gRNVendorWarehouse", "GRN #, vendor, warehouse...")}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* STATUS */}
          <div className="w-32 flex-shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as GRNStatus | 'ALL');
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.value === 'ALL' ? 'Status' : status.label}
                </option>
              ))}
            </select>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-all hover:shadow-md hover:shadow-primary-600/10 active:scale-[0.98] duration-200"
            >
              <Filter size={16} />
              <span>{t("auto.GoodsReceiptsListPage.apply", "Apply")}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
              title={t('goodsReceiptsList.title', 'Clear')}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClear}
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
      emptyMessage={t('goodsReceiptsList.emptyMessage', 'No goods receipts found.')}
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
