import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ClipboardList, Eye, Filter, RotateCcw, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { StockAdjustmentDTO, StockLevelDTO, inventoryApi } from '../../../api/inventoryApi';
import { DatePicker, WarehouseSelector, ItemSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import {
  DocumentControlPanel,
  DocumentDetailScaffold,
  DocumentHeaderField,
  DocumentHeaderGrid,
  DocumentNoticeBanner,
  DocumentPill,
  DocumentRailChecklist,
  DocumentRailKeyValueList,
  DocumentRailTotals,
  documentHeaderControlClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { Spinner } from '../../../components/ui/Spinner';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { errorHandler } from '../../../services/errorHandler';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = () => new Date().toISOString().slice(0, 10);
const getAdjustmentRef = (id: string) => `ADJ-${id.slice(0, 8).toUpperCase()}`;

interface AdjLine {
  _key: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  currentQty: number;
  newQty: number;
  unitCostBase: number;
  unitCostCCY: number;
  costCurrency?: string;
}

let keySeq = 0;
const newKey = () => `adjln_${Date.now()}_${keySeq++}`;
const emptyLine = (): AdjLine => ({
  _key: newKey(),
  itemId: '',
  currentQty: 0,
  newQty: 0,
  unitCostBase: 0,
  unitCostCCY: 0,
});

const REASONS = ['CORRECTION', 'LOSS', 'DAMAGE', 'FOUND', 'EXPIRED', 'OTHER'];

const StockAdjustmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { uiMode } = useUserPreferences();
  const isWindowsMode = uiMode === 'windows';
  const isNewRoute = window.location.hash.includes('/inventory/adjustments/new') || window.location.pathname.includes('/inventory/adjustments/new');
  const isFormRoute = isNewRoute || Boolean(id);

  const [adjustments, setAdjustments] = useState<StockAdjustmentDTO[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState('CORRECTION');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<AdjLine[]>([emptyLine()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'POSTED'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const selectedAdjustment = useMemo(
    () => (id ? adjustments.find((adjustment) => adjustment.id === id) : undefined),
    [adjustments, id],
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await inventoryApi.listAdjustments();
      setAdjustments(unwrap<StockAdjustmentDTO[]>(result) || []);
    } catch (loadError: any) {
      console.error('Failed to load adjustments', loadError);
      setError(loadError?.message || 'Failed to load stock adjustments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedAdjustment || isNewRoute) return;
    setWarehouseId(selectedAdjustment.warehouseId);
    setDate(selectedAdjustment.date);
    setReason(selectedAdjustment.reason);
    setNotes(selectedAdjustment.notes || '');
    setLines(selectedAdjustment.lines.map((line) => ({
      _key: newKey(),
      itemId: line.itemId,
      currentQty: line.currentQty,
      newQty: line.newQty,
      unitCostBase: line.unitCostBase,
      unitCostCCY: line.unitCostCCY,
    })));
  }, [isNewRoute, selectedAdjustment]);

  const fetchLevel = async (itemId: string, whId: string): Promise<StockLevelDTO | null> => {
    if (!itemId || !whId) return null;
    try {
      const res = await inventoryApi.getStockLevels({ itemId, warehouseId: whId, limit: 1 });
      return (unwrap<StockLevelDTO[]>(res) || [])[0] || null;
    } catch {
      return null;
    }
  };

  const setLine = (index: number, patch: Partial<AdjLine>) => {
    setLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const prefillLine = async (index: number, itemId: string, whId: string) => {
    const level = await fetchLevel(itemId, whId);
    setLine(index, level
      ? { currentQty: level.qtyOnHand, newQty: level.qtyOnHand, unitCostBase: level.avgCostBase, unitCostCCY: level.avgCostCCY }
      : { currentQty: 0, newQty: 0, unitCostBase: 0, unitCostCCY: 0 });
  };

  const onWarehouseChange = async (whId: string) => {
    setWarehouseId(whId);
    if (!whId) return;
    const updated = await Promise.all(lines.map(async (line) => {
      if (!line.itemId) return line;
      const level = await fetchLevel(line.itemId, whId);
      return level
        ? { ...line, currentQty: level.qtyOnHand, newQty: line.newQty || level.qtyOnHand, unitCostBase: level.avgCostBase, unitCostCCY: level.avgCostCCY }
        : line;
    }));
    setLines(updated);
  };

  const filledLines = useMemo(
    () => lines.filter((line) => line.itemId && Number(line.newQty) !== Number(line.currentQty)),
    [lines],
  );
  const totalValue = useMemo(
    () => lines.reduce((sum, line) => sum + Math.abs(line.newQty - line.currentQty) * line.unitCostBase, 0),
    [lines],
  );
  const totalQtyChange = useMemo(
    () => lines.reduce((sum, line) => sum + (line.itemId ? Number(line.newQty) - Number(line.currentQty) : 0), 0),
    [lines],
  );
  const isReadOnly = Boolean(id) && !isNewRoute;

  const resetForm = () => {
    setWarehouseId('');
    setDate(todayIso());
    setReason('CORRECTION');
    setNotes('');
    setLines([emptyLine()]);
  };

  const handleCreate = async () => {
    if (!warehouseId || !date) {
      toast.error('Warehouse and date are required.');
      return;
    }
    if (filledLines.length === 0) {
      toast('No stock quantity change to adjust.', { icon: 'ℹ️' });
      return;
    }
    try {
      setSaving(true);
      const adjustment = unwrap<StockAdjustmentDTO>(await inventoryApi.createAdjustment({
        warehouseId,
        date,
        reason,
        notes: notes || undefined,
        lines: filledLines.map((line) => ({
          itemId: line.itemId,
          currentQty: Number(line.currentQty),
          newQty: Number(line.newQty),
          unitCostBase: Number(line.unitCostBase),
          unitCostCCY: Number(line.unitCostCCY),
        })),
      }));
      toast.success('Stock adjustment created.');
      resetForm();
      await load();
      navigate(`/inventory/adjustments/${adjustment.id}`);
    } catch (createError) {
      console.error('Failed to create adjustment', createError);
      errorHandler.showOperationError(createError);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (adjustmentId: string) => {
    try {
      setPostingId(adjustmentId);
      await inventoryApi.postAdjustment(adjustmentId);
      toast.success('Stock adjustment posted.');
      await load();
    } catch (postError) {
      console.error('Failed to post adjustment', postError);
      errorHandler.showOperationError(postError);
    } finally {
      setPostingId(null);
    }
  };

  const lineColumns: ColumnDef<AdjLine>[] = [
    {
      id: 'item',
      label: 'Item',
      kind: 'custom',
      width: '300px',
      render: (line, index) => (
        <ItemSelector
          value={line.itemId}
          noBorder
          placeholder="Select item"
          trackInventoryOnly
          disabled={saving || isReadOnly}
          onChange={(item) => {
            if (!item) {
              setLine(index, { itemId: '', itemCode: undefined, itemName: undefined, currentQty: 0, newQty: 0, unitCostBase: 0, unitCostCCY: 0 });
              return;
            }
            setLine(index, { itemId: item.id, itemCode: item.code, itemName: item.name, costCurrency: item.costCurrency });
            void prefillLine(index, item.id, warehouseId);
          }}
        />
      ),
    },
    { id: 'currentQty', label: 'Current Qty', kind: 'number', width: '120px', accessor: (line) => line.currentQty, setter: (value) => ({ currentQty: Number(value) }) },
    { id: 'newQty', label: 'New Qty', kind: 'number', width: '120px', accessor: (line) => line.newQty, setter: (value) => ({ newQty: Number(value) }) },
    { id: 'adjQty', label: 'Adj Qty', kind: 'computed', width: '110px', compute: (line) => Number(line.newQty) - Number(line.currentQty) },
    {
      id: 'unitCost',
      label: 'Unit Cost (Base)',
      kind: 'custom',
      width: '140px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving || isReadOnly}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.unitCostBase || ''}
          placeholder="0.00"
          onChange={(event) => {
            const newBase = Number(event.target.value) || 0;
            const ratio = line.unitCostBase > 0 && line.unitCostCCY > 0 ? line.unitCostCCY / line.unitCostBase : 1;
            setLine(index, { unitCostBase: newBase, unitCostCCY: newBase * ratio });
          }}
        />
      ),
    },
    { id: 'adjValue', label: 'Adj Value', kind: 'computed', width: '130px', compute: (line) => Math.abs(Number(line.newQty) - Number(line.currentQty)) * Number(line.unitCostBase) },
  ];

  if (isFormRoute) {
    const notFound = Boolean(id && !loading && !selectedAdjustment && !isNewRoute);
    const railReady: Array<{ state: 'ok' | 'warn' | 'info'; label: React.ReactNode }> = [
      { state: warehouseId ? 'ok' : 'info', label: 'Warehouse selected' },
      { state: date ? 'ok' : 'info', label: 'Adjustment date set' },
      { state: filledLines.length > 0 || isReadOnly ? 'ok' : 'info', label: 'At least one quantity change' },
      { state: totalValue > 0 || isReadOnly ? 'ok' : 'warn', label: 'Adjustment value resolved' },
    ];

    return (
      <DocumentDetailScaffold
        title={isNewRoute ? 'New Stock Adjustment' : selectedAdjustment ? getAdjustmentRef(selectedAdjustment.id) : 'Stock Adjustment'}
        subtitle="Adjust counted inventory quantities with controlled posting"
        icon={ClipboardList}
        backLabel="Back to adjustments"
        onBack={() => navigate('/inventory/adjustments')}
        badges={
          <DocumentPill tone={selectedAdjustment?.status === 'POSTED' ? 'green' : 'amber'}>
            {selectedAdjustment?.status || 'DRAFT'}
          </DocumentPill>
        }
        forceRailDrawer={isWindowsMode}
        sections={{
          banner: {
            show: notFound,
            content: <DocumentNoticeBanner tone="amber">Stock adjustment not found.</DocumentNoticeBanner>,
          },
          control: {
            content: (
              <DocumentControlPanel>
                <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Reason</label>
                    <select
                      className={documentHeaderControlClass}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      disabled={saving || isReadOnly}
                    >
                      {REASONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Posting control</label>
                    <DocumentNoticeBanner tone="blue">
                      Draft adjustments can be posted after review. Posted adjustments are locked by the current API and should be corrected through a new adjustment.
                    </DocumentNoticeBanner>
                  </div>
                </div>
              </DocumentControlPanel>
            ),
          },
          header: {
            title: 'Adjustment Details',
            cardClassName: 'overflow-visible',
            content: (
              <DocumentHeaderGrid>
                <DocumentHeaderField label="Warehouse">
                  <WarehouseSelector
                    className={documentHeaderSelectorClass}
                    value={warehouseId}
                    onChange={(warehouse) => void onWarehouseChange(warehouse?.id || '')}
                    placeholder="Select warehouse"
                    disabled={saving || isReadOnly}
                  />
                </DocumentHeaderField>
                <DocumentHeaderField label="Adjustment Date">
                  <DatePicker
                    className="w-full"
                    inputClassName={documentHeaderControlClass}
                    value={date}
                    onChange={setDate}
                    disabled={saving || isReadOnly}
                  />
                </DocumentHeaderField>
                <DocumentHeaderField label="Notes">
                  <input
                    className={documentHeaderControlClass}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional"
                    disabled={saving || isReadOnly}
                  />
                </DocumentHeaderField>
              </DocumentHeaderGrid>
            ),
          },
          lines: {
            content: (
              <ClassicLineItemsTable<AdjLine>
                tableId="inventory.adjustment.lines"
                title="Adjustment Lines"
                columns={lineColumns}
                rows={lines}
                disabled={saving || isReadOnly}
                onRowChange={setLine}
                onRowRemove={(index) => setLines((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev))}
                onRowsChange={setLines}
                createEmptyRow={emptyLine}
                getRowKey={(line) => line._key}
                isRowFilled={(line) => Boolean(line.itemId)}
                onRowAdd={() => setLines((prev) => [...prev, emptyLine()])}
                addLabel="Add Item"
                minTableWidth="900px"
              />
            ),
          },
        }}
        railSections={{
          info: {
            title: 'Document',
            content: (
              <DocumentRailKeyValueList
                items={[
                  { label: 'Reference', value: selectedAdjustment ? getAdjustmentRef(selectedAdjustment.id) : 'New' },
                  { label: 'Status', value: selectedAdjustment?.status || 'Draft' },
                  { label: 'Reason', value: reason },
                ]}
              />
            ),
          },
          readiness: { title: 'Readiness', content: <DocumentRailChecklist items={railReady} /> },
          totals: {
            title: 'Totals',
            content: (
              <DocumentRailTotals
                rows={[
                  { label: 'Lines', value: String(filledLines.length || selectedAdjustment?.lines.length || 0) },
                  { label: 'Qty Change', value: totalQtyChange.toFixed(2) },
                ]}
                grand={{ label: 'Adjustment Value', value: totalValue.toFixed(2) }}
              />
            ),
          },
        }}
        footerActions={
          <>
            <button
              type="button"
              className="rounded border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => navigate('/inventory/adjustments')}
              disabled={saving || !!postingId}
            >
              Back
            </button>
            {isNewRoute && (
              <button
                type="button"
                className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Create Adjustment'}
              </button>
            )}
            {selectedAdjustment?.status === 'DRAFT' && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => void handlePost(selectedAdjustment.id)}
                disabled={postingId === selectedAdjustment.id}
              >
                {postingId === selectedAdjustment.id ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                Post
              </button>
            )}
          </>
        }
      />
    );
  }

  const statusFilterConfig = {
    activeValue: statusFilter,
    onChange: (value: string) => {
      setStatusFilter(value as typeof statusFilter);
      setPage(1);
    },
    counts: {
      ALL: adjustments.length,
      DRAFT: adjustments.filter((adjustment) => adjustment.status === 'DRAFT').length,
      POSTED: adjustments.filter((adjustment) => adjustment.status === 'POSTED').length,
    },
    options: [
      { value: 'ALL', label: 'All', color: 'slate' },
      { value: 'DRAFT', label: 'Draft', color: 'amber' },
      { value: 'POSTED', label: 'Posted', color: 'emerald' },
    ],
  };

  const filteredData = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return adjustments.filter((adjustment) => {
      if (statusFilter !== 'ALL' && adjustment.status !== statusFilter) return false;
      if (!query) return true;
      return [
        adjustment.id,
        adjustment.warehouseId,
        adjustment.reason,
        adjustment.notes || '',
        adjustment.status,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [adjustments, searchFilter, statusFilter]);

  const sortedData = useMemo(() => {
    const next = [...filteredData];
    if (sortField && sortDirection) {
      next.sort((a: any, b: any) => {
        const aValue = a[sortField] ?? '';
        const bValue = b[sortField] ?? '';
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      next.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    }
    return next;
  }, [filteredData, sortDirection, sortField]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);
  const hasActiveFilters = statusFilter !== 'ALL' || searchFilter !== '';

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const listColumns: ColumnDefinition<StockAdjustmentDTO>[] = [
    {
      key: 'id',
      label: 'Adjustment',
      width: '150px',
      priority: 1,
      sortable: true,
      accessor: 'id',
      render: (value: string) => <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{getAdjustmentRef(value)}</span>,
    },
    { key: 'date', label: 'Date', width: '130px', priority: 1, sortable: true, accessor: 'date' },
    { key: 'warehouseId', label: 'Warehouse', width: '210px', priority: 1, sortable: true, accessor: 'warehouseId', truncate: true },
    { key: 'reason', label: 'Reason', width: '140px', priority: 1, sortable: true, accessor: 'reason' },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      priority: 1,
      sortable: true,
      accessor: 'status',
      align: 'center',
      render: (value: string) => (
        <span className={clsx(
          'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset',
          value === 'POSTED'
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300'
            : 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300',
        )}>
          {value}
        </span>
      ),
    },
    {
      key: 'adjustmentValueBase',
      label: 'Value Base',
      width: '140px',
      priority: 1,
      sortable: true,
      accessor: 'adjustmentValueBase',
      align: 'right',
      render: (value: number) => Number(value || 0).toFixed(2),
    },
  ];

  const rowActions: RowAction<StockAdjustmentDTO>[] = [
    { key: 'view', label: 'View', icon: Eye, onClick: (row) => navigate(`/inventory/adjustments/${row.id}`), primary: false },
    {
      key: 'post',
      label: 'Post',
      icon: Check,
      variant: 'success',
      isEnabled: (row) => row.status === 'DRAFT',
      onClick: (row) => void handlePost(row.id),
      primary: false,
    },
  ];

  return (
    <OperationalListLayout<StockAdjustmentDTO>
      title="Stock Adjustments"
      subtitle=""
      compactHeader
      statusFilterConfig={statusFilterConfig}
      newButtonLabel="New Adjustment"
      onNewClick={() => navigate('/inventory/adjustments/new')}
      onRefresh={load}
      loading={loading}
      error={error}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={() => {
        setLocalSearch('');
        setSearchFilter('');
        setStatusFilter('ALL');
        setPage(1);
      }}
      filters={
        <div className="flex w-full flex-row items-center gap-2.5 overflow-x-auto whitespace-nowrap pb-1.5 lg:pb-0">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSearchFilter(localSearch);
                  setPage(1);
                }
              }}
              placeholder="Search adjustment, warehouse, reason..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchFilter(localSearch);
              setPage(1);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-700"
          >
            <Filter size={16} />
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalSearch('');
              setSearchFilter('');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:bg-slate-50 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Clear Filters"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      }
      columns={listColumns}
      data={paginatedData}
      emptyMessage="No stock adjustments found"
      onRowClick={(row) => navigate(`/inventory/adjustments/${row.id}`)}
      sorting={{ field: sortField, direction: sortDirection, onSort: handleSort }}
      pagination={{
        page,
        pageSize,
        totalItems: sortedData.length,
        totalPages,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
        pageSizeOptions: [10, 25, 50, 100],
      }}
      rowActions={rowActions}
      idKey="id"
    />
  );
};

export default StockAdjustmentPage;
