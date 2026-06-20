import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Check, Eye, Filter, RotateCcw, Search, Scale } from 'lucide-react';
import { clsx } from 'clsx';
import {
  InventoryRevaluationDTO,
  InventoryRevaluationReason,
  InventorySettingsDTO,
  StockLevelDTO,
  inventoryApi,
} from '../../../api/inventoryApi';
import { DatePicker, ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
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
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Spinner } from '../../../components/ui/Spinner';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { errorHandler } from '../../../services/errorHandler';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = () => new Date().toISOString().slice(0, 10);
const getRevaluationRef = (id: string) => `REV-${id.slice(0, 8).toUpperCase()}`;

interface RevLine {
  _key: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  warehouseId?: string;
  costCurrency?: string;
  qtyOnHand: number;
  currentAvgCostBase: number;
  currentAvgCostCCY: number;
  newAvgCostBase: number;
  newAvgCostCCY: number;
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
});

const REASONS: InventoryRevaluationReason[] = [
  'COST_CORRECTION',
  'BASIS_CHANGE',
  'MIGRATION_FIX',
  'WRITE_OFF',
  'OTHER',
];

const InventoryRevaluationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { uiMode } = useUserPreferences();
  const isWindowsMode = uiMode === 'windows';
  const isNewRoute =
    window.location.hash.includes('/inventory/revaluations/new') ||
    window.location.pathname.includes('/inventory/revaluations/new');
  const isFormRoute = isNewRoute || Boolean(id);

  const [revaluations, setRevaluations] = useState<InventoryRevaluationDTO[]>([]);
  const [settings, setSettings] = useState<InventorySettingsDTO | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState<InventoryRevaluationReason>('COST_CORRECTION');
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
  const [postingConfirm, setPostingConfirm] = useState<InventoryRevaluationDTO | null>(null);

  const selectedRevaluation = useMemo(
    () => (id ? revaluations.find((revaluation) => revaluation.id === id) : undefined),
    [revaluations, id],
  );
  const costingBasis = settings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE';
  const isGlobalCosting = costingBasis === 'GLOBAL';

  const reasonLabels: Record<InventoryRevaluationReason, string> = {
    COST_CORRECTION: t('inventory.revaluations.reasons.costCorrection', 'Cost correction'),
    BASIS_CHANGE: t('inventory.revaluations.reasons.basisChange', 'Costing basis change'),
    MIGRATION_FIX: t('inventory.revaluations.reasons.migrationFix', 'Migration cleanup'),
    WRITE_OFF: t('inventory.revaluations.reasons.writeOff', 'Write-off'),
    OTHER: t('inventory.revaluations.reasons.other', 'Other'),
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [result, settingsResult] = await Promise.all([
        inventoryApi.listInventoryRevaluations(),
        inventoryApi.getSettings(),
      ]);
      setRevaluations(unwrap<InventoryRevaluationDTO[]>(result) || []);
      setSettings(unwrap<InventorySettingsDTO | null>(settingsResult));
    } catch (loadError: any) {
      console.error('Failed to load revaluations', loadError);
      setError(loadError?.message || t('inventory.revaluations.errors.loadFailed', 'Failed to load inventory revaluations.'));
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
        warehouseId: line.warehouseId,
        qtyOnHand: line.qtyOnHand,
        currentAvgCostBase: line.currentAvgCostBase,
        currentAvgCostCCY: line.currentAvgCostCCY,
        newAvgCostBase: line.newAvgCostBase,
        newAvgCostCCY: line.newAvgCostCCY,
      })),
    );
  }, [isNewRoute, selectedRevaluation]);

  const fetchLevel = async (
    itemId: string,
    whId?: string,
  ): Promise<StockLevelDTO | null> => {
    if (!itemId) return null;
    try {
      const res = await inventoryApi.getStockLevels(
        whId ? { itemId, warehouseId: whId, limit: 1 } : { itemId }
      );
      const levels = unwrap<StockLevelDTO[]>(res) || [];
      if (whId) return levels[0] || null;
      const qtyOnHand = levels.reduce((sum, level) => sum + level.qtyOnHand, 0);
      if (qtyOnHand <= 0) return null;
      const valueBase = levels.reduce((sum, level) => sum + level.qtyOnHand * level.avgCostBase, 0);
      const valueCCY = levels.reduce((sum, level) => sum + level.qtyOnHand * level.avgCostCCY, 0);
      return {
        ...levels[0],
        warehouseId: '',
        qtyOnHand,
        avgCostBase: valueBase / qtyOnHand,
        avgCostCCY: valueCCY / qtyOnHand,
      };
    } catch {
      return null;
    }
  };

  const setLine = (index: number, patch: Partial<RevLine>) => {
    setLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const prefillLine = async (index: number, itemId: string, whId: string) => {
    if (!isGlobalCosting && !whId) {
      setLine(index, { currentAvgCostBase: 0, currentAvgCostCCY: 0, qtyOnHand: 0 });
      return;
    }
    const level = await fetchLevel(itemId, isGlobalCosting ? undefined : whId);
    setLine(
      index,
      level
        ? {
            qtyOnHand: level.qtyOnHand,
            currentAvgCostBase: level.avgCostBase,
            currentAvgCostCCY: level.avgCostCCY,
          }
        : { qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 },
    );
  };

  const onWarehouseChange = async (whId: string) => {
    setWarehouseId(whId);
    if (isGlobalCosting || !whId) return;
    const updated = await Promise.all(
      lines.map(async (line) => {
        if (!line.itemId) return line;
        const level = await fetchLevel(line.itemId, whId);
        return level
          ? { ...line, qtyOnHand: level.qtyOnHand, currentAvgCostBase: level.avgCostBase, currentAvgCostCCY: level.avgCostCCY }
          : { ...line, qtyOnHand: 0, currentAvgCostBase: 0, currentAvgCostCCY: 0 };
      }),
    );
    setLines(updated);
  };

  const filledLines = useMemo(
    () => lines.filter((line) => line.itemId && line.qtyOnHand > 0),
    [lines],
  );

  const totalValueDelta = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + line.qtyOnHand * (Number(line.newAvgCostBase) - Number(line.currentAvgCostBase)),
        0,
      ),
    [lines],
  );

  const linesWithDelta = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        valueDeltaBase: line.qtyOnHand * (Number(line.newAvgCostBase) - Number(line.currentAvgCostBase)),
        valueDeltaCCY: line.qtyOnHand * (Number(line.newAvgCostCCY) - Number(line.currentAvgCostCCY)),
      })),
    [lines],
  );

  const isReadOnly = Boolean(id) && !isNewRoute;

  const resetForm = () => {
    setWarehouseId('');
    setDate(todayIso());
    setReason('COST_CORRECTION');
    setNotes('');
    setLines([emptyLine()]);
  };

  const handleCreate = async () => {
    if (!date) {
      toast.error(t('inventory.revaluations.errors.dateRequired', 'Date is required.'));
      return;
    }
    if (filledLines.length === 0) {
      toast.error(t('inventory.revaluations.errors.lineRequired', 'At least one line with positive on-hand quantity is required.'));
      return;
    }
    if (lines.every((l) => l.itemId && Math.abs(Number(l.newAvgCostBase) - Number(l.currentAvgCostBase)) < 0.005)) {
      toast(t('inventory.revaluations.noDelta', 'No value delta to revalue.'), { icon: 'ℹ️' });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        date,
        reason,
        notes: notes || undefined,
        lines: lines
          .filter((l) => l.itemId && l.qtyOnHand > 0)
          .map((line) => ({
            itemId: line.itemId,
            warehouseId: isGlobalCosting ? undefined : (warehouseId || line.warehouseId),
            newAvgCostBase: Number(line.newAvgCostBase),
            newAvgCostCCY: Number(line.newAvgCostCCY),
          })),
      };
      const revaluation = unwrap<InventoryRevaluationDTO>(
        await inventoryApi.createInventoryRevaluation(payload),
      );
      toast.success(t('inventory.revaluations.toasts.drafted', 'Inventory revaluation drafted.'));
      resetForm();
      await load();
      navigate(`/inventory/revaluations/${revaluation.id}`);
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
      await inventoryApi.postInventoryRevaluation(revaluationId);
      toast.success(t('inventory.revaluations.toasts.posted', 'Inventory revaluation posted.'));
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
      label: t('inventory.revaluations.columns.item', 'Item'),
      kind: 'custom',
      width: '300px',
      render: (line, index) => (
        <ItemSelector
          value={line.itemId}
          noBorder
          placeholder={t('inventory.revaluations.placeholders.item', 'Select item')}
          trackInventoryOnly
          disabled={saving || isReadOnly}
          onChange={(item) => {
            if (!item) {
              setLine(index, {
                itemId: '',
                itemCode: undefined,
                itemName: undefined,
                costCurrency: undefined,
                qtyOnHand: 0,
                currentAvgCostBase: 0,
                currentAvgCostCCY: 0,
              });
              return;
            }
            setLine(index, {
              itemId: item.id,
              itemCode: item.code,
              itemName: item.name,
              costCurrency: item.costCurrency,
            });
            void prefillLine(index, item.id, warehouseId);
          }}
        />
      ),
    },
    {
      id: 'qty',
      label: t('inventory.revaluations.columns.currentQty', 'Current Qty'),
      kind: 'number',
      width: '110px',
      accessor: (line) => line.qtyOnHand,
    },
    {
      id: 'currentAvgCost',
      label: t('inventory.revaluations.columns.currentAvgCost', 'Current Avg Cost'),
      kind: 'number',
      width: '150px',
      accessor: (line) => line.currentAvgCostBase,
    },
    {
      id: 'currentValue',
      label: t('inventory.revaluations.columns.currentValue', 'Current Value'),
      kind: 'computed',
      width: '140px',
      align: 'right',
      compute: (line) => line.qtyOnHand * Number(line.currentAvgCostBase),
    },
    {
      id: 'newAvgCost',
      label: t('inventory.revaluations.columns.newAvgCostBase', 'New Avg Cost (Base)'),
      kind: 'custom',
      width: '170px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving || isReadOnly || !line.itemId}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.newAvgCostBase || ''}
          placeholder="0.00"
          onChange={(event) => {
            const newBase = Number(event.target.value) || 0;
            const ratio = line.currentAvgCostBase > 0 && line.currentAvgCostCCY > 0
              ? line.currentAvgCostCCY / line.currentAvgCostBase
              : 1;
            setLine(index, { newAvgCostBase: newBase, newAvgCostCCY: newBase * ratio });
          }}
        />
      ),
    },
    {
      id: 'newValue',
      label: t('inventory.revaluations.columns.newValue', 'New Value'),
      kind: 'computed',
      width: '140px',
      align: 'right',
      compute: (line) => line.qtyOnHand * Number(line.newAvgCostBase),
    },
    {
      id: 'valueDelta',
      label: t('inventory.revaluations.columns.valueDelta', 'Value Delta'),
      kind: 'computed',
      width: '140px',
      align: 'right',
      compute: (line) =>
        line.qtyOnHand * (Number(line.newAvgCostBase) - Number(line.currentAvgCostBase)),
    },
  ];

  const formView = isFormRoute
    ? (() => {
        const notFound = Boolean(id && !loading && !selectedRevaluation && !isNewRoute);
        const linesToShow = isReadOnly && selectedRevaluation
          ? selectedRevaluation.lines.map<RevLine>((l) => ({
              _key: l.itemId,
              itemId: l.itemId,
              warehouseId: l.warehouseId,
              qtyOnHand: l.qtyOnHand,
              currentAvgCostBase: l.currentAvgCostBase,
              currentAvgCostCCY: l.currentAvgCostCCY,
              newAvgCostBase: l.newAvgCostBase,
              newAvgCostCCY: l.newAvgCostCCY,
            }))
          : lines;
        const railReady: Array<{ state: 'ok' | 'warn' | 'info'; label: React.ReactNode }> = [
          { state: date ? 'ok' : 'info', label: t('inventory.revaluations.readiness.date', 'Revaluation date set') },
          { state: filledLines.length > 0 || isReadOnly ? 'ok' : 'info', label: t('inventory.revaluations.readiness.qty', 'At least one item with qty') },
          { state: linesWithDelta.some((l) => Math.abs(l.valueDeltaBase) >= 0.005) || isReadOnly ? 'ok' : 'info', label: t('inventory.revaluations.readiness.delta', 'New cost differs from current') },
          { state: 'info', label: t('inventory.revaluations.readiness.account', 'Revaluation account required when GL posting') },
        ];

        return (
          <DocumentDetailScaffold
            title={isNewRoute ? t('inventory.revaluations.newTitle', 'New Inventory Revaluation') : selectedRevaluation ? getRevaluationRef(selectedRevaluation.id) : t('inventory.revaluations.detailTitle', 'Inventory Revaluation')}
            subtitle={t('inventory.revaluations.subtitle', 'Value-only cost correction. Quantity is never changed.')}
            icon={Scale}
            backLabel={t('inventory.revaluations.backToList', 'Back to revaluations')}
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
                content: <DocumentNoticeBanner tone="amber">{t('inventory.revaluations.notFound', 'Inventory revaluation not found.')}</DocumentNoticeBanner>,
              },
              control: {
                content: (
                  <DocumentControlPanel>
                    <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('inventory.revaluations.fields.reason', 'Reason')}</label>
                        <select
                          className={documentHeaderControlClass}
                          value={reason}
                          onChange={(event) => setReason(event.target.value as InventoryRevaluationReason)}
                          disabled={saving || isReadOnly}
                        >
                          {REASONS.map((entry) => (
                            <option key={entry} value={entry}>
                              {reasonLabels[entry]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('inventory.revaluations.postingControl', 'Posting control')}</label>
                        <DocumentNoticeBanner tone="blue">
                          {t(
                            'inventory.revaluations.postingNotice',
                            'Inventory Revaluation never changes quantity. In INVOICE_DRIVEN / PERPETUAL mode, posting creates a balanced GL voucher against the Inventory Revaluation account. In PERIODIC mode, the sub-ledger average updates but no daily Inventory Asset GL voucher is created.'
                          )}
                        </DocumentNoticeBanner>
                      </div>
                    </div>
                  </DocumentControlPanel>
                ),
              },
              header: {
                title: t('inventory.revaluations.details', 'Revaluation Details'),
                cardClassName: 'overflow-visible',
                content: (
                  <DocumentHeaderGrid>
                    <DocumentHeaderField label={isGlobalCosting ? t('inventory.revaluations.fields.globalBasis', 'Global costing basis') : t('inventory.revaluations.fields.warehouse', 'Warehouse')}>
                      <WarehouseSelector
                        className={documentHeaderSelectorClass}
                        value={warehouseId}
                        onChange={(warehouse) => void onWarehouseChange(warehouse?.id || '')}
                        placeholder={isGlobalCosting ? t('inventory.revaluations.placeholders.globalWarehouse', 'Not used in GLOBAL mode') : t('inventory.revaluations.placeholders.warehouse', 'Select warehouse')}
                        disabled={saving || isReadOnly || isGlobalCosting}
                      />
                    </DocumentHeaderField>
                    <DocumentHeaderField label={t('inventory.revaluations.fields.date', 'Revaluation Date')}>
                      <DatePicker
                        className="w-full"
                        inputClassName={documentHeaderControlClass}
                        value={date}
                        onChange={setDate}
                        disabled={saving || isReadOnly}
                      />
                    </DocumentHeaderField>
                    <DocumentHeaderField label={t('inventory.revaluations.fields.notes', 'Notes')}>
                      <input
                        className={documentHeaderControlClass}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t('common.optional', 'Optional')}
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
                    title={t('inventory.revaluations.linesTitle', 'Revaluation Lines')}
                    columns={lineColumns}
                    rows={linesToShow}
                    disabled={saving || isReadOnly}
                    onRowChange={setLine}
                    onRowRemove={(index) => setLines((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev))}
                    onRowsChange={setLines}
                    createEmptyRow={emptyLine}
                    getRowKey={(line) => line._key}
                    isRowFilled={(line) => Boolean(line.itemId)}
                    onRowAdd={() => setLines((prev) => [...prev, emptyLine()])}
                    addLabel={t('inventory.revaluations.addItem', 'Add Item')}
                    minTableWidth="1100px"
                  />
                ),
              },
            }}
            railSections={{
              info: {
                title: t('inventory.revaluations.rail.document', 'Document'),
                content: (
                  <DocumentRailKeyValueList
                    items={[
                      { label: t('inventory.revaluations.rail.reference', 'Reference'), value: selectedRevaluation ? getRevaluationRef(selectedRevaluation.id) : t('common.new', 'New') },
                      { label: t('inventory.revaluations.rail.status', 'Status'), value: selectedRevaluation?.status || t('common.draft', 'Draft') },
                      { label: t('inventory.revaluations.rail.reason', 'Reason'), value: reasonLabels[reason] },
                      { label: t('inventory.revaluations.rail.date', 'Date'), value: date },
                      ...(selectedRevaluation?.voucherId
                        ? [{ label: t('inventory.revaluations.rail.voucher', 'Voucher'), value: selectedRevaluation.voucherId.slice(0, 12) }]
                        : []),
                    ]}
                  />
                ),
              },
              readiness: { title: t('inventory.revaluations.rail.readiness', 'Readiness'), content: <DocumentRailChecklist items={railReady} /> },
              totals: {
                title: t('inventory.revaluations.rail.totals', 'Totals'),
                content: (
                  <DocumentRailTotals
                    rows={[
                      { label: t('inventory.revaluations.rail.lines', 'Lines'), value: String(filledLines.length || selectedRevaluation?.lines.length || 0) },
                      { label: t('inventory.revaluations.rail.valueDeltaBase', 'Value Δ (Base)'), value: (selectedRevaluation?.totalValueDeltaBase ?? totalValueDelta).toFixed(2) },
                    ]}
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
                    {saving ? t('common.saving', 'Saving...') : t('inventory.revaluations.saveDraft', 'Save Draft')}
                  </button>
                )}
                {selectedRevaluation?.status === 'DRAFT' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={() => setPostingConfirm(selectedRevaluation)}
                    disabled={postingId === selectedRevaluation.id}
                  >
                    {postingId === selectedRevaluation.id ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                    {t('inventory.revaluations.post', 'Post Revaluation')}
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
      DRAFT: revaluations.filter((revaluation) => revaluation.status === 'DRAFT').length,
      POSTED: revaluations.filter((revaluation) => revaluation.status === 'POSTED').length,
    },
    options: [
      { value: 'ALL', label: t('common.all', 'All'), color: 'slate' },
      { value: 'DRAFT', label: t('common.draft', 'Draft'), color: 'amber' },
      { value: 'POSTED', label: t('common.posted', 'Posted'), color: 'emerald' },
    ],
  };

  const filteredData = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return revaluations.filter((revaluation) => {
      if (statusFilter !== 'ALL' && revaluation.status !== statusFilter) return false;
      if (!query) return true;
      return [
        revaluation.id,
        revaluation.reason,
        revaluation.notes || '',
        revaluation.status,
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
      label: t('inventory.revaluations.list.revaluation', 'Revaluation'),
      width: '150px',
      priority: 1,
      sortable: true,
      accessor: 'id',
      render: (value: string) => <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{getRevaluationRef(value)}</span>,
    },
    { key: 'date', label: t('inventory.revaluations.list.date', 'Date'), width: '130px', priority: 1, sortable: true, accessor: 'date' },
    { key: 'reason', label: t('inventory.revaluations.list.reason', 'Reason'), width: '200px', priority: 1, sortable: true, accessor: 'reason', render: (value: string) => reasonLabels[value as InventoryRevaluationReason] || value },
    {
      key: 'status',
      label: t('inventory.revaluations.list.status', 'Status'),
      width: '120px',
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
              : 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300',
          )}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'totalValueDeltaBase',
      label: t('inventory.revaluations.list.valueDeltaBase', 'Value Δ (Base)'),
      width: '160px',
      priority: 1,
      sortable: true,
      accessor: 'totalValueDeltaBase',
      align: 'right',
      render: (value: number) => Number(value || 0).toFixed(2),
    },
  ];

  const rowActions: RowAction<InventoryRevaluationDTO>[] = [
    { key: 'view', label: t('common.view', 'View'), icon: Eye, onClick: (row) => navigate(`/inventory/revaluations/${row.id}`), primary: false },
    {
      key: 'post',
      label: t('common.post', 'Post'),
      icon: Check,
      variant: 'success',
      isEnabled: (row) => row.status === 'DRAFT',
      onClick: (row) => setPostingConfirm(row),
      primary: false,
    },
  ];

  if (formView) {
    return (
      <>
        {formView}
        <ConfirmDialog
          isOpen={!!postingConfirm}
          title={t('inventory.revaluations.confirm.title', 'Post inventory revaluation?')}
          message={
            postingConfirm
              ? t('inventory.revaluations.confirm.message', 'This posts the revaluation and updates the sub-ledger average cost. In INVOICE_DRIVEN / PERPETUAL mode a balanced GL voucher is created against the Inventory Revaluation / Variance account. In PERIODIC mode the sub-ledger updates but no daily GL voucher is created.')
              : ''
          }
          confirmLabel={t('inventory.revaluations.post', 'Post Revaluation')}
          cancelLabel={t('common.cancel', 'Cancel')}
          tone="warning"
          isConfirming={!!postingId}
          onConfirm={() => {
            if (!postingConfirm) return;
            const id = postingConfirm.id;
            setPostingConfirm(null);
            void handlePost(id);
          }}
          onCancel={() => !postingId && setPostingConfirm(null)}
        />
      </>
    );
  }

  return (
    <>
      <OperationalListLayout<InventoryRevaluationDTO>
        title={t('inventory.revaluations.title', 'Inventory Revaluations')}
        subtitle=""
        compactHeader
        statusFilterConfig={statusFilterConfig}
        newButtonLabel={t('inventory.revaluations.newButton', 'New Revaluation')}
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
                placeholder={t('inventory.revaluations.searchPlaceholder', 'Search revaluation, reason, notes...')}
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
        emptyMessage={t('inventory.revaluations.empty', 'No inventory revaluations found')}
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
      <ConfirmDialog
        isOpen={!!postingConfirm}
        title={t('inventory.revaluations.confirm.title', 'Post inventory revaluation?')}
        message={
          postingConfirm
            ? t('inventory.revaluations.confirm.message', 'This posts the revaluation and updates the sub-ledger average cost. In INVOICE_DRIVEN / PERPETUAL mode a balanced GL voucher is created against the Inventory Revaluation / Variance account. In PERIODIC mode the sub-ledger updates but no daily GL voucher is created.')
            : ''
        }
        confirmLabel={t('inventory.revaluations.post', 'Post Revaluation')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="warning"
        isConfirming={!!postingId}
        onConfirm={() => {
          if (!postingConfirm) return;
          const id = postingConfirm.id;
          setPostingConfirm(null);
          void handlePost(id);
        }}
        onCancel={() => !postingId && setPostingConfirm(null)}
      />
    </>
  );
};

export default InventoryRevaluationPage;
