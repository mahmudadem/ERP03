import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowLeftRight, Plus, Eye, Edit, Trash2, Check, RotateCcw, Search, Filter, Coins } from 'lucide-react';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DatePicker, WarehouseSelector, ItemSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import {
  DocumentDetailScaffold,
  DocumentHeaderGrid,
  DocumentHeaderField,
  documentHeaderControlClass,
  documentHeaderSelectorClass,
  DocumentControlPanel,
  DocumentSegmentedGroup,
  DocumentSegmentButton,
  DocumentRailKeyValueList,
  DocumentRailChecklist,
  DocumentRailTotals,
  DocumentNoticeBanner,
  DocumentPill,
} from '../../../components/shared/DocumentDetailScaffold';
import { errorHandler } from '../../../services/errorHandler';
import {
  InventoryWarehouseDTO,
  InventoryItemDTO,
  StockLevelDTO,
  StockMovementDTO,
  StockTransferDTO,
  inventoryApi,
} from '../../../api/inventoryApi';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate, formatCompanyTime } from '../../../utils/dateUtils';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { clsx } from 'clsx';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type TransferMode = 'FLAT' | 'VALUED';

interface TLine {
  _key: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  qty: number;
  sourceOnHand: number;
  sourceCostBase: number;
  sourceCostCCY: number;
  landedCostBase: number;
  landedCostCCY: number;
  notes?: string;
}

let keySeq = 0;
const newKey = () => `trfln_${Date.now()}_${keySeq++}`;
const emptyLine = (): TLine => ({
  _key: newKey(),
  itemId: '',
  qty: 1,
  sourceOnHand: 0,
  sourceCostBase: 0,
  sourceCostCCY: 0,
  landedCostBase: 0,
  landedCostCCY: 0,
  notes: '',
});

const todayIso = () => new Date().toISOString().slice(0, 10);

const StockTransfersPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { uiMode } = useUserPreferences();
  const { settings: companySettings } = useCompanySettings();
  const isWindowsMode = uiMode === 'windows';

  const [view, setView] = useState<'list' | 'form'>('list');
  const [transfers, setTransfers] = useState<StockTransferDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [allowNegativeStock, setAllowNegativeStock] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'COMPLETED'>('ALL');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [sourceWarehouseFilter, setSourceWarehouseFilter] = useState('ALL');
  const [destinationWarehouseFilter, setDestinationWarehouseFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'FLAT' | 'VALUED'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [localSearch, setLocalSearch] = useState('');
  const [localSourceWarehouse, setLocalSourceWarehouse] = useState('ALL');
  const [localDestinationWarehouse, setLocalDestinationWarehouse] = useState('ALL');
  const [localMode, setLocalMode] = useState<'ALL' | 'FLAT' | 'VALUED'>('ALL');
  const [localDateFrom, setLocalDateFrom] = useState('');
  const [localDateTo, setLocalDateTo] = useState('');

  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<TransferMode>('FLAT');
  const [lines, setLines] = useState<TLine[]>([emptyLine()]);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<null | {
    kind: 'delete-draft' | 'complete' | 'undo';
    transfer: StockTransferDTO;
  }>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [guardCheckingId, setGuardCheckingId] = useState<string | null>(null);
  const [completeGuard, setCompleteGuard] = useState<null | {
    transfer: StockTransferDTO;
    shortfalls: Array<{ itemId: string; onHand: number; qty: number }>;
  }>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [transferMovements, setTransferMovements] = useState<Record<string, StockMovementDTO[]>>({});

  const warehouseLabel = useMemo(
    () => warehouses.reduce<Record<string, string>>((acc, w) => { acc[w.id] = `${w.code} - ${w.name}`; return acc; }, {}),
    [warehouses]
  );
  const itemLabel = useMemo(
    () => items.reduce<Record<string, string>>((acc, it) => { acc[it.id] = it.code ? `${it.code} - ${it.name}` : it.name; return acc; }, {}),
    [items]
  );
  const userById = useMemo(
    () =>
      users.reduce<Record<string, { name: string; email: string }>>((acc, u) => {
        acc[u.userId] = {
          name: `${u.firstName} ${u.lastName}`.trim() || u.email,
          email: u.email,
        };
        return acc;
      }, {}),
    [users]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [transferRes, warehouseRes, usersRes] = await Promise.all([
        inventoryApi.listTransfers(undefined),
        inventoryApi.listWarehouses({ active: true, limit: 500 }),
        listUsers().catch(() => []),
      ]);
      setTransfers(unwrap<StockTransferDTO[]>(transferRes) || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehouseRes) || []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
    } catch (err: any) {
      console.error('Failed to load stock transfers', err);
      setError(err?.message || t('inventory.transfers.loadError', 'Failed to load stock transfers'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [itemRes, settings] = await Promise.all([
          inventoryApi.listItems({ trackInventory: true, active: true, limit: 1000 }),
          inventoryApi.getSettings(),
        ]);
        setItems(unwrap<InventoryItemDTO[]>(itemRes) || []);
        if (settings) setAllowNegativeStock(settings.allowNegativeStock !== false);
      } catch (error) {
        console.error('Failed to load inventory items/settings', error);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, []);

  const fetchLevel = async (itemId: string, whId: string): Promise<StockLevelDTO | null> => {
    if (!itemId || !whId) return null;
    try {
      const res = await inventoryApi.getStockLevels({ itemId, warehouseId: whId, limit: 1 });
      return (unwrap<StockLevelDTO[]>(res) || [])[0] || null;
    } catch {
      return null;
    }
  };

  const setLine = (index: number, patch: Partial<TLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const prefillSourceCost = async (index: number, itemId: string, whId: string) => {
    const level = await fetchLevel(itemId, whId);
    const base = level?.avgCostBase ?? 0;
    const ccy = level?.avgCostCCY ?? 0;
    setLine(index, { sourceOnHand: level?.qtyOnHand ?? 0, sourceCostBase: base, sourceCostCCY: ccy, landedCostBase: base, landedCostCCY: ccy });
  };

  const onSourceWarehouseChange = async (whId: string) => {
    setSourceWarehouseId(whId);
    if (!whId) return;
    const updated = await Promise.all(
      lines.map(async (l) => {
        if (!l.itemId) return l;
        const level = await fetchLevel(l.itemId, whId);
        const base = level?.avgCostBase ?? 0;
        const ccy = level?.avgCostCCY ?? 0;
        return { ...l, sourceOnHand: level?.qtyOnHand ?? 0, sourceCostBase: base, sourceCostCCY: ccy, landedCostBase: base, landedCostCCY: ccy };
      })
    );
    setLines(updated);
  };

  const resetForm = () => {
    setEditingTransferId(null);
    setSourceWarehouseId('');
    setDestinationWarehouseId('');
    setDate(todayIso());
    setNotes('');
    setMode('FLAT');
    setLines([emptyLine()]);
  };

  const openNewForm = () => {
    resetForm();
    setView('form');
  };

  const loadTransferForEdit = (transfer: StockTransferDTO) => {
    if (transfer.status !== 'DRAFT') {
      toast.error(t('inventory.transfers.onlyDraftEdit', 'Only draft transfers can be edited.'));
      return;
    }
    setEditingTransferId(transfer.id);
    setSourceWarehouseId(transfer.sourceWarehouseId);
    setDestinationWarehouseId(transfer.destinationWarehouseId);
    setDate(transfer.date);
    setNotes(transfer.notes || '');
    setMode(transfer.mode || 'FLAT');
    setLines(transfer.lines.map((line) => ({
      _key: newKey(),
      itemId: line.itemId,
      itemCode: undefined,
      itemName: itemLabel[line.itemId],
      qty: line.qty,
      sourceOnHand: 0,
      sourceCostBase: line.unitCostBaseAtTransfer,
      sourceCostCCY: line.unitCostCCYAtTransfer,
      landedCostBase: line.revaluationUnitCostBaseAtTransfer ?? line.unitCostBaseAtTransfer,
      landedCostCCY: line.revaluationUnitCostCCYAtTransfer ?? line.unitCostCCYAtTransfer,
      notes: line.notes || '',
    })));
    setView('form');
    // Refresh source on-hand for the loaded lines.
    void (async () => {
      if (!transfer.sourceWarehouseId) return;
      const refreshed = await Promise.all(
        transfer.lines.map(async (line) => {
          const level = await fetchLevel(line.itemId, transfer.sourceWarehouseId);
          return { itemId: line.itemId, onHand: level?.qtyOnHand ?? 0 };
        })
      );
      setLines((prev) => prev.map((l) => {
        const hit = refreshed.find((r) => r.itemId === l.itemId);
        return hit ? { ...l, sourceOnHand: hit.onHand } : l;
      }));
    })();
  };

  const overIssueLines = useMemo(
    () => (allowNegativeStock ? [] : lines.filter((l) => l.itemId && Number(l.qty) > Number(l.sourceOnHand))),
    [lines, allowNegativeStock]
  );

  const handleSaveTransfer = async () => {
    const filled = lines.filter((l) => l.itemId && l.qty > 0);
    if (!sourceWarehouseId || !destinationWarehouseId) {
      toast.error(t('inventory.transfers.warehousesRequired', 'Source and destination warehouses are required.'));
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      toast.error(t('inventory.transfers.warehousesDifferent', 'Source and destination must be different.'));
      return;
    }
    if (filled.length === 0) {
      toast.error(t('inventory.transfers.addLine', 'Add at least one item line.'));
      return;
    }
    try {
      setSaving(true);
      const payload = {
        sourceWarehouseId,
        destinationWarehouseId,
        date,
        notes: notes || undefined,
        mode,
        lines: filled.map((l) =>
          mode === 'VALUED'
            ? {
                itemId: l.itemId,
                qty: Number(l.qty),
                revaluationUnitCostBaseAtTransfer: Number(l.landedCostBase),
                revaluationUnitCostCCYAtTransfer: Number(l.landedCostCCY),
                notes: l.notes || undefined,
              }
            : { itemId: l.itemId, qty: Number(l.qty), notes: l.notes || undefined }
        ),
      };
      if (editingTransferId) {
        await inventoryApi.updateTransfer(editingTransferId, payload);
        toast.success(t('inventory.transfers.draftUpdated', 'Draft transfer updated.'));
      } else {
        await inventoryApi.createTransfer(payload);
        toast.success(t('inventory.transfers.created', 'Stock transfer created.'));
      }
      resetForm();
      setView('list');
      await load();
    } catch (error) {
      console.error('Failed to save stock transfer', error);
      errorHandler.showOperationError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTransfer = async (id: string) => {
    try {
      await inventoryApi.completeTransfer(id);
      toast.success(t('inventory.transfers.completed', 'Stock transfer completed.'));
      await load();
    } catch (error) {
      console.error('Failed to complete stock transfer', error);
      errorHandler.showOperationError(error);
    }
  };

  const handleCancelTransfer = async (id: string) => {
    try {
      await inventoryApi.cancelTransfer(id);
      toast.success(t('inventory.transfers.draftDeleted', 'Draft transfer deleted.'));
      await load();
    } catch (error) {
      console.error('Failed to cancel stock transfer', error);
      errorHandler.showOperationError(error);
    }
  };

  const handleUndoTransfer = async (id: string) => {
    try {
      await inventoryApi.undoTransfer(id, todayIso());
      toast.success(t('inventory.transfers.undone', 'Stock transfer undone with a linked reverse transfer.'));
      await load();
    } catch (error) {
      console.error('Failed to undo stock transfer', error);
      errorHandler.showOperationError(error);
    }
  };

  // Pre-flight guard: a Complete that would drive the source warehouse below zero is
  // stopped BEFORE posting (when negative stock is off), with a way forward.
  const requestCompleteTransfer = async (transfer: StockTransferDTO) => {
    if (allowNegativeStock) {
      setPendingAction({ kind: 'complete', transfer });
      return;
    }
    setGuardCheckingId(transfer.id);
    try {
      const checks = await Promise.all(
        transfer.lines.map(async (line) => {
          const level = await fetchLevel(line.itemId, transfer.sourceWarehouseId);
          return { itemId: line.itemId, onHand: level?.qtyOnHand ?? 0, qty: line.qty };
        })
      );
      const shortfalls = checks.filter((c) => Number(c.qty) > Number(c.onHand));
      if (shortfalls.length > 0) {
        setCompleteGuard({ transfer, shortfalls });
      } else {
        setPendingAction({ kind: 'complete', transfer });
      }
    } catch {
      // If the pre-check fails, fall through to the normal confirm — the backend still guards.
      setPendingAction({ kind: 'complete', transfer });
    } finally {
      setGuardCheckingId(null);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    try {
      setActionBusy(true);
      if (pendingAction.kind === 'delete-draft') {
        await handleCancelTransfer(pendingAction.transfer.id);
      } else if (pendingAction.kind === 'complete') {
        await handleCompleteTransfer(pendingAction.transfer.id);
      } else {
        await handleUndoTransfer(pendingAction.transfer.id);
      }
      setPendingAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleExpandedChange = async (newIds: Set<string>) => {
    setExpandedIds(newIds);
    for (const id of newIds) {
      if (!transferMovements[id]) {
        try {
          const movementRes = await inventoryApi.getMovements({ referenceType: 'STOCK_TRANSFER', referenceId: id, limit: 200 });
          setTransferMovements((prev) => ({ ...prev, [id]: unwrap<StockMovementDTO[]>(movementRes) || [] }));
        } catch (error) {
          console.error('Failed to load transfer movements', error);
        }
      }
    }
  };

  const columns: ColumnDef<TLine>[] = [
    {
      id: 'item',
      label: t('inventory.transfers.col.item', 'Item'),
      kind: 'custom',
      width: '280px',
      render: (line, index) => (
        <ItemSelector
          value={line.itemId}
          noBorder
          placeholder={t('inventory.transfers.selectItem', 'Select item')}
          trackInventoryOnly
          disabled={saving}
          onChange={(item) => {
            if (!item) {
              setLine(index, { itemId: '', itemCode: undefined, itemName: undefined, sourceOnHand: 0, sourceCostBase: 0, sourceCostCCY: 0, landedCostBase: 0, landedCostCCY: 0 });
              return;
            }
            setLine(index, { itemId: item.id, itemCode: item.code, itemName: item.name });
            prefillSourceCost(index, item.id, sourceWarehouseId);
          }}
        />
      ),
    } as ColumnDef<TLine>,
    { id: 'qty', label: t('inventory.transfers.col.qty', 'Qty'), kind: 'number', width: '100px', accessor: (l) => l.qty, setter: (v) => ({ qty: Number(v) }) },
    { id: 'available', label: t('inventory.transfers.col.available', 'Available'), kind: 'computed', width: '100px', compute: (l: TLine) => l.sourceOnHand } as ColumnDef<TLine>,
    ...(mode === 'VALUED'
      ? [
          { id: 'sourceCost', label: t('inventory.transfers.col.sourceCost', 'Source Cost'), kind: 'computed', width: '110px', compute: (l: TLine) => l.sourceCostBase } as ColumnDef<TLine>,
          {
            id: 'landedCost',
            label: t('inventory.transfers.col.revalCost', 'Revaluation Unit Cost'),
            kind: 'custom',
            width: '150px',
            align: 'right',
            render: (line, index) => (
              <input
                type="number"
                min={0}
                step="any"
                disabled={saving}
                className="w-full bg-transparent text-right text-xs outline-none"
                value={line.landedCostBase || ''}
                placeholder="0.00"
                onChange={(e) => {
                  const base = Number(e.target.value) || 0;
                  const ratio = line.landedCostBase > 0 && line.landedCostCCY > 0 ? line.landedCostCCY / line.landedCostBase : 1;
                  setLine(index, { landedCostBase: base, landedCostCCY: base * ratio });
                }}
              />
            ),
          } as ColumnDef<TLine>,
          { id: 'variance', label: t('inventory.transfers.col.variance', 'Variance'), kind: 'computed', width: '110px', compute: (l: TLine) => (Number(l.landedCostBase) - Number(l.sourceCostBase)) * Number(l.qty) } as ColumnDef<TLine>,
        ]
      : []),
    {
      id: 'notes',
      label: t('inventory.transfers.col.notes', 'Notes'),
      kind: 'custom',
      width: '200px',
      render: (line, index) => (
        <input
          type="text"
          disabled={saving}
          className="w-full bg-transparent text-xs outline-none"
          value={line.notes || ''}
          placeholder={t('common.optional', 'Optional')}
          onChange={(e) => setLine(index, { notes: e.target.value })}
        />
      ),
    } as ColumnDef<TLine>,
  ];

  const totalQty = useMemo(() => lines.reduce((s, l) => s + (l.itemId ? Number(l.qty) || 0 : 0), 0), [lines]);
  const totalVariance = useMemo(
    () => lines.reduce((s, l) => s + (l.itemId ? (Number(l.landedCostBase) - Number(l.sourceCostBase)) * Number(l.qty) : 0), 0),
    [lines]
  );
  const filledLineCount = useMemo(() => lines.filter((l) => l.itemId && Number(l.qty) > 0).length, [lines]);

  // ───────────────────────── FORM VIEW (scaffold) ─────────────────────────
  const formView = (() => {
    if (view !== 'form') return null;

    const headerSection = (
      <DocumentHeaderGrid>
        <DocumentHeaderField label={t('inventory.transfers.sourceWarehouse', 'Source Warehouse')}>
          <WarehouseSelector
            className={documentHeaderSelectorClass}
            value={sourceWarehouseId}
            onChange={(wh) => onSourceWarehouseChange(wh?.id || '')}
            placeholder={t('inventory.transfers.source', 'Source')}
          />
        </DocumentHeaderField>
        <DocumentHeaderField label={t('inventory.transfers.destinationWarehouse', 'Destination Warehouse')}>
          <WarehouseSelector
            className={documentHeaderSelectorClass}
            value={destinationWarehouseId}
            onChange={(wh) => setDestinationWarehouseId(wh?.id || '')}
            placeholder={t('inventory.transfers.destination', 'Destination')}
          />
        </DocumentHeaderField>
        <DocumentHeaderField label={t('inventory.transfers.date', 'Date')}>
          <DatePicker
            className="w-full"
            inputClassName={documentHeaderControlClass}
            value={date}
            onChange={setDate}
          />
        </DocumentHeaderField>
        <DocumentHeaderField label={t('inventory.transfers.notes', 'Notes')}>
          <input
            className={documentHeaderControlClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('common.optional', 'Optional')}
          />
        </DocumentHeaderField>
      </DocumentHeaderGrid>
    );

    const controlSection = (
      <DocumentControlPanel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DocumentSegmentedGroup>
            {[
              { mode: 'FLAT' as const, label: t('inventory.transfers.flat', 'Flat'), icon: ArrowLeftRight },
              { mode: 'VALUED' as const, label: t('inventory.transfers.valued', 'Valued'), icon: Coins },
            ].map((option) => (
              <DocumentSegmentButton
                key={option.mode}
                active={mode === option.mode}
                disabled={saving}
                icon={option.icon}
                label={option.label}
                onClick={() => setMode(option.mode)}
              />
            ))}
          </DocumentSegmentedGroup>
        </div>
      </DocumentControlPanel>
    );

    const linesSection = (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-tight text-slate-400">
          {mode === 'FLAT'
            ? t('inventory.transfers.flatHint', 'Flat: move stock A→B at source cost. No ledger effect.')
            : t('inventory.transfers.valuedHint', 'Valued: explicit revaluation. The variance posts to the Inventory Revaluation account.')}
        </p>
        {overIssueLines.length > 0 && (
          <DocumentNoticeBanner tone="amber">
            {t('inventory.transfers.overIssueHint', 'Some lines move more than is available in the source warehouse. Negative stock is off, so this can be saved as a draft but not completed until you reduce the quantity or receive stock.')}
          </DocumentNoticeBanner>
        )}
        <ClassicLineItemsTable<TLine>
          tableId="inventory.transfer.lines"
          title={t('inventory.transfers.lines', 'Transfer Lines')}
          columns={columns}
          rows={lines}
          disabled={saving}
          onRowChange={setLine}
          onRowRemove={(i) => setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
          onRowsChange={setLines}
          createEmptyRow={emptyLine}
          getRowKey={(l) => l._key}
          isRowFilled={(l) => Boolean(l.itemId)}
          onRowAdd={() => setLines((prev) => [...prev, emptyLine()])}
          addLabel={t('inventory.transfers.addItem', 'Add Item')}
          minTableWidth={mode === 'VALUED' ? '900px' : '600px'}
        />
      </div>
    );

    const railReady: Array<{ state: 'ok' | 'warn' | 'info'; label: React.ReactNode }> = [
      { state: sourceWarehouseId && destinationWarehouseId ? 'ok' : 'info', label: t('inventory.transfers.readyWarehouses', 'Source & destination set') },
      { state: sourceWarehouseId && destinationWarehouseId && sourceWarehouseId !== destinationWarehouseId ? 'ok' : 'info', label: t('inventory.transfers.readyDifferent', 'Warehouses are different') },
      { state: filledLineCount > 0 ? 'ok' : 'info', label: t('inventory.transfers.readyLines', 'At least one item line') },
      { state: overIssueLines.length > 0 ? 'warn' : 'ok', label: overIssueLines.length > 0 ? t('inventory.transfers.readyAvailWarn', 'Some lines exceed available stock') : t('inventory.transfers.readyAvailOk', 'All lines within available stock') },
    ];

    return (
      <>
        <DocumentDetailScaffold
          title={editingTransferId ? t('inventory.transfers.editTitle', 'Edit Stock Transfer') : t('inventory.transfers.newTitle', 'New Stock Transfer')}
          subtitle={t('inventory.transfers.subtitle', 'Move stock between warehouses')}
          icon={ArrowLeftRight}
          backLabel={t('actions.back', 'Back')}
          onBack={() => { resetForm(); setView('list'); }}
          badges={<DocumentPill tone={mode === 'VALUED' ? 'violet' : 'slate'}>{mode}</DocumentPill>}
          forceRailDrawer={isWindowsMode}
          sections={{
            control: { content: controlSection },
            header: { title: t('inventory.transfers.details', 'Transfer Details'), cardClassName: 'overflow-visible', content: headerSection },
            lines: { content: linesSection },
          }}
          railSections={{
            info: {
              title: t('inventory.transfers.route', 'Route'),
              content: (
                <DocumentRailKeyValueList
                  items={[
                    { label: t('inventory.transfers.source', 'Source'), value: warehouseLabel[sourceWarehouseId] || '—' },
                    { label: t('inventory.transfers.destination', 'Destination'), value: warehouseLabel[destinationWarehouseId] || '—' },
                    { label: t('inventory.transfers.mode', 'Mode'), value: mode },
                  ]}
                />
              ),
            },
            readiness: { title: t('inventory.transfers.readiness', 'Readiness'), content: <DocumentRailChecklist items={railReady} /> },
            totals: {
              title: t('inventory.transfers.totals', 'Totals'),
              content: (
                <DocumentRailTotals
                  rows={[
                    { label: t('inventory.transfers.linesCount', 'Lines'), value: String(filledLineCount) },
                    ...(mode === 'VALUED' ? [{ label: t('inventory.transfers.variance', 'Variance'), value: totalVariance.toFixed(2) }] : []),
                  ]}
                  grand={{ label: t('inventory.transfers.totalQty', 'Total Qty'), value: String(totalQty) }}
                />
              ),
            },
          }}
          footerActions={
            <>
              <button
                className="rounded border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => { resetForm(); setView('list'); }}
                disabled={saving}
                type="button"
              >
                {t('actions.cancel', 'Cancel')}
              </button>
              <button
                className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
                onClick={handleSaveTransfer}
                disabled={saving}
              >
                {saving ? t('common.saving', 'Saving…') : editingTransferId ? t('inventory.transfers.saveDraft', 'Save Draft') : t('inventory.transfers.create', 'Create Transfer')}
              </button>
            </>
          }
        />
        {/* Pre-flight guard reused in form view if the user lands here via Back. */}
        {renderGuards()}
      </>
    );
  })();

  function renderGuards() {
    return (
      <>
        <ConfirmDialog
          isOpen={!!pendingAction}
          title={
            pendingAction?.kind === 'delete-draft'
              ? t('inventory.transfers.deleteTitle', 'Delete draft transfer?')
              : pendingAction?.kind === 'complete'
                ? t('inventory.transfers.completeTitle', 'Complete transfer?')
                : t('inventory.transfers.undoTitle', 'Undo completed transfer?')
          }
          message={
            pendingAction?.kind === 'delete-draft'
              ? t('inventory.transfers.deleteMsg', 'This removes the draft only. No stock or ledger entries are affected.')
              : pendingAction?.kind === 'complete'
                ? (pendingAction.transfer.mode === 'VALUED'
                    ? t('inventory.transfers.completeMsgValued', 'This posts the paired stock movements and the valued-transfer revaluation entry.')
                    : t('inventory.transfers.completeMsgFlat', 'This posts the paired stock movements. No accounting entry is created (flat transfer).'))
                : t('inventory.transfers.undoMsg', 'This creates and posts a linked reverse transfer. The original remains in history for audit.')
          }
          confirmLabel={
            pendingAction?.kind === 'delete-draft'
              ? t('inventory.transfers.deleteConfirm', 'Delete Draft')
              : pendingAction?.kind === 'complete'
                ? t('inventory.transfers.completeConfirm', 'Complete')
                : t('inventory.transfers.undoConfirm', 'Undo Transfer')
          }
          cancelLabel={t('actions.keep', 'Keep')}
          tone={pendingAction?.kind === 'delete-draft' ? 'danger' : pendingAction?.kind === 'undo' ? 'warning' : 'info'}
          isConfirming={actionBusy}
          onConfirm={confirmPendingAction}
          onCancel={() => !actionBusy && setPendingAction(null)}
        />

        <ConfirmDialog
          isOpen={!!completeGuard}
          title={t('inventory.transfers.guardTitle', 'Can’t complete — stock would go below zero')}
          message={
            t('inventory.transfers.guardMsg', 'This transfer moves more than is available in the source warehouse:') +
            ' ' +
            (completeGuard?.shortfalls
              .map((s) => `${itemLabel[s.itemId] || s.itemId} (${t('inventory.transfers.guardHave', 'have')} ${s.onHand}, ${t('inventory.transfers.guardMoving', 'moving')} ${s.qty})`)
              .join('; ') || '') +
            '. ' +
            t('inventory.transfers.guardTail', 'Negative stock is off. Edit the quantity, or keep it as a draft.')
          }
          confirmLabel={t('inventory.transfers.guardEdit', 'Edit Quantity')}
          cancelLabel={t('inventory.transfers.guardKeep', 'Keep as Draft')}
          tone="warning"
          onConfirm={() => {
            const tr = completeGuard?.transfer;
            setCompleteGuard(null);
            if (tr) loadTransferForEdit(tr);
          }}
          onCancel={() => setCompleteGuard(null)}
        />
      </>
    );
  }

  // ───────────────────────── LIST VIEW ─────────────────────────
  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    sourceWarehouseFilter !== 'ALL' ||
    destinationWarehouseFilter !== 'ALL' ||
    modeFilter !== 'ALL' ||
    searchFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const handleApply = () => {
    setSearchFilter(localSearch);
    setSourceWarehouseFilter(localSourceWarehouse);
    setDestinationWarehouseFilter(localDestinationWarehouse);
    setModeFilter(localMode);
    setDateFrom(localDateFrom);
    setDateTo(localDateTo);
    setPage(1);
  };

  const handleClear = () => {
    setLocalSearch('');
    setLocalSourceWarehouse('ALL');
    setLocalDestinationWarehouse('ALL');
    setLocalMode('ALL');
    setLocalDateFrom('');
    setLocalDateTo('');

    setSearchFilter('');
    setSourceWarehouseFilter('ALL');
    setDestinationWarehouseFilter('ALL');
    setModeFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('ALL');
    setPage(1);
  };

  const statusCounts = useMemo(() => {
    const counts = { DRAFT: 0, IN_TRANSIT: 0, COMPLETED: 0 };
    transfers.forEach((tr) => {
      if (sourceWarehouseFilter !== 'ALL' && tr.sourceWarehouseId !== sourceWarehouseFilter) {
        return;
      }
      if (destinationWarehouseFilter !== 'ALL' && tr.destinationWarehouseId !== destinationWarehouseFilter) {
        return;
      }
      if (modeFilter !== 'ALL' && tr.mode !== modeFilter) {
        return;
      }
      if (dateFrom && tr.date < dateFrom) {
        return;
      }
      if (dateTo && tr.date > dateTo) {
        return;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const idMatch = tr.id.toLowerCase().includes(query);
        const notesMatch = (tr.notes || '').toLowerCase().includes(query);
        const srcWhMatch = (warehouseLabel[tr.sourceWarehouseId] || tr.sourceWarehouseId).toLowerCase().includes(query);
        const destWhMatch = (warehouseLabel[tr.destinationWarehouseId] || tr.destinationWarehouseId).toLowerCase().includes(query);
        
        let itemMatch = false;
        if (tr.lines) {
          itemMatch = tr.lines.some((l) => {
            const itName = (itemLabel[l.itemId] || l.itemId).toLowerCase();
            return itName.includes(query);
          });
        }

        if (!idMatch && !notesMatch && !srcWhMatch && !destWhMatch && !itemMatch) {
          return;
        }
      }

      if (tr.status in counts) {
        counts[tr.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [transfers, sourceWarehouseFilter, destinationWarehouseFilter, modeFilter, dateFrom, dateTo, searchFilter, warehouseLabel, itemLabel]);

  const statusFilterConfig = useMemo(() => ({
    options: [
      { value: 'DRAFT', label: t('inventory.transfers.status.DRAFT', 'Draft'), color: 'slate' },
      { value: 'COMPLETED', label: t('inventory.transfers.status.COMPLETED', 'Completed'), color: 'emerald' },
    ],
    activeValue: statusFilter,
    onChange: (val: string) => {
      const targetStatus = val as 'ALL' | 'DRAFT' | 'COMPLETED';
      setStatusFilter(targetStatus);
      setPage(1);
    },
    counts: statusCounts,
  }), [statusFilter, statusCounts, t]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((tr) => {
      if (statusFilter !== 'ALL' && tr.status !== statusFilter) {
        return false;
      }
      if (sourceWarehouseFilter !== 'ALL' && tr.sourceWarehouseId !== sourceWarehouseFilter) {
        return false;
      }
      if (destinationWarehouseFilter !== 'ALL' && tr.destinationWarehouseId !== destinationWarehouseFilter) {
        return false;
      }
      if (modeFilter !== 'ALL' && tr.mode !== modeFilter) {
        return false;
      }
      if (dateFrom && tr.date < dateFrom) {
        return false;
      }
      if (dateTo && tr.date > dateTo) {
        return false;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const idMatch = tr.id.toLowerCase().includes(query);
        const notesMatch = (tr.notes || '').toLowerCase().includes(query);
        const srcWhMatch = (warehouseLabel[tr.sourceWarehouseId] || tr.sourceWarehouseId).toLowerCase().includes(query);
        const destWhMatch = (warehouseLabel[tr.destinationWarehouseId] || tr.destinationWarehouseId).toLowerCase().includes(query);
        
        let itemMatch = false;
        if (tr.lines) {
          itemMatch = tr.lines.some((l) => {
            const itName = (itemLabel[l.itemId] || l.itemId).toLowerCase();
            return itName.includes(query);
          });
        }

        if (!idMatch && !notesMatch && !srcWhMatch && !destWhMatch && !itemMatch) {
          return false;
        }
      }
      return true;
    });
  }, [transfers, statusFilter, sourceWarehouseFilter, destinationWarehouseFilter, modeFilter, dateFrom, dateTo, searchFilter, warehouseLabel, itemLabel]);

  const sortedData = useMemo(() => {
    let sorted = [...filteredTransfers];
    if (sortField && sortDirection) {
      sorted.sort((a, b) => {
        let aVal = (a as any)[sortField];
        let bVal = (b as any)[sortField];

        if (sortField === 'sourceWarehouseId') {
          aVal = warehouseLabel[a.sourceWarehouseId] || a.sourceWarehouseId;
          bVal = warehouseLabel[b.sourceWarehouseId] || b.sourceWarehouseId;
        } else if (sortField === 'destinationWarehouseId') {
          aVal = warehouseLabel[a.destinationWarehouseId] || a.destinationWarehouseId;
          bVal = warehouseLabel[b.destinationWarehouseId] || b.destinationWarehouseId;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      sorted.sort((a, b) => {
        const dateA = a.date || a.createdAt || '';
        const dateB = b.date || b.createdAt || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return b.id.localeCompare(a.id);
      });
    }
    return sorted;
  }, [filteredTransfers, sortField, sortDirection, warehouseLabel]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    return sortedData.slice((page - 1) * pageSize, page * pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection(null);
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const listColumns = useMemo<ColumnDefinition<StockTransferDTO>[]>(
    () => [
      {
        key: 'id',
        label: t('inventory.transfers.col.id', 'Transfer ID'),
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'id',
        align: 'center',
        render: (val: string) => (
          <span className="font-mono font-bold text-slate-805 dark:text-slate-200">
            {val.slice(0, 8).toUpperCase()}
          </span>
        ),
      },
      {
        key: 'date',
        label: t('inventory.transfers.col.date', 'Date'),
        width: '180px',
        priority: 1,
        sortable: true,
        accessor: 'date',
        align: 'center',
        render: (_val: string, row: StockTransferDTO) => (
          <div className="flex flex-col items-center text-center">
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCompanyDate(row.date, companySettings)}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.createdAt ? formatCompanyTime(row.createdAt, companySettings) : ''}
            </span>
          </div>
        ),
      },
      {
        key: 'sourceWarehouseId',
        label: t('inventory.transfers.col.source', 'Source'),
        width: '200px',
        priority: 1,
        sortable: true,
        accessor: 'sourceWarehouseId',
        align: 'center',
        render: (val: string) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {warehouseLabel[val] || val}
          </span>
        ),
      },
      {
        key: 'destinationWarehouseId',
        label: t('inventory.transfers.col.destination', 'Destination'),
        width: '200px',
        priority: 1,
        sortable: true,
        accessor: 'destinationWarehouseId',
        align: 'center',
        render: (val: string) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {warehouseLabel[val] || val}
          </span>
        ),
      },
      {
        key: 'mode',
        label: t('inventory.transfers.col.mode', 'Mode'),
        width: '110px',
        priority: 1,
        sortable: true,
        accessor: 'mode',
        align: 'center',
        render: (val: string) => (
          <span
            className={clsx(
              'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
              val === 'VALUED'
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/30 dark:bg-indigo-950/20 dark:text-indigo-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
            )}
          >
            {val || 'FLAT'}
          </span>
        ),
      },
      {
        key: 'status',
        label: t('inventory.transfers.col.status', 'Status'),
        width: '130px',
        priority: 1,
        sortable: true,
        accessor: 'status',
        align: 'center',
        render: (val: string) => {
          let colorClass = 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
          if (val === 'COMPLETED') {
            colorClass = 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-500/20';
          } else if (val === 'IN_TRANSIT') {
            colorClass = 'bg-amber-50 text-amber-800 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-500/20';
          }
          return (
            <span
              className={clsx(
                'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                colorClass
              )}
            >
              {val}
            </span>
          );
        },
      },
      {
        key: 'voucherId',
        label: t('inventory.transfers.col.gl', 'GL'),
        width: '100px',
        priority: 1,
        sortable: true,
        accessor: 'voucherId',
        align: 'center',
        render: (val: string) => {
          if (!val) return <span className="text-slate-400 dark:text-slate-600">—</span>;
          return (
            <span className="inline-flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400">
              ✓
            </span>
          );
        },
      },
      {
        key: 'createdBy',
        label: t('inventory.transfers.col.createdBy', 'Created By'),
        width: '180px',
        priority: 2,
        accessor: 'createdBy',
        align: 'center',
        render: (val: string) => {
          const u = userById[val];
          if (!u) return <span className="text-xs text-slate-400 font-mono">{val}</span>;
          return (
            <div className="flex flex-col items-center text-center">
              <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{u.email}</span>
            </div>
          );
        },
      },
    ],
    [warehouseLabel, companySettings, userById, t]
  );

  const rowActions = useMemo<RowAction<StockTransferDTO>[]>(
    () => [
      {
        key: 'details',
        label: t('inventory.transfers.details', 'Details'),
        icon: Eye,
        onClick: (row) => {
          const next = new Set(expandedIds);
          if (next.has(row.id)) {
            next.delete(row.id);
          } else {
            next.add(row.id);
          }
          handleExpandedChange(next);
        },
        primary: false,
      },
      {
        key: 'edit',
        label: t('actions.edit', 'Edit'),
        icon: Edit,
        isEnabled: (row) => row.status === 'DRAFT',
        onClick: (row) => loadTransferForEdit(row),
        primary: false,
      },
      {
        key: 'complete',
        label: t('inventory.transfers.completeConfirm', 'Complete'),
        icon: Check,
        isEnabled: (row) => row.status === 'DRAFT',
        onClick: (row) => requestCompleteTransfer(row),
        primary: false,
      },
      {
        key: 'delete',
        label: t('actions.delete', 'Delete'),
        icon: Trash2,
        variant: 'danger',
        isEnabled: (row) => row.status === 'DRAFT',
        onClick: (row) => setPendingAction({ kind: 'delete-draft', transfer: row }),
        primary: false,
      },
      {
        key: 'undo',
        label: t('inventory.transfers.undo', 'Undo'),
        icon: RotateCcw,
        variant: 'warning',
        isEnabled: (row) => row.status === 'COMPLETED' && !row.reversedByTransferId && !row.reversesTransferId,
        onClick: (row) => setPendingAction({ kind: 'undo', transfer: row }),
        primary: false,
      },
    ],
    [expandedIds, t]
  );

  const renderExpandedContent = (transfer: StockTransferDTO) => {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 m-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transfer Lines */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('inventory.transfers.lines', 'Transfer Lines')}
            </h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="min-w-full text-xs text-slate-700 dark:text-slate-300">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-3 py-2 text-left font-semibold">{t('inventory.transfers.col.item', 'Item')}</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">{t('inventory.transfers.col.qty', 'Qty')}</th>
                    <th className="px-3 py-2 text-right font-semibold w-36">{t('inventory.transfers.col.landedCost', 'Landed Unit Cost')}</th>
                    <th className="px-3 py-2 text-left font-semibold pl-4">{t('inventory.transfers.col.notes', 'Notes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transfer.lines.map((line, index) => (
                    <tr key={`${transfer.id}_line_${index}`}>
                      <td className="px-3 py-2 font-medium">{itemLabel[line.itemId] || line.itemId}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{line.qty}</td>
                      <td className="px-3 py-2 text-right font-mono">{line.unitCostBaseAtTransfer.toFixed(2)}</td>
                      <td className="px-3 py-2 text-left pl-4">{line.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paired Movements */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('inventory.transfers.pairedMovements', 'Paired Movements')}
            </h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="min-w-full text-xs text-slate-700 dark:text-slate-300">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-3 py-2 text-left font-semibold">{t('inventory.transfers.col.type', 'Type')}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t('inventory.transfers.col.warehouse', 'Warehouse')}</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">{t('inventory.transfers.col.qty', 'Qty')}</th>
                    <th className="px-3 py-2 text-right font-semibold w-32">{t('inventory.transfers.col.unitCostBase', 'Unit Cost Base')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(transferMovements[transfer.id] || []).map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-3 py-2 font-medium capitalize">{movement.movementType}</td>
                      <td className="px-3 py-2">{warehouseLabel[movement.warehouseId] || movement.warehouseId}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{movement.qty}</td>
                      <td className="px-3 py-2 text-right font-mono">{movement.unitCostBase.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(transferMovements[transfer.id] || []).length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-400 dark:text-slate-500" colSpan={4}>
                        {t('inventory.transfers.noMovements', 'No movements found yet.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (formView) {
    return formView;
  }

  return (
    <>
      <OperationalListLayout<StockTransferDTO>
        title={t('inventory.transfers.title', 'Stock Transfers')}
        subtitle=""
        compactHeader
        statusFilterConfig={statusFilterConfig}
        newButtonLabel={t('inventory.transfers.newButton', 'New Transfer')}
        onNewClick={openNewForm}
        onRefresh={load}
        loading={loading}
        error={error}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClear}
        filters={
          <div className="flex flex-row items-center gap-2.5 w-full overflow-x-auto whitespace-nowrap pb-1.5 lg:pb-0 scrollbar-thin">
            {/* SEARCH */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('inventory.transfers.searchPlaceholder', 'Search by notes, warehouses, items...')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            {/* SOURCE WAREHOUSE */}
            <div className="w-52 flex-shrink-0">
              <WarehouseSelector
                value={localSourceWarehouse === 'ALL' ? '' : localSourceWarehouse}
                onChange={(wh) => setLocalSourceWarehouse(wh ? wh.id : 'ALL')}
                placeholder={t('inventory.transfers.filters.allSource', 'All Source Warehouses')}
              />
            </div>

            {/* DESTINATION WAREHOUSE */}
            <div className="w-52 flex-shrink-0">
              <WarehouseSelector
                value={localDestinationWarehouse === 'ALL' ? '' : localDestinationWarehouse}
                onChange={(wh) => setLocalDestinationWarehouse(wh ? wh.id : 'ALL')}
                placeholder={t('inventory.transfers.filters.allDest', 'All Destination Warehouses')}
              />
            </div>

            {/* MODE */}
            <div className="w-32 flex-shrink-0">
              <select
                value={localMode}
                onChange={(e) => setLocalMode(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
              >
                <option value="ALL">{t('inventory.transfers.filters.allModes', 'All Modes')}</option>
                <option value="FLAT">{t('inventory.transfers.flat', 'Flat')}</option>
                <option value="VALUED">{t('inventory.transfers.valued', 'Valued')}</option>
              </select>
            </div>

            {/* DATE RANGE */}
            <div className="flex gap-2 items-center flex-shrink-0">
              <DatePicker
                className="w-32"
                value={localDateFrom}
                onChange={setLocalDateFrom}
                placeholder={t('inventory.transfers.filters.dateFrom', 'Date From')}
              />
              <span className="text-slate-400 font-medium">-</span>
              <DatePicker
                className="w-32"
                value={localDateTo}
                onChange={setLocalDateTo}
                placeholder={t('inventory.transfers.filters.dateTo', 'Date To')}
              />
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-all hover:shadow-md hover:shadow-primary-600/10 active:scale-[0.98] duration-200"
              >
                <Filter size={16} />
                <span>{t('inventory.transfers.filters.apply', 'Apply')}</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
                title={t('inventory.transfers.filters.clear', 'Clear Filters')}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        }
        columns={listColumns}
        data={paginatedData}
        emptyMessage={t('inventory.transfers.empty', 'No stock transfers found')}
        onRowClick={(row) => {
          if (row.status === 'DRAFT') {
            loadTransferForEdit(row);
          } else {
            const next = new Set(expandedIds);
            if (next.has(row.id)) {
              next.delete(row.id);
            } else {
              next.add(row.id);
            }
            handleExpandedChange(next);
          }
        }}
        sorting={{
          field: sortField,
          direction: sortDirection,
          onSort: handleSort,
        }}
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
        expandable={true}
        renderExpanded={renderExpandedContent}
        expandedIds={expandedIds}
        onExpandedChange={handleExpandedChange}
      />
      {renderGuards()}
    </>
  );
};

export default StockTransfersPage;
