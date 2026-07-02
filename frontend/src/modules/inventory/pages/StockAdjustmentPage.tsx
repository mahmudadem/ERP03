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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('inventory');
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { uiMode } = useUserPreferences();
  const isWindowsMode = uiMode === 'windows';
  const isNewRoute = window.location.hash.includes('/inventory/adjustments/new') || window.location.pathname.includes('/inventory/adjustments/new');
  const isFormRoute = isNewRoute || Boolean(id);
  const reasonLabel = (value: string) =>
    t(`adjustments.reasons.${value.toLowerCase()}`, { defaultValue: value });
  const statusLabel = (value: string) =>
    t(`adjustments.statuses.${value.toLowerCase()}`, { defaultValue: value });

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
      setError(loadError?.message || t('adjustments.detail.errors.loadFailed'));
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
      toast.error(t('adjustments.detail.validation.warehouseDateRequired'));
      return;
    }
    if (filledLines.length === 0) {
      toast(t('adjustments.detail.validation.noChange'), { icon: 'ℹ️' });
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
      toast.success(t('adjustments.detail.messages.created'));
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
      toast.success(t('adjustments.detail.messages.posted'));
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
      label: t('adjustments.detail.lines.item'),
      kind: 'custom',
      width: '300px',
      render: (line, index) => (
        <ItemSelector
          value={line.itemId}
          noBorder
          placeholder={t('adjustments.detail.lines.selectItem')}
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
    { id: 'currentQty', label: t('adjustments.detail.lines.currentQty'), kind: 'number', width: '120px', accessor: (line) => line.currentQty, setter: (value) => ({ currentQty: Number(value) }) },
    { id: 'newQty', label: t('adjustments.detail.lines.newQty'), kind: 'number', width: '120px', accessor: (line) => line.newQty, setter: (value) => ({ newQty: Number(value) }) },
    { id: 'adjQty', label: t('adjustments.detail.lines.adjustmentQty'), kind: 'computed', width: '110px', compute: (line) => Number(line.newQty) - Number(line.currentQty) },
    {
      id: 'unitCost',
      label: t('adjustments.detail.lines.unitCostBase'),
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
    { id: 'adjValue', label: t('adjustments.detail.lines.adjustmentValue'), kind: 'computed', width: '130px', compute: (line) => Math.abs(Number(line.newQty) - Number(line.currentQty)) * Number(line.unitCostBase) },
  ];

  const formView = isFormRoute ? (() => {
    const notFound = Boolean(id && !loading && !selectedAdjustment && !isNewRoute);
    const railReady: Array<{ state: 'ok' | 'warn' | 'info'; label: React.ReactNode }> = [
      { state: warehouseId ? 'ok' : 'info', label: t('adjustments.detail.readiness.warehouse') },
      { state: date ? 'ok' : 'info', label: t('adjustments.detail.readiness.date') },
      { state: filledLines.length > 0 || isReadOnly ? 'ok' : 'info', label: t('adjustments.detail.readiness.lines') },
      { state: totalValue > 0 || isReadOnly ? 'ok' : 'warn', label: t('adjustments.detail.readiness.value') },
    ];

    return (
      <DocumentDetailScaffold
        title={isNewRoute ? t('adjustments.detail.newTitle') : selectedAdjustment ? getAdjustmentRef(selectedAdjustment.id) : t('adjustments.detail.title')}
        subtitle={t('adjustments.detail.subtitle')}
        icon={ClipboardList}
        backLabel={t('adjustments.detail.backToList')}
        onBack={() => navigate('/inventory/adjustments')}
        badges={
          <DocumentPill tone={selectedAdjustment?.status === 'POSTED' ? 'green' : 'amber'}>
            {statusLabel(selectedAdjustment?.status || 'DRAFT')}
          </DocumentPill>
        }
        forceRailDrawer={isWindowsMode}
        sections={{
          banner: {
            show: notFound,
            content: <DocumentNoticeBanner tone="amber">{t('adjustments.detail.notFound')}</DocumentNoticeBanner>,
          },
          control: {
            content: (
              <DocumentControlPanel>
                <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('adjustments.detail.reason')}</label>
                    <select
                      className={documentHeaderControlClass}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      disabled={saving || isReadOnly}
                    >
                      {REASONS.map((entry) => <option key={entry} value={entry}>{reasonLabel(entry)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('adjustments.detail.postingControl')}</label>
                    <DocumentNoticeBanner tone="blue">
                      {t('adjustments.detail.postingNotice')}
                    </DocumentNoticeBanner>
                  </div>
                </div>
              </DocumentControlPanel>
            ),
          },
          header: {
            title: t('adjustments.detail.details'),
            cardClassName: 'overflow-visible',
            content: (
              <DocumentHeaderGrid>
                <DocumentHeaderField label={t('adjustments.detail.warehouse')}>
                  <WarehouseSelector
                    className={documentHeaderSelectorClass}
                    value={warehouseId}
                    onChange={(warehouse) => void onWarehouseChange(warehouse?.id || '')}
                    placeholder={t('adjustments.detail.selectWarehouse')}
                    disabled={saving || isReadOnly}
                  />
                </DocumentHeaderField>
                <DocumentHeaderField label={t('adjustments.detail.date')}>
                  <DatePicker
                    className="w-full"
                    inputClassName={documentHeaderControlClass}
                    value={date}
                    onChange={setDate}
                    disabled={saving || isReadOnly}
                  />
                </DocumentHeaderField>
                <DocumentHeaderField label={t('adjustments.detail.notes')}>
                  <input
                    className={documentHeaderControlClass}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={t('adjustments.detail.optional')}
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
                title={t('adjustments.detail.adjustmentLines')}
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
                addLabel={t('adjustments.detail.addItem')}
                minTableWidth="900px"
              />
            ),
          },
        }}
        railSections={{
          info: {
            title: t('adjustments.detail.document'),
            content: (
              <DocumentRailKeyValueList
                items={[
                  { label: t('adjustments.detail.reference'), value: selectedAdjustment ? getAdjustmentRef(selectedAdjustment.id) : t('adjustments.detail.new') },
                  { label: t('adjustments.detail.status'), value: statusLabel(selectedAdjustment?.status || 'DRAFT') },
                  { label: t('adjustments.detail.reason'), value: reasonLabel(reason) },
                ]}
              />
            ),
          },
          readiness: { title: t('adjustments.detail.readinessTitle'), content: <DocumentRailChecklist items={railReady} /> },
          totals: {
            title: t('adjustments.detail.totals'),
            content: (
              <DocumentRailTotals
                rows={[
                  { label: t('adjustments.detail.linesLabel'), value: String(filledLines.length || selectedAdjustment?.lines.length || 0) },
                  { label: t('adjustments.detail.qtyChange'), value: totalQtyChange.toFixed(2) },
                ]}
                grand={{ label: t('adjustments.detail.adjustmentValue'), value: totalValue.toFixed(2) }}
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
              {t('adjustments.detail.actions.back')}
            </button>
            {isNewRoute && (
              <button
                type="button"
                className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? t('adjustments.detail.actions.saving') : t('adjustments.detail.actions.create')}
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
                {t('adjustments.detail.actions.post')}
              </button>
            )}
          </>
        }
      />
    );
  })() : null;

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
      { value: 'ALL', label: t('adjustments.statuses.all'), color: 'slate' },
      { value: 'DRAFT', label: t('adjustments.statuses.draft'), color: 'amber' },
      { value: 'POSTED', label: t('adjustments.statuses.posted'), color: 'emerald' },
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
      label: t('adjustments.detail.adjustment'),
      width: '150px',
      priority: 1,
      sortable: true,
      accessor: 'id',
      render: (value: string) => <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{getAdjustmentRef(value)}</span>,
    },
    { key: 'date', label: t('adjustments.detail.date'), width: '130px', priority: 1, sortable: true, accessor: 'date' },
    { key: 'warehouseId', label: t('adjustments.detail.warehouse'), width: '210px', priority: 1, sortable: true, accessor: 'warehouseId', truncate: true },
    { key: 'reason', label: t('adjustments.detail.reason'), width: '140px', priority: 1, sortable: true, accessor: 'reason', render: (value: string) => reasonLabel(value) },
    {
      key: 'status',
      label: t('adjustments.detail.status'),
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
          {statusLabel(value)}
        </span>
      ),
    },
    {
      key: 'adjustmentValueBase',
      label: t('adjustments.detail.valueBase'),
      width: '140px',
      priority: 1,
      sortable: true,
      accessor: 'adjustmentValueBase',
      align: 'right',
      render: (value: number) => Number(value || 0).toFixed(2),
    },
  ];

  const rowActions: RowAction<StockAdjustmentDTO>[] = [
    { key: 'view', label: t('adjustments.detail.actions.view'), icon: Eye, onClick: (row) => navigate(`/inventory/adjustments/${row.id}`), primary: false },
    {
      key: 'post',
      label: t('adjustments.detail.actions.post'),
      icon: Check,
      variant: 'success',
      isEnabled: (row) => row.status === 'DRAFT',
      onClick: (row) => void handlePost(row.id),
      primary: false,
    },
  ];

  if (formView) {
    return formView;
  }

  return (
    <OperationalListLayout<StockAdjustmentDTO>
      title={t('adjustments.title', { defaultValue: 'Stock Adjustments' })}
      subtitle=""
      compactHeader
      statusFilterConfig={statusFilterConfig}
      newButtonLabel={t('adjustments.new', { defaultValue: 'New Adjustment' })}
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
              placeholder={t('adjustments.searchPlaceholder', { defaultValue: 'Search adjustment, warehouse, reason...' })}
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
            {t('adjustments.apply', { defaultValue: 'Apply' })}
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
            title={t('adjustments.clearFilters', { defaultValue: 'Clear Filters' })}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      }
      columns={listColumns}
      data={paginatedData}
      emptyMessage={t('adjustments.empty', { defaultValue: 'No stock adjustments found' })}
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
