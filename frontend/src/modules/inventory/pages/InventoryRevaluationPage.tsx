import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Filter, RotateCcw, Scale, Search, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { InventoryRevaluationDTO, inventoryApi } from '../../../api/inventoryApi';
import { DatePicker, ItemSelector } from '../../../components/shared/selectors';
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
import { useConfirm } from '../../../hooks/useConfirm';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = () => new Date().toISOString().slice(0, 10);
const getRevRef = (id: string) => `REV-${id.slice(0, 8).toUpperCase()}`;

const REASONS = [
  { value: 'COST_CORRECTION', labelKey: 'inventory.revaluation.reasons.costCorrection' },
  { value: 'BASIS_CHANGE', labelKey: 'inventory.revaluation.reasons.basisChange' },
  { value: 'MIGRATION_FIX', labelKey: 'inventory.revaluation.reasons.migrationFix' },
  { value: 'WRITE_OFF', labelKey: 'inventory.revaluation.reasons.writeOff' },
  { value: 'OTHER', labelKey: 'inventory.revaluation.reasons.other' },
];

interface RevLine {
  _key: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  qtyOnHand: number;
  currentAvgCostBase: number;
  currentAvgCostCCY: number;
  newAvgCostBase: number;
  newAvgCostCCY: number;
  valueDeltaBase: number;
  valueDeltaCCY: number;
  reason?: string;
}

let keySeq = 0;
const newKey = () => `revln_${Date.now()}_${keySeq++}`;
const emptyLine = (): RevLine => ({
  _key: newKey(),
  itemId: '',
  qtyOnHand: 0,
  currentAvgCostBase: 0,
  currentAvgCostCCY: 0,
  newAvgCostBase: 0,
  newAvgCostCCY: 0,
  valueDeltaBase: 0,
  valueDeltaCCY: 0,
});

const InventoryRevaluationPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { uiMode } = useUserPreferences();
  const { confirm, confirmDialog } = useConfirm();
  const { t } = useTranslation();
  const isWindowsMode = uiMode === 'windows';
  const isNewRoute =
    window.location.hash.includes('/inventory/revaluations/new') ||
    window.location.pathname.includes('/inventory/revaluations/new');
  const isFormRoute = isNewRoute || Boolean(id);

  const [revaluations, setRevaluations] = useState<InventoryRevaluationDTO[]>([]);
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState('COST_CORRECTION');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<RevLine[]>([emptyLine()]);
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

  const selectedRevaluation = useMemo(
    () => (id ? revaluations.find((rev) => rev.id === id) : undefined),
    [revaluations, id]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await inventoryApi.listRevaluations();
      setRevaluations(unwrap<InventoryRevaluationDTO[]>(result) || []);
    } catch (loadError: any) {
      console.error('Failed to load revaluations', loadError);
      setError(loadError?.message || 'Failed to load inventory revaluations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedRevaluation || isNewRoute) return;
    setDate(selectedRevaluation.date);
    setReason(selectedRevaluation.reason);
    setNotes(selectedRevaluation.notes || '');
    setLines(
      selectedRevaluation.lines.map((line) => ({
        _key: newKey(),
        itemId: line.itemId,
        qtyOnHand: line.qtyOnHand,
        currentAvgCostBase: line.currentAvgCostBase,
        currentAvgCostCCY: line.currentAvgCostCCY,
        newAvgCostBase: line.newAvgCostBase,
        newAvgCostCCY: line.newAvgCostCCY,
        valueDeltaBase: line.valueDeltaBase,
        valueDeltaCCY: line.valueDeltaCCY,
        reason: line.reason,
      }))
    );
  }, [isNewRoute, selectedRevaluation]);

  const setLine = (index: number, patch: Partial<RevLine>) => {
    setLines((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch, valueDeltaBase: 0, valueDeltaCCY: 0 } : line
      )
    );
  };

  const recomputeDelta = (line: RevLine): { base: number; ccy: number } => {
    const deltaBase = Number(line.qtyOnHand) * (Number(line.newAvgCostBase) - Number(line.currentAvgCostBase));
    const deltaCCY = Number(line.qtyOnHand) * (Number(line.newAvgCostCCY) - Number(line.currentAvgCostCCY));
    return { base: Math.round((deltaBase + Number.EPSILON) * 100) / 100, ccy: Math.round((deltaCCY + Number.EPSILON) * 100) / 100 };
  };

  const updateLineCost = (index: number, patch: Partial<RevLine>) => {
    setLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next: RevLine = { ...line, ...patch };
        const { base, ccy } = recomputeDelta(next);
        return { ...next, valueDeltaBase: base, valueDeltaCCY: ccy };
      })
    );
  };

  const filledLines = useMemo(
    () => lines.filter((line) => line.itemId),
    [lines]
  );

  const totalValueDeltaBase = useMemo(
    () => Math.round((filledLines.reduce((sum, line) => sum + Number(line.valueDeltaBase || 0), 0) + Number.EPSILON) * 100) / 100,
    [filledLines]
  );
  const totalValueDeltaCCY = useMemo(
    () => Math.round((filledLines.reduce((sum, line) => sum + Number(line.valueDeltaCCY || 0), 0) + Number.EPSILON) * 100) / 100,
    [filledLines]
  );

  const isReadOnly = Boolean(id) && !isNewRoute;

  const resetForm = () => {
    setDate(todayIso());
    setReason('COST_CORRECTION');
    setNotes('');
    setLines([emptyLine()]);
  };

  const handleCreate = async () => {
    if (!date) {
      toast.error('Posting date is required.');
      return;
    }
    if (filledLines.length === 0) {
      toast('At least one item line is required.', { icon: 'ℹ️' });
      return;
    }
    if (Math.abs(totalValueDeltaBase) < 0.005 && Math.abs(totalValueDeltaCCY) < 0.005) {
      toast.error('All lines have zero value delta. Change the new average cost to produce a value delta.');
      return;
    }
    try {
      setSaving(true);
      const created = unwrap<InventoryRevaluationDTO>(await inventoryApi.createRevaluation({
        date,
        reason,
        notes: notes || undefined,
        lines: filledLines.map((line) => ({
          itemId: line.itemId,
          qtyOnHand: Number(line.qtyOnHand),
          currentAvgCostBase: Number(line.currentAvgCostBase),
          currentAvgCostCCY: Number(line.currentAvgCostCCY),
          newAvgCostBase: Number(line.newAvgCostBase),
          newAvgCostCCY: Number(line.newAvgCostCCY),
          valueDeltaBase: Number(line.valueDeltaBase),
          valueDeltaCCY: Number(line.valueDeltaCCY),
          reason: line.reason,
        })),
      }));
      toast.success('Inventory revaluation created.');
      resetForm();
      await load();
      navigate(`/inventory/revaluations/${created.id}`);
    } catch (createError) {
      console.error('Failed to create revaluation', createError);
      errorHandler.showOperationError(createError);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (revaluationId: string) => {
    try {
      setPostingId(revaluationId);
      await inventoryApi.postRevaluation(revaluationId);
      toast.success('Inventory revaluation posted.');
      await load();
    } catch (postError) {
      console.error('Failed to post revaluation', postError);
      errorHandler.showOperationError(postError);
    } finally {
      setPostingId(null);
    }
  };

  const lineColumns: ColumnDef<RevLine>[] = [
    {
      id: 'item',
      label: t('inventory.revaluation.line.item', 'Item'),
      kind: 'custom',
      width: '280px',
      render: (line, index) => (
        <ItemSelector
          value={line.itemId}
          noBorder
          placeholder={t('inventory.revaluation.line.itemPlaceholder', 'Select item')}
          trackInventoryOnly
          disabled={saving || isReadOnly}
          onChange={(item) => {
            if (!item) {
              setLine(index, {
                itemId: '',
                itemCode: undefined,
                itemName: undefined,
                qtyOnHand: 0,
                currentAvgCostBase: 0,
                currentAvgCostCCY: 0,
                newAvgCostBase: 0,
                newAvgCostCCY: 0,
              });
              return;
            }
            setLine(index, {
              itemId: item.id,
              itemCode: item.code,
              itemName: item.name,
              qtyOnHand: 0,
              currentAvgCostBase: 0,
              currentAvgCostCCY: 0,
              newAvgCostBase: 0,
              newAvgCostCCY: 0,
            });
          }}
        />
      ),
    },
    {
      id: 'qty',
      label: t('inventory.revaluation.line.qty', 'Qty on hand'),
      kind: 'custom',
      width: '110px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving || isReadOnly}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.qtyOnHand || ''}
          placeholder="0"
          onChange={(event) =>
            updateLineCost(index, { qtyOnHand: Number(event.target.value) || 0 })
          }
        />
      ),
    },
    {
      id: 'currentBase',
      label: t('inventory.revaluation.line.currentAvgBase', 'Current Avg (Base)'),
      kind: 'custom',
      width: '130px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving || isReadOnly}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.currentAvgCostBase || ''}
          placeholder="0.00"
          onChange={(event) =>
            updateLineCost(index, { currentAvgCostBase: Number(event.target.value) || 0 })
          }
        />
      ),
    },
    {
      id: 'currentCcy',
      label: t('inventory.revaluation.line.currentAvgCcy', 'Current Avg (CCY)'),
      kind: 'custom',
      width: '130px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving || isReadOnly}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.currentAvgCostCCY || ''}
          placeholder="0.00"
          onChange={(event) =>
            updateLineCost(index, { currentAvgCostCCY: Number(event.target.value) || 0 })
          }
        />
      ),
    },
    {
      id: 'newBase',
      label: t('inventory.revaluation.line.newAvgBase', 'New Avg (Base)'),
      kind: 'custom',
      width: '130px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving || isReadOnly}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.newAvgCostBase || ''}
          placeholder="0.00"
          onChange={(event) =>
            updateLineCost(index, { newAvgCostBase: Number(event.target.value) || 0 })
          }
        />
      ),
    },
    {
      id: 'newCcy',
      label: t('inventory.revaluation.line.newAvgCcy', 'New Avg (CCY)'),
      kind: 'custom',
      width: '130px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving || isReadOnly}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.newAvgCostCCY || ''}
          placeholder="0.00"
          onChange={(event) =>
            updateLineCost(index, { newAvgCostCCY: Number(event.target.value) || 0 })
          }
        />
      ),
    },
    {
      id: 'valueDelta',
      label: t('inventory.revaluation.line.valueDelta', 'Value Delta (Base)'),
      kind: 'computed',
      width: '130px',
      align: 'right',
      compute: (line) => Number(line.valueDeltaBase || 0).toFixed(2),
    },
  ];

  const formView = isFormRoute
    ? (() => {
        const notFound = Boolean(id && !loading && !selectedRevaluation && !isNewRoute);
        const railReady: Array<{ state: 'ok' | 'warn' | 'info'; label: React.ReactNode }> = [
          { state: date ? 'ok' : 'info', label: t('inventory.revaluation.rail.date', 'Posting date set') },
          { state: filledLines.length > 0 || isReadOnly ? 'ok' : 'info', label: t('inventory.revaluation.rail.line', 'At least one revaluation line') },
          { state: Math.abs(totalValueDeltaBase) >= 0.005 || isReadOnly ? 'ok' : 'warn', label: t('inventory.revaluation.rail.delta', 'Value delta resolved') },
        ];

        return (
          <DocumentDetailScaffold
            title={
              isNewRoute
                ? t('inventory.revaluation.title.new', 'New Inventory Revaluation')
                : selectedRevaluation
                  ? getRevRef(selectedRevaluation.id)
                  : t('inventory.revaluation.title.default', 'Inventory Revaluation')
            }
            subtitle={t(
              'inventory.revaluation.subtitle',
              'Value-only inventory cost correction (quantity never changes)'
            )}
            icon={Scale}
            backLabel={t('inventory.revaluation.back', 'Back to revaluations')}
            onBack={() => navigate('/inventory/revaluations')}
            badges={
              <DocumentPill tone={selectedRevaluation?.status === 'POSTED' ? 'green' : 'amber'}>
                {selectedRevaluation?.status || 'DRAFT'}
              </DocumentPill>
            }
            forceRailDrawer={isWindowsMode}
            sections={{
              banner: {
                show: notFound,
                content: (
                  <DocumentNoticeBanner tone="amber">
                    {t('inventory.revaluation.notFound', 'Inventory revaluation not found.')}
                  </DocumentNoticeBanner>
                ),
              },
              control: {
                content: (
                  <DocumentControlPanel>
                    <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          {t('inventory.revaluation.reason', 'Reason')}
                        </label>
                        <select
                          className={documentHeaderControlClass}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          disabled={saving || isReadOnly}
                        >
                          {REASONS.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {t(entry.labelKey, entry.value)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          {t('inventory.revaluation.postingControl', 'Posting control')}
                        </label>
                        <DocumentNoticeBanner tone="blue">
                          {t(
                            'inventory.revaluation.postingHelp',
                            'Drafts can be posted after review. Posted revaluations correct the sub-ledger and the GL together — quantity never changes.'
                          )}
                        </DocumentNoticeBanner>
                      </div>
                    </div>
                  </DocumentControlPanel>
                ),
              },
              header: {
                title: t('inventory.revaluation.header.title', 'Revaluation Details'),
                cardClassName: 'overflow-visible',
                content: (
                  <DocumentHeaderGrid>
                    <DocumentHeaderField label={t('inventory.revaluation.header.date', 'Posting Date')}>
                      <DatePicker
                        className="w-full"
                        inputClassName={documentHeaderControlClass}
                        value={date}
                        onChange={setDate}
                        disabled={saving || isReadOnly}
                      />
                    </DocumentHeaderField>
                    <DocumentHeaderField label={t('inventory.revaluation.header.notes', 'Notes')}>
                      <input
                        className={documentHeaderControlClass}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t('inventory.revaluation.header.notesPlaceholder', 'Optional')}
                        disabled={saving || isReadOnly}
                      />
                    </DocumentHeaderField>
                  </DocumentHeaderGrid>
                ),
              },
              lines: {
                content: (
                  <ClassicLineItemsTable<RevLine>
                    tableId="inventory.revaluation.lines"
                    title={t('inventory.revaluation.line.title', 'Revaluation Lines')}
                    columns={lineColumns}
                    rows={lines}
                    disabled={saving || isReadOnly}
                    onRowChange={setLine}
                    onRowRemove={(index) =>
                      setLines((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev))
                    }
                    onRowsChange={setLines}
                    createEmptyRow={emptyLine}
                    getRowKey={(line) => line._key}
                    isRowFilled={(line) => Boolean(line.itemId)}
                    onRowAdd={() => setLines((prev) => [...prev, emptyLine()])}
                    addLabel={t('inventory.revaluation.line.add', 'Add Item')}
                    minTableWidth="1200px"
                  />
                ),
              },
            }}
            railSections={{
              info: {
                title: t('inventory.revaluation.rail.info', 'Document'),
                content: (
                  <DocumentRailKeyValueList
                    items={[
                      { label: t('inventory.revaluation.rail.reference', 'Reference'), value: selectedRevaluation ? getRevRef(selectedRevaluation.id) : t('inventory.revaluation.rail.new', 'New') },
                      { label: t('inventory.revaluation.rail.status', 'Status'), value: selectedRevaluation?.status || t('inventory.revaluation.rail.draft', 'Draft') },
                      { label: t('inventory.revaluation.rail.reason', 'Reason'), value: reason },
                    ]}
                  />
                ),
              },
              readiness: { title: t('inventory.revaluation.rail.readiness', 'Readiness'), content: <DocumentRailChecklist items={railReady} /> },
              totals: {
                title: t('inventory.revaluation.rail.totals', 'Totals'),
                content: (
                  <DocumentRailTotals
                    rows={[
                      { label: t('inventory.revaluation.rail.lines', 'Lines'), value: String(filledLines.length || selectedRevaluation?.lines.length || 0) },
                      { label: t('inventory.revaluation.rail.deltaCcy', 'Value Δ (CCY)'), value: totalValueDeltaCCY.toFixed(2) },
                    ]}
                    grand={{ label: t('inventory.revaluation.rail.deltaBase', 'Value Δ (Base)'), value: totalValueDeltaBase.toFixed(2) }}
                  />
                ),
              },
            }}
            footerActions={
              <>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => navigate('/inventory/revaluations')}
                  disabled={saving || !!postingId}
                >
                  {t('common.back', 'Back')}
                </button>
                {isNewRoute && (
                  <button
                    type="button"
                    className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    onClick={handleCreate}
                    disabled={saving}
                  >
                    {saving ? t('inventory.revaluation.creating', 'Creating...') : t('inventory.revaluation.create', 'Create Revaluation')}
                  </button>
                )}
                {selectedRevaluation?.status === 'DRAFT' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={() => void handlePost(selectedRevaluation.id)}
                    disabled={postingId === selectedRevaluation.id}
                  >
                    {postingId === selectedRevaluation.id ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                    {t('inventory.revaluation.post', 'Post')}
                  </button>
                )}
              </>
            }
          />
        );
      })()
    : null;

  const statusFilterConfig = {
    activeValue: statusFilter,
    onChange: (value: string) => {
      setStatusFilter(value as typeof statusFilter);
      setPage(1);
    },
    counts: {
      ALL: revaluations.length,
      DRAFT: revaluations.filter((rev) => rev.status === 'DRAFT').length,
      POSTED: revaluations.filter((rev) => rev.status === 'POSTED').length,
    },
    options: [
      { value: 'ALL', label: t('common.all', 'All'), color: 'slate' },
      { value: 'DRAFT', label: t('common.draft', 'Draft'), color: 'amber' },
      { value: 'POSTED', label: t('common.posted', 'Posted'), color: 'emerald' },
    ],
  };

  const filteredData = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return revaluations.filter((rev) => {
      if (statusFilter !== 'ALL' && rev.status !== statusFilter) return false;
      if (!query) return true;
      return [
        rev.id,
        rev.reason,
        rev.notes || '',
        rev.status,
        rev.voucherId || '',
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [revaluations, searchFilter, statusFilter]);

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

  const listColumns: ColumnDefinition<InventoryRevaluationDTO>[] = [
    {
      key: 'id',
      label: t('inventory.revaluation.list.id', 'Revaluation'),
      width: '150px',
      priority: 1,
      sortable: true,
      accessor: 'id',
      render: (value: string) => (
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{getRevRef(value)}</span>
      ),
    },
    { key: 'date', label: t('inventory.revaluation.list.date', 'Date'), width: '130px', priority: 1, sortable: true, accessor: 'date' },
    { key: 'reason', label: t('inventory.revaluation.list.reason', 'Reason'), width: '160px', priority: 1, sortable: true, accessor: 'reason' },
    {
      key: 'status',
      label: t('inventory.revaluation.list.status', 'Status'),
      width: '110px',
      priority: 1,
      sortable: true,
      accessor: 'status',
      align: 'center',
      render: (value: string) => (
        <span
          className={clsx(
            'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset',
            value === 'POSTED'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300'
          )}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'totalValueDeltaBase',
      label: t('inventory.revaluation.list.deltaBase', 'Value Δ (Base)'),
      width: '150px',
      priority: 1,
      sortable: true,
      accessor: 'totalValueDeltaBase',
      align: 'right',
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      key: 'voucherId',
      label: t('inventory.revaluation.list.voucher', 'Voucher'),
      width: '150px',
      priority: 2,
      accessor: 'voucherId',
      render: (value?: string) =>
        value ? (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{value}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  const rowActions: RowAction<InventoryRevaluationDTO>[] = [
    {
      key: 'view',
      label: t('common.view', 'View'),
      icon: Search,
      onClick: (row) => navigate(`/inventory/revaluations/${row.id}`),
      primary: false,
    },
    {
      key: 'post',
      label: t('inventory.revaluation.post', 'Post'),
      icon: Check,
      variant: 'success',
      isEnabled: (row) => row.status === 'DRAFT',
      onClick: (row) => void handlePost(row.id),
      primary: false,
    },
    {
      key: 'delete',
      label: t('common.delete', 'Delete'),
      icon: Trash2,
      variant: 'danger',
      isEnabled: (row) => row.status === 'DRAFT',
      onClick: async (row) => {
        const ok = await confirm({
          title: t('inventory.revaluation.confirmDeleteTitle', 'Delete draft revaluation?'),
          message: t('inventory.revaluation.confirmDelete', 'Delete this draft revaluation? This cannot be undone.'),
          tone: 'danger',
          confirmLabel: t('common.delete', 'Delete'),
        });
        if (!ok) return;
        try {
          await inventoryApi.deleteRevaluation(row.id);
          toast.success(t('inventory.revaluation.deleted', 'Draft revaluation deleted.'));
          await load();
        } catch (delError) {
          errorHandler.showOperationError(delError);
        }
      },
      primary: false,
    },
  ];

  if (formView) {
    return (
      <>
        {formView}
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      <OperationalListLayout<InventoryRevaluationDTO>
      title={t('inventory.revaluation.title.list', 'Inventory Revaluations')}
      subtitle=""
      compactHeader
      statusFilterConfig={statusFilterConfig}
      newButtonLabel={t('inventory.revaluation.newButton', 'New Revaluation')}
      onNewClick={() => navigate('/inventory/revaluations/new')}
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
              placeholder={t('inventory.revaluation.search', 'Search revaluation, reason, voucher...')}
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
            {t('common.apply', 'Apply')}
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
            title={t('common.clearFilters', 'Clear Filters')}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      }
      columns={listColumns}
      data={paginatedData}
      emptyMessage={t('inventory.revaluation.empty', 'No inventory revaluations found')}
      onRowClick={(row) => navigate(`/inventory/revaluations/${row.id}`)}
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
    </>
  );
};

export default InventoryRevaluationPage;
