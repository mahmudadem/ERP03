import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Eye, Filter, Package, RotateCcw, Search, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import {
  InventorySettingsDTO,
  InventoryWarehouseDTO,
  OpeningStockDocumentDTO,
  StockMovementDTO,
  inventoryApi,
} from '../../../api/inventoryApi';
import { accountingApi } from '../../../api/accountingApi';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Spinner } from '../../../components/ui/Spinner';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { DatePicker, ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import {
  DocumentControlPanel,
  DocumentDetailScaffold,
  DocumentHeaderField,
  DocumentHeaderGrid,
  DocumentIconButton,
  DocumentNoticeBanner,
  DocumentPill,
  DocumentRailChecklist,
  DocumentRailKeyValueList,
  DocumentRailTotals,
  DocumentSegmentButton,
  DocumentSegmentedGroup,
  documentHeaderControlClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAccounts } from '../../../context/AccountsContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { errorHandler } from '../../../services/errorHandler';

interface OpeningStockLineDraft {
  id: string;
  itemId: string;
  itemCostCurrency?: string;
  quantity: number;
  unitCostInMoveCurrency: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  unitCostBase?: number;
}

type ConfirmState =
  | { kind: 'inventory-only-post-new' }
  | { kind: 'inventory-only-post-existing'; documentId: string }
  | { kind: 'delete-draft'; documentId: string }
  | null;

const unwrap = <T,>(payload: any): T => (payload?.data?.data ?? payload?.data ?? payload) as T;
const makeId = () => `opening-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const getOpeningStockDocumentRef = (documentId: string) => `OSD-${documentId.slice(0, 8).toUpperCase()}`;
const normalizeReferenceLabel = (value: string, fallbackPrefix: string) => {
  const trimmed = value.trim();
  const prefixedUuidMatch = trimmed.match(/^([A-Za-z]+)-([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (prefixedUuidMatch) return `${prefixedUuidMatch[1].toUpperCase()}-${prefixedUuidMatch[2].toUpperCase()}`;
  const rawUuidMatch = trimmed.match(/^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (rawUuidMatch) return `${fallbackPrefix}-${rawUuidMatch[1].toUpperCase()}`;
  return trimmed;
};
const getErrorMessage = (error: any) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Failed to process Opening Stock Document.';

const OpeningStockPage: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { company } = useCompanyAccess();
  const { isModuleInitialized } = useCompanyModules();
  const { getAccountById, accounts: allAccounts } = useAccounts();
  const { uiMode } = useUserPreferences();
  const isWindowsMode = uiMode === 'windows';
  const isNewRoute = window.location.hash.includes('/inventory/opening-stock/new') || window.location.pathname.includes('/inventory/opening-stock/new');
  const isFormRoute = isNewRoute || Boolean(id);
  const accountingEnabled = isModuleInitialized('accounting');
  const baseCurrency = (company?.baseCurrency || 'USD').toUpperCase();

  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [documents, setDocuments] = useState<OpeningStockDocumentDTO[]>([]);
  const [legacyOpeningMovements, setLegacyOpeningMovements] = useState<StockMovementDTO[]>([]);
  const [inventorySettings, setInventorySettings] = useState<InventorySettingsDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [postingNew, setPostingNew] = useState(false);
  const [postingExistingId, setPostingExistingId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [voucherLabelById, setVoucherLabelById] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'POSTED'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [accountingFilter, setAccountingFilter] = useState<'ALL' | 'WITH_ACCOUNTING' | 'INVENTORY_ONLY' | 'WITH_VOUCHER' | 'NO_VOUCHER'>('ALL');
  const [valueMinFilter, setValueMinFilter] = useState('');
  const [valueMaxFilter, setValueMaxFilter] = useState('');
  const [showAccountingControlMessage, setShowAccountingControlMessage] = useState(false);
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState({
    warehouseId: '',
    date: todayIso(),
    notes: '',
    createAccountingEffect: false,
    openingBalanceAccountId: '',
  });
  const [lines, setLines] = useState<OpeningStockLineDraft[]>([{
    id: makeId(),
    itemId: '',
    quantity: 0,
    unitCostInMoveCurrency: 0,
    moveCurrency: baseCurrency,
    fxRateMovToBase: 1,
    fxRateCCYToBase: 1,
    unitCostBase: 0,
  }]);

  const selectedDocument = useMemo(
    () => (id ? documents.find((document) => document.id === id) : undefined),
    [documents, id],
  );
  const isReadOnly = selectedDocument?.status === 'POSTED';
  const defaultOpeningBalanceAccountId = inventorySettings?.defaultOpeningBalanceAccountId || '';

  const loadPageData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [warehouseResponse, documentResponse, settingsResponse, movementResponse] = await Promise.all([
        inventoryApi.listWarehouses({ active: true }),
        inventoryApi.listOpeningStockDocuments(),
        inventoryApi.getSettings(),
        inventoryApi.getMovements({ limit: 300, offset: 0 }),
      ]);
      const nextWarehouses = unwrap<InventoryWarehouseDTO[]>(warehouseResponse) || [];
      const nextDocuments = unwrap<OpeningStockDocumentDTO[]>(documentResponse) || [];
      const nextSettings = unwrap<InventorySettingsDTO | null>(settingsResponse);
      const nextMovements = unwrap<StockMovementDTO[]>(movementResponse) || [];
      setWarehouses(nextWarehouses);
      setDocuments(nextDocuments);
      setLegacyOpeningMovements(nextMovements.filter((movement) => movement.movementType === 'OPENING_STOCK'));
      setInventorySettings(nextSettings);
      setForm((prev) => ({
        ...prev,
        warehouseId: prev.warehouseId || nextSettings?.defaultWarehouseId || nextWarehouses.find((warehouse) => warehouse.isDefault)?.id || nextWarehouses[0]?.id || '',
        openingBalanceAccountId: prev.openingBalanceAccountId || nextSettings?.defaultOpeningBalanceAccountId || '',
      }));
    } catch (loadError: any) {
      console.error('Failed to load Opening Stock Documents', loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    if (!accountingEnabled) {
      setForm((prev) => ({ ...prev, createAccountingEffect: false, openingBalanceAccountId: '' }));
    }
  }, [accountingEnabled]);

  useEffect(() => {
    if (isNewRoute) return;
    if (!selectedDocument) return;
    setForm({
      warehouseId: selectedDocument.warehouseId,
      date: selectedDocument.date,
      notes: selectedDocument.notes || '',
      createAccountingEffect: selectedDocument.createAccountingEffect,
      openingBalanceAccountId: selectedDocument.openingBalanceAccountId || defaultOpeningBalanceAccountId,
    });
    setLines(selectedDocument.lines.map((line) => ({
      id: line.lineId,
      itemId: line.itemId,
      quantity: line.quantity,
      unitCostInMoveCurrency: line.unitCostInMoveCurrency,
      moveCurrency: line.moveCurrency,
      fxRateMovToBase: line.fxRateMovToBase,
      fxRateCCYToBase: line.fxRateCCYToBase,
      unitCostBase: line.unitCostBase,
    })));
  }, [defaultOpeningBalanceAccountId, isNewRoute, selectedDocument]);

  useEffect(() => {
    if (!isNewRoute || !defaultOpeningBalanceAccountId) return;
    setForm((prev) => (prev.openingBalanceAccountId ? prev : { ...prev, openingBalanceAccountId: defaultOpeningBalanceAccountId }));
  }, [defaultOpeningBalanceAccountId, isNewRoute]);

  useEffect(() => {
    const loadVoucherLabels = async () => {
      if (!accountingEnabled) {
        setVoucherLabelById({});
        return;
      }
      const voucherIds = Array.from(new Set(documents.map((document) => document.voucherId).filter((voucherId): voucherId is string => !!voucherId)));
      if (voucherIds.length === 0) {
        setVoucherLabelById({});
        return;
      }
      const results = await Promise.allSettled(voucherIds.map(async (voucherId) => {
        const response = await accountingApi.getVoucher(voucherId);
        const voucher = unwrap<any>(response);
        return [voucherId, normalizeReferenceLabel(voucher?.voucherNo || voucherId, 'VCH')] as const;
      }));
      setVoucherLabelById(results.reduce<Record<string, string>>((acc, result) => {
        if (result.status === 'fulfilled') acc[result.value[0]] = result.value[1];
        return acc;
      }, {}));
    };
    void loadVoucherLabels();
  }, [accountingEnabled, documents]);

  const warehouseNameById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, `${warehouse.code} - ${warehouse.name}`])),
    [warehouses],
  );

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return '';
    const account = getAccountById(accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  const getLineUnitCostBase = (line: OpeningStockLineDraft) => {
    const moveCurrency = (line.moveCurrency || '').toUpperCase();
    if (moveCurrency === baseCurrency) return line.unitCostInMoveCurrency;
    if (line.itemCostCurrency && moveCurrency === line.itemCostCurrency.toUpperCase()) {
      return line.unitCostInMoveCurrency * line.fxRateCCYToBase;
    }
    if (typeof line.unitCostBase === 'number' && !Number.isNaN(line.unitCostBase)) return line.unitCostBase;
    return line.unitCostInMoveCurrency * line.fxRateMovToBase;
  };

  const validLines = useMemo(() => lines.filter((line) => line.itemId && line.quantity > 0), [lines]);
  const documentValueBase = useMemo(
    () => validLines.reduce((sum, line) => sum + line.quantity * getLineUnitCostBase(line), 0),
    [baseCurrency, validLines],
  );
  const duplicateWarnings = useMemo(() => {
    if (!form.warehouseId || !form.date || validLines.length === 0) return [];
    const itemIds = new Set(validLines.map((line) => line.itemId));
    return documents
      .filter((document) => document.id !== selectedDocument?.id)
      .filter((document) => document.warehouseId === form.warehouseId && document.date === form.date)
      .map((document) => ({ document, overlappingItemCount: document.lines.filter((line) => itemIds.has(line.itemId)).length }))
      .filter((entry) => entry.overlappingItemCount > 0);
  }, [documents, form.date, form.warehouseId, selectedDocument?.id, validLines]);

  const updateLine = (index: number, patch: Partial<OpeningStockLineDraft>) => {
    setLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };
  const resetForm = () => {
    setForm((prev) => ({
      ...prev,
      notes: '',
      date: todayIso(),
      createAccountingEffect: false,
      openingBalanceAccountId: defaultOpeningBalanceAccountId,
    }));
    setLines([{
      id: makeId(),
      itemId: '',
      quantity: 0,
      unitCostInMoveCurrency: 0,
      moveCurrency: baseCurrency,
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
      unitCostBase: 0,
    }]);
  };

  const validateForm = (): string | null => {
    if (!form.warehouseId) return 'Warehouse is required.';
    if (!form.date) return 'Document date is required.';
    if (validLines.length === 0) return 'Add at least one valid stock line with quantity greater than zero.';
    if (accountingEnabled && form.createAccountingEffect && !form.openingBalanceAccountId) {
      return 'Opening Balance / Clearing account is required when accounting effect is enabled.';
    }
    return null;
  };

  const buildPayload = () => ({
    warehouseId: form.warehouseId,
    date: form.date,
    notes: form.notes.trim() || undefined,
    createAccountingEffect: accountingEnabled ? form.createAccountingEffect : false,
    openingBalanceAccountId: accountingEnabled && form.createAccountingEffect ? form.openingBalanceAccountId || undefined : undefined,
    lines: validLines.map((line) => ({
      itemId: line.itemId,
      quantity: Number(line.quantity),
      unitCostInMoveCurrency: Number(line.unitCostInMoveCurrency),
      moveCurrency: line.moveCurrency.toUpperCase(),
      fxRateMovToBase: Number(line.fxRateMovToBase),
      fxRateCCYToBase: Number(line.fxRateCCYToBase),
    })),
  });

  const saveDocument = async (postAfterSave: boolean, confirmedInventoryOnly = false) => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const payload = buildPayload();
    if (postAfterSave && accountingEnabled && !payload.createAccountingEffect && !confirmedInventoryOnly) {
      setConfirmState({ kind: 'inventory-only-post-new' });
      return;
    }
    try {
      if (postAfterSave) setPostingNew(true);
      else setSavingDraft(true);
      const saved = selectedDocument?.status === 'DRAFT'
        ? unwrap<OpeningStockDocumentDTO>(await inventoryApi.updateOpeningStockDocument(selectedDocument.id, payload))
        : unwrap<OpeningStockDocumentDTO>(await inventoryApi.createOpeningStockDocument(payload));
      if (postAfterSave) await inventoryApi.postOpeningStockDocument(saved.id);
      toast.success(postAfterSave ? 'Opening Stock Document posted.' : 'Opening Stock Document saved as draft.');
      resetForm();
      await loadPageData();
      navigate(postAfterSave ? '/inventory/opening-stock' : `/inventory/opening-stock/${saved.id}`);
    } catch (saveError) {
      console.error('Failed to save Opening Stock Document', saveError);
      errorHandler.showOperationError(saveError);
    } finally {
      setSavingDraft(false);
      setPostingNew(false);
    }
  };

  const postExistingDraft = async (documentId: string, confirmedInventoryOnly = false) => {
    const document = documents.find((entry) => entry.id === documentId);
    if (accountingEnabled && document && !document.createAccountingEffect && !confirmedInventoryOnly) {
      setConfirmState({ kind: 'inventory-only-post-existing', documentId });
      return;
    }
    try {
      setPostingExistingId(documentId);
      await inventoryApi.postOpeningStockDocument(documentId);
      toast.success('Opening Stock Document posted.');
      await loadPageData();
      navigate('/inventory/opening-stock');
    } catch (postError) {
      console.error('Failed to post Opening Stock Document', postError);
      errorHandler.showOperationError(postError);
    } finally {
      setPostingExistingId(null);
    }
  };

  const deleteDraft = async (documentId: string, confirmedDelete = false) => {
    if (!confirmedDelete) {
      setConfirmState({ kind: 'delete-draft', documentId });
      return;
    }
    try {
      setDeletingDraftId(documentId);
      await inventoryApi.deleteOpeningStockDocument(documentId);
      toast.success('Opening Stock Document draft deleted.');
      await loadPageData();
      navigate('/inventory/opening-stock');
    } catch (deleteError) {
      console.error('Failed to delete Opening Stock Document', deleteError);
      errorHandler.showOperationError(deleteError);
    } finally {
      setDeletingDraftId(null);
    }
  };

  const handleConfirmDialogConfirm = () => {
    if (!confirmState) return;
    const current = confirmState;
    setConfirmState(null);
    if (current.kind === 'inventory-only-post-new') void saveDocument(true, true);
    if (current.kind === 'inventory-only-post-existing') void postExistingDraft(current.documentId, true);
    if (current.kind === 'delete-draft') void deleteDraft(current.documentId, true);
  };

  const lineColumns: ColumnDef<OpeningStockLineDraft>[] = [
    {
      id: 'item',
      label: 'Stock Item',
      kind: 'custom',
      width: '280px',
      render: (line, index) => (
        <ItemSelector
          value={line.itemId}
          trackInventoryOnly
          disabled={isReadOnly || savingDraft || postingNew}
          onChange={(item) => updateLine(index, { itemId: item?.id || '', itemCostCurrency: item?.costCurrency || '', unitCostBase: undefined })}
          placeholder="Search stock item..."
          noBorder
        />
      ),
    },
    { id: 'quantity', label: 'Qty', kind: 'number', width: '110px', accessor: (line) => line.quantity, setter: (value) => ({ quantity: Number(value) }) },
    { id: 'unitCost', label: 'Unit Cost', kind: 'number', width: '130px', accessor: (line) => line.unitCostInMoveCurrency, setter: (value) => ({ unitCostInMoveCurrency: Number(value) }) },
    {
      id: 'currency',
      label: 'Currency',
      kind: 'custom',
      width: '130px',
      render: (line, index) => (
        <CurrencySelector value={line.moveCurrency} onChange={(currencyCode) => updateLine(index, { moveCurrency: currencyCode })} noBorder disabled={isReadOnly} />
      ),
    },
    { id: 'docFx', label: 'Doc FX', kind: 'number', width: '110px', accessor: (line) => line.fxRateMovToBase, setter: (value) => ({ fxRateMovToBase: Number(value) }) },
    { id: 'costFx', label: 'Cost FX', kind: 'number', width: '110px', accessor: (line) => line.fxRateCCYToBase, setter: (value) => ({ fxRateCCYToBase: Number(value) }) },
    { id: 'value', label: `Value (${baseCurrency})`, kind: 'computed', width: '140px', compute: (line) => line.quantity * getLineUnitCostBase(line) },
  ];

  const confirmDialogConfig = useMemo(() => {
    if (!confirmState) return null;
    if (confirmState.kind === 'delete-draft') {
      return {
        title: 'Delete Draft?',
        message: <>Delete <span className="font-black">{getOpeningStockDocumentRef(confirmState.documentId)}</span>? This removes the draft only.</>,
        confirmLabel: 'Delete Draft',
        cancelLabel: 'Keep Draft',
        tone: 'danger' as const,
        icon: <Trash2 className="h-5 w-5" />,
        isConfirming: deletingDraftId === confirmState.documentId,
      };
    }
    return {
      title: 'Post as Inventory Only?',
      message: 'Accounting is enabled, but this document is set to inventory-only. Posting will change stock quantities and inventory values without creating any accounting entry.',
      confirmLabel: 'Continue Posting',
      cancelLabel: confirmState.kind === 'inventory-only-post-new' ? 'Keep Editing' : 'Cancel',
      tone: 'warning' as const,
      icon: <AlertCircle className="h-5 w-5" />,
      isConfirming: confirmState.kind === 'inventory-only-post-new' ? postingNew : postingExistingId === confirmState.documentId,
    };
  }, [confirmState, deletingDraftId, postingExistingId, postingNew]);

  const filteredData = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    const minValue = valueMinFilter.trim() ? Number(valueMinFilter) : null;
    const maxValue = valueMaxFilter.trim() ? Number(valueMaxFilter) : null;
    return documents.filter((document) => {
      if (statusFilter !== 'ALL' && document.status !== statusFilter) return false;
      if (warehouseFilter !== 'ALL' && document.warehouseId !== warehouseFilter) return false;
      if (dateFromFilter && document.date < dateFromFilter) return false;
      if (dateToFilter && document.date > dateToFilter) return false;
      if (accountingFilter === 'WITH_ACCOUNTING' && !document.createAccountingEffect) return false;
      if (accountingFilter === 'INVENTORY_ONLY' && document.createAccountingEffect) return false;
      if (accountingFilter === 'WITH_VOUCHER' && !document.voucherId) return false;
      if (accountingFilter === 'NO_VOUCHER' && document.voucherId) return false;
      if (minValue !== null && !Number.isNaN(minValue) && document.totalValueBase < minValue) return false;
      if (maxValue !== null && !Number.isNaN(maxValue) && document.totalValueBase > maxValue) return false;
      if (!query) return true;
      return [
        document.id,
        document.warehouseId,
        warehouseNameById.get(document.warehouseId) || '',
        document.notes || '',
        document.status,
        document.voucherId || '',
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [accountingFilter, dateFromFilter, dateToFilter, documents, searchFilter, statusFilter, valueMaxFilter, valueMinFilter, warehouseFilter, warehouseNameById]);

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

  const formView = isFormRoute ? (() => {
    const notFound = Boolean(id && !loading && !selectedDocument && !isNewRoute);
    const accountingControlTone = accountingEnabled && form.createAccountingEffect ? 'blue' : 'amber';
    const accountingControlMessage = !accountingEnabled
      ? 'Accounting is disabled. This operation will affect stock quantities only and will not create any accounting entry.'
      : !form.createAccountingEffect
        ? 'Accounting is enabled, but this document is currently set to inventory-only. Posting will change stock quantities and inventory values without creating any accounting entry.'
        : `Opening Balance / Clearing Account is prefilled from Inventory Settings${
            defaultOpeningBalanceAccountId ? `: ${getAccountLabel(defaultOpeningBalanceAccountId)}` : ' when configured'
          }. You can override it for this document.`;
    const railReady: Array<{ state: 'ok' | 'warn' | 'info'; label: React.ReactNode }> = [
      { state: form.warehouseId ? 'ok' : 'info', label: 'Warehouse selected' },
      { state: form.date ? 'ok' : 'info', label: 'Document date set' },
      { state: validLines.length > 0 ? 'ok' : 'info', label: 'At least one stock line' },
      { state: !accountingEnabled || !form.createAccountingEffect || form.openingBalanceAccountId ? 'ok' : 'warn', label: 'Opening balance account selected' },
      { state: duplicateWarnings.length > 0 ? 'warn' : 'ok', label: duplicateWarnings.length > 0 ? 'Possible duplicate opening entry' : 'No duplicate warning' },
    ];

    return (
      <>
        {confirmDialogConfig && (
          <ConfirmDialog
            isOpen={!!confirmState}
            title={confirmDialogConfig.title}
            message={confirmDialogConfig.message}
            confirmLabel={confirmDialogConfig.confirmLabel}
            cancelLabel={confirmDialogConfig.cancelLabel}
            tone={confirmDialogConfig.tone}
            icon={confirmDialogConfig.icon}
            isConfirming={confirmDialogConfig.isConfirming}
            onCancel={() => setConfirmState(null)}
            onConfirm={handleConfirmDialogConfirm}
          />
        )}
        <DocumentDetailScaffold
          title={isNewRoute ? 'New Opening Stock Document' : selectedDocument ? getOpeningStockDocumentRef(selectedDocument.id) : 'Opening Stock Document'}
          subtitle="Record stock that already exists at go-live or migration"
          icon={Package}
          backLabel="Back to opening stock"
          onBack={() => navigate('/inventory/opening-stock')}
          badges={<DocumentPill tone={selectedDocument?.status === 'POSTED' ? 'green' : 'amber'}>{selectedDocument?.status || 'DRAFT'}</DocumentPill>}
          forceRailDrawer={isWindowsMode}
          sections={{
            banner: {
              show: notFound || duplicateWarnings.length > 0,
              content: notFound ? (
                <DocumentNoticeBanner tone="amber">Opening Stock Document not found.</DocumentNoticeBanner>
              ) : (
                <DocumentNoticeBanner tone="amber">
                  Existing documents contain overlapping items for the same warehouse/date. Review before saving or posting.
                </DocumentNoticeBanner>
              ),
            },
            control: {
              content: (
                <DocumentControlPanel>
                  <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Create Accounting Effect
                      </span>
                      <DocumentSegmentedGroup>
                        <DocumentSegmentButton
                          active={!form.createAccountingEffect}
                          disabled={isReadOnly}
                          label="No"
                          onClick={() => {
                            setShowAccountingControlMessage(false);
                            setForm((prev) => ({ ...prev, createAccountingEffect: false, openingBalanceAccountId: '' }));
                          }}
                        />
                        <DocumentSegmentButton
                          active={form.createAccountingEffect && accountingEnabled}
                          disabled={isReadOnly || !accountingEnabled}
                          label="Yes"
                          onClick={() => {
                            if (!accountingEnabled) return;
                            setShowAccountingControlMessage(false);
                            setForm((prev) => ({ ...prev, createAccountingEffect: true, openingBalanceAccountId: prev.openingBalanceAccountId || defaultOpeningBalanceAccountId }));
                          }}
                        />
                      </DocumentSegmentedGroup>
                      <DocumentIconButton
                        title={showAccountingControlMessage ? 'Hide accounting control message' : accountingControlMessage}
                        onClick={() => setShowAccountingControlMessage((prev) => !prev)}
                      >
                        <AlertCircle className={clsx('h-3.5 w-3.5', accountingControlTone === 'amber' ? 'text-amber-600 dark:text-amber-300' : 'text-blue-600 dark:text-blue-300')} />
                      </DocumentIconButton>
                    </div>

                    {accountingEnabled && form.createAccountingEffect && (
                      <div className="min-w-[260px] max-w-xl">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          Opening Balance / Clearing Account
                        </label>
                        <AccountSelector
                          value={form.openingBalanceAccountId}
                          onChange={(account) => setForm((prev) => ({ ...prev, openingBalanceAccountId: account?.id || '' }))}
                          placeholder="Search opening balance equity account..."
                          accounts={allAccounts.filter((account) => account.accountRole === 'POSTING' && account.classification?.toUpperCase() === 'EQUITY')}
                          disabled={isReadOnly}
                        />
                      </div>
                    )}
                  </div>
                  {showAccountingControlMessage && (
                    <div className="mt-2">
                      <DocumentNoticeBanner tone={accountingControlTone}>
                        {accountingControlMessage}
                      </DocumentNoticeBanner>
                    </div>
                  )}
                </DocumentControlPanel>
              ),
            },
            header: {
              title: 'Document Details',
              cardClassName: 'overflow-visible',
              content: (
                <DocumentHeaderGrid>
                  <DocumentHeaderField label="Warehouse">
                    <WarehouseSelector
                      className={documentHeaderSelectorClass}
                      value={form.warehouseId}
                      warehouses={warehouses}
                      onChange={(warehouse) => setForm((prev) => ({ ...prev, warehouseId: warehouse?.id || '' }))}
                      disabled={isReadOnly}
                    />
                  </DocumentHeaderField>
                  <DocumentHeaderField label="Document Date">
                    <DatePicker className="w-full" inputClassName={documentHeaderControlClass} value={form.date} onChange={(value) => setForm((prev) => ({ ...prev, date: value }))} disabled={isReadOnly} />
                  </DocumentHeaderField>
                  <DocumentHeaderField label="Notes">
                    <input
                      className={documentHeaderControlClass}
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional migration batch or cutover note"
                      disabled={isReadOnly}
                    />
                  </DocumentHeaderField>
                </DocumentHeaderGrid>
              ),
            },
            lines: {
              content: (
                <ClassicLineItemsTable<OpeningStockLineDraft>
                  tableId="inventory.opening-stock.lines"
                  title="Document Lines"
                  columns={lineColumns}
                  rows={lines}
                  disabled={isReadOnly || savingDraft || postingNew}
                  onRowChange={updateLine}
                  onRowRemove={(index) => setLines((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev))}
                  onRowsChange={setLines}
                  createEmptyRow={() => ({ id: makeId(), itemId: '', quantity: 0, unitCostInMoveCurrency: 0, moveCurrency: baseCurrency, fxRateMovToBase: 1, fxRateCCYToBase: 1, unitCostBase: 0 })}
                  getRowKey={(line) => line.id}
                  isRowFilled={(line) => Boolean(line.itemId)}
                  onRowAdd={() => setLines((prev) => [...prev, { id: makeId(), itemId: '', quantity: 0, unitCostInMoveCurrency: 0, moveCurrency: baseCurrency, fxRateMovToBase: 1, fxRateCCYToBase: 1, unitCostBase: 0 }])}
                  addLabel="Add Line"
                  minTableWidth="980px"
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
                    { label: 'Reference', value: selectedDocument ? getOpeningStockDocumentRef(selectedDocument.id) : 'New' },
                    { label: 'Warehouse', value: warehouseNameById.get(form.warehouseId) || '—' },
                    { label: 'Accounting', value: form.createAccountingEffect ? 'Inventory + Accounting' : 'Inventory only' },
                    { label: 'Voucher', value: selectedDocument?.voucherId ? voucherLabelById[selectedDocument.voucherId] || selectedDocument.voucherId : 'No voucher' },
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
                    { label: 'Lines', value: String(validLines.length) },
                    { label: 'Base Currency', value: baseCurrency },
                  ]}
                  grand={{ label: 'Opening Value', value: documentValueBase.toFixed(2) }}
                />
              ),
            },
          }}
          footerActions={
            <>
              <button type="button" onClick={() => navigate('/inventory/opening-stock')} className="rounded border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                Back
              </button>
              {selectedDocument?.status === 'DRAFT' && (
                <button type="button" onClick={() => void deleteDraft(selectedDocument.id)} disabled={deletingDraftId === selectedDocument.id} className="inline-flex items-center gap-2 rounded border border-rose-200 px-5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                  Delete Draft
                </button>
              )}
              {!isReadOnly && (
                <button type="button" onClick={() => void saveDocument(false)} disabled={savingDraft || postingNew} className="rounded border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  {savingDraft ? 'Saving...' : selectedDocument ? 'Update Draft' : 'Save Draft'}
                </button>
              )}
              {!isReadOnly && (
                <button type="button" onClick={() => void saveDocument(true)} disabled={savingDraft || postingNew} className="inline-flex items-center gap-2 rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                  {postingNew ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                  {selectedDocument ? 'Update & Post' : 'Create & Post'}
                </button>
              )}
            </>
          }
        />
      </>
    );
  })() : null;

  const statusFilterConfig = {
    activeValue: statusFilter,
    onChange: (value: string) => {
      setStatusFilter(value as typeof statusFilter);
      setPage(1);
    },
    counts: {
      ALL: documents.length,
      DRAFT: documents.filter((document) => document.status === 'DRAFT').length,
      POSTED: documents.filter((document) => document.status === 'POSTED').length,
    },
    options: [
      { value: 'ALL', label: 'All', color: 'slate' },
      { value: 'DRAFT', label: 'Draft', color: 'amber' },
      { value: 'POSTED', label: 'Posted', color: 'emerald' },
    ],
  };

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);
  const showLegacyOpeningStockWarning = documents.length === 0 && legacyOpeningMovements.length > 0;
  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    searchFilter !== '' ||
    warehouseFilter !== 'ALL' ||
    dateFromFilter !== '' ||
    dateToFilter !== '' ||
    accountingFilter !== 'ALL' ||
    valueMinFilter !== '' ||
    valueMaxFilter !== '';
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const listColumns: ColumnDefinition<OpeningStockDocumentDTO>[] = [
    { key: 'id', label: 'Document', width: '150px', priority: 1, sortable: true, accessor: 'id', render: (value: string) => <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{getOpeningStockDocumentRef(value)}</span> },
    { key: 'date', label: 'Date', width: '130px', priority: 1, sortable: true, accessor: 'date' },
    { key: 'warehouseId', label: 'Warehouse', width: '230px', priority: 1, sortable: true, accessor: 'warehouseId', render: (value: string) => warehouseNameById.get(value) || value },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      priority: 1,
      sortable: true,
      accessor: 'status',
      align: 'center',
      render: (value: string) => (
        <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset', value === 'POSTED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : 'bg-amber-50 text-amber-700 ring-amber-600/10')}>
          {value}
        </span>
      ),
    },
    { key: 'createAccountingEffect', label: 'Accounting', width: '180px', priority: 1, accessor: 'createAccountingEffect', render: (value: boolean) => value ? 'Inventory + Accounting' : 'Inventory only' },
    { key: 'totalValueBase', label: `Value (${baseCurrency})`, width: '150px', priority: 1, sortable: true, accessor: 'totalValueBase', align: 'right', render: (value: number) => Number(value || 0).toFixed(2) },
    {
      key: 'voucherId',
      label: 'Voucher',
      width: '140px',
      priority: 2,
      accessor: 'voucherId',
      render: (value: string, row) => value ? <Link className="font-bold text-indigo-700 hover:underline" to={`/accounting/vouchers/${value}/view`}>{voucherLabelById[value] || normalizeReferenceLabel(value, 'VCH')}</Link> : 'No voucher',
    },
  ];

  const rowActions: RowAction<OpeningStockDocumentDTO>[] = [
    { key: 'view', label: 'View', icon: Eye, onClick: (row) => navigate(`/inventory/opening-stock/${row.id}`), primary: false },
    { key: 'post', label: 'Post', icon: Check, variant: 'success', isEnabled: (row) => row.status === 'DRAFT', onClick: (row) => void postExistingDraft(row.id), primary: false },
    { key: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', isEnabled: (row) => row.status === 'DRAFT', onClick: (row) => void deleteDraft(row.id), primary: false },
  ];

  if (formView) {
    return formView;
  }

  return (
    <>
      {confirmDialogConfig && (
        <ConfirmDialog
          isOpen={!!confirmState}
          title={confirmDialogConfig.title}
          message={confirmDialogConfig.message}
          confirmLabel={confirmDialogConfig.confirmLabel}
          cancelLabel={confirmDialogConfig.cancelLabel}
          tone={confirmDialogConfig.tone}
          icon={confirmDialogConfig.icon}
          isConfirming={confirmDialogConfig.isConfirming}
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirmDialogConfirm}
        />
      )}
      <OperationalListLayout<OpeningStockDocumentDTO>
        title={t('openingStockDocuments.title', { defaultValue: 'Opening Stock Documents' })}
        subtitle=""
        compactHeader
        summaryWidgets={showLegacyOpeningStockWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {t('openingStockDocuments.legacyOpeningMovementsTitle', {
                    count: legacyOpeningMovements.length,
                    defaultValue: '{{count}} legacy opening stock movement(s) found',
                  })}
                </p>
                <p>
                  {t('openingStockDocuments.legacyOpeningMovementsBody', {
                    defaultValue: 'These movements were recorded through the older direct opening-stock flow, so they do not have Opening Stock Document headers. Review Stock Movements before creating a new opening document to avoid duplicate stock.',
                  })}
                </p>
                <Link to="/inventory/movements" className="inline-flex font-semibold text-amber-950 underline underline-offset-2 dark:text-amber-100">
                  {t('openingStockDocuments.reviewStockMovements', { defaultValue: 'Review Stock Movements' })}
                </Link>
              </div>
            </div>
          </div>
        ) : undefined}
        statusFilterConfig={statusFilterConfig}
        newButtonLabel={t('openingStockDocuments.newDocument', { defaultValue: 'New Document' })}
        onNewClick={() => navigate('/inventory/opening-stock/new')}
        onRefresh={loadPageData}
        loading={loading}
        error={error}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => {
          setLocalSearch('');
          setSearchFilter('');
          setStatusFilter('ALL');
          setWarehouseFilter('ALL');
          setDateFromFilter('');
          setDateToFilter('');
          setAccountingFilter('ALL');
          setValueMinFilter('');
          setValueMaxFilter('');
          setPage(1);
        }}
        filters={
          <div className="flex w-full flex-row items-center gap-2.5 overflow-x-auto whitespace-nowrap pb-1.5 lg:pb-0">
            <div className="relative min-w-[260px] flex-1">
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
                placeholder={t('openingStockDocuments.searchPlaceholder', { defaultValue: 'Search document, warehouse, voucher...' })}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <select
              value={warehouseFilter}
              onChange={(event) => {
                setWarehouseFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="ALL">{t('openingStockDocuments.allWarehouses', { defaultValue: 'All warehouses' })}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
            <DatePicker
              value={dateFromFilter}
              onChange={(value) => {
                setDateFromFilter(value);
                setPage(1);
              }}
              placeholder={t('openingStockDocuments.dateFrom', { defaultValue: 'Date From' })}
              className="min-w-[135px]"
              inputClassName="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <DatePicker
              value={dateToFilter}
              onChange={(value) => {
                setDateToFilter(value);
                setPage(1);
              }}
              placeholder={t('openingStockDocuments.dateTo', { defaultValue: 'Date To' })}
              className="min-w-[135px]"
              inputClassName="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <select
              value={accountingFilter}
              onChange={(event) => {
                setAccountingFilter(event.target.value as typeof accountingFilter);
                setPage(1);
              }}
              className="min-w-[185px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="ALL">{t('openingStockDocuments.accountingModes.all', { defaultValue: 'All accounting modes' })}</option>
              <option value="WITH_ACCOUNTING">{t('openingStockDocuments.accountingModes.withAccounting', { defaultValue: 'Inventory + Accounting' })}</option>
              <option value="INVENTORY_ONLY">{t('openingStockDocuments.accountingModes.inventoryOnly', { defaultValue: 'Inventory only' })}</option>
              <option value="WITH_VOUCHER">{t('openingStockDocuments.accountingModes.withVoucher', { defaultValue: 'With voucher' })}</option>
              <option value="NO_VOUCHER">{t('openingStockDocuments.accountingModes.noVoucher', { defaultValue: 'No voucher' })}</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valueMinFilter}
              onChange={(event) => {
                setValueMinFilter(event.target.value);
                setPage(1);
              }}
              placeholder={`Min ${baseCurrency}`}
              className="w-[120px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={valueMaxFilter}
              onChange={(event) => {
                setValueMaxFilter(event.target.value);
                setPage(1);
              }}
              placeholder={`Max ${baseCurrency}`}
              className="w-[120px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button type="button" onClick={() => { setSearchFilter(localSearch); setPage(1); }} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-700">
              <Filter size={16} />
              {t('openingStockDocuments.apply', { defaultValue: 'Apply' })}
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setSearchFilter('');
                setStatusFilter('ALL');
                setWarehouseFilter('ALL');
                setDateFromFilter('');
                setDateToFilter('');
                setAccountingFilter('ALL');
                setValueMinFilter('');
                setValueMaxFilter('');
                setPage(1);
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:bg-slate-50 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              title={t('openingStockDocuments.clearFilters', { defaultValue: 'Clear Filters' })}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        }
        columns={listColumns}
        data={paginatedData}
        emptyMessage={t('openingStockDocuments.empty', { defaultValue: 'No Opening Stock Documents found' })}
        onRowClick={(row) => navigate(`/inventory/opening-stock/${row.id}`)}
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

export default OpeningStockPage;
