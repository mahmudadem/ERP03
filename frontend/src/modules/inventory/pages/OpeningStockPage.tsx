import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import {
  inventoryApi,
  InventoryWarehouseDTO,
  OpeningStockDocumentDTO,
} from '../../../api/inventoryApi';
import { accountingApi } from '../../../api/accountingApi';
import { ItemSelector } from '../../../components/shared/selectors/ItemSelector';
import { WarehouseSelector } from '../../../components/shared/selectors/WarehouseSelector';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAccounts } from '../../../context/AccountsContext';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';

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

type OpeningStockConfirmState =
  | { kind: 'inventory-only-post-new' }
  | { kind: 'inventory-only-post-existing'; documentId: string }
  | { kind: 'delete-draft'; documentId: string }
  | null;

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const makeId = () => `opening-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatShortRef = (value: string, prefix: string) => `${prefix}-${value.slice(0, 8).toUpperCase()}`;
const getOpeningStockDocumentRef = (documentId: string) => formatShortRef(documentId, 'OSD');
const normalizeReferenceLabel = (value: string, fallbackPrefix: string) => {
  const trimmed = value.trim();
  const prefixedUuidMatch = trimmed.match(/^([A-Za-z]+)-([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (prefixedUuidMatch) {
    return `${prefixedUuidMatch[1].toUpperCase()}-${prefixedUuidMatch[2].toUpperCase()}`;
  }

  const rawUuidMatch = trimmed.match(/^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (rawUuidMatch) {
    return `${fallbackPrefix}-${rawUuidMatch[1].toUpperCase()}`;
  }

  return trimmed;
};
const getErrorMessage = (error: any) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Failed to process Opening Stock Document.';

const OpeningStockPage: React.FC = () => {
  const { company } = useCompanyAccess();
  const { isModuleInitialized, loading: modulesLoading } = useCompanyModules();
  const { getAccountById } = useAccounts();
  const accountingEnabled = isModuleInitialized('accounting');
  const baseCurrency = (company?.baseCurrency || 'USD').toUpperCase();

  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [documents, setDocuments] = useState<OpeningStockDocumentDTO[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [postingNew, setPostingNew] = useState(false);
  const [postingExistingId, setPostingExistingId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [voucherLabelById, setVoucherLabelById] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmState, setConfirmState] = useState<OpeningStockConfirmState>(null);
  const [form, setForm] = useState({
    warehouseId: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    createAccountingEffect: false,
    openingBalanceAccountId: '',
  });
  const [lines, setLines] = useState<OpeningStockLineDraft[]>([
    {
      id: makeId(),
      itemId: '',
      quantity: 0,
      unitCostInMoveCurrency: 0,
      moveCurrency: baseCurrency,
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
      unitCostBase: 0,
    },
  ]);

  const loadPageData = async () => {
    try {
      setLoadingPage(true);
      const [warehouseResponse, documentResponse] = await Promise.all([
        inventoryApi.listWarehouses({ active: true }),
        inventoryApi.listOpeningStockDocuments(),
      ]);
      const nextWarehouses = unwrap<InventoryWarehouseDTO[]>(warehouseResponse) || [];
      const nextDocuments = unwrap<OpeningStockDocumentDTO[]>(documentResponse) || [];
      setWarehouses(nextWarehouses);
      setDocuments(nextDocuments);
      setForm((prev) => ({
        ...prev,
        warehouseId:
          prev.warehouseId ||
          nextWarehouses.find((warehouse) => warehouse.isDefault)?.id ||
          nextWarehouses[0]?.id ||
          '',
      }));
    } catch (error) {
      console.error('Failed to load Opening Stock Documents', error);
      setResult({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    if (!accountingEnabled) {
      setForm((prev) => ({
        ...prev,
        createAccountingEffect: false,
        openingBalanceAccountId: '',
      }));
    }
  }, [accountingEnabled]);

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

      const results = await Promise.allSettled(
        voucherIds.map(async (voucherId) => {
          const response = await accountingApi.getVoucher(voucherId);
          const voucher = unwrap<any>(response);
          return [voucherId, normalizeReferenceLabel(voucher?.voucherNo || voucherId, 'VCH')] as const;
        })
      );

      const nextLabels = results.reduce<Record<string, string>>((acc, result) => {
        if (result.status === 'fulfilled') {
          const [voucherId, voucherLabel] = result.value;
          acc[voucherId] = voucherLabel;
        }
        return acc;
      }, {});

      setVoucherLabelById(nextLabels);
    };

    void loadVoucherLabels();
  }, [accountingEnabled, documents]);

  const warehouseNameById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, `${warehouse.code} - ${warehouse.name}`])),
    [warehouses]
  );

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return '';
    const account = getAccountById(accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  const getDocumentLabel = (document: OpeningStockDocumentDTO) => getOpeningStockDocumentRef(document.id);
  const getVoucherLabel = (document: OpeningStockDocumentDTO) => {
    if (!document.voucherId) return 'No voucher';
    return voucherLabelById[document.voucherId] || normalizeReferenceLabel(document.voucherId, 'VCH');
  };

  const getLineUnitCostBase = (line: OpeningStockLineDraft) => {
    const moveCurrency = (line.moveCurrency || '').toUpperCase();
    if (moveCurrency === baseCurrency) {
      return line.unitCostInMoveCurrency;
    }
    if (line.itemCostCurrency && moveCurrency === line.itemCostCurrency.toUpperCase()) {
      return line.unitCostInMoveCurrency * line.fxRateCCYToBase;
    }
    if (typeof line.unitCostBase === 'number' && !Number.isNaN(line.unitCostBase)) {
      return line.unitCostBase;
    }
    return line.unitCostInMoveCurrency * line.fxRateMovToBase;
  };

  const validLines = useMemo(
    () => lines.filter((line) => line.itemId && line.quantity > 0),
    [lines]
  );

  const documentValueBase = useMemo(
    () =>
      validLines.reduce((sum, line) => {
        return sum + line.quantity * getLineUnitCostBase(line);
      }, 0),
    [baseCurrency, validLines]
  );

  const duplicateWarnings = useMemo(() => {
    if (!form.warehouseId || !form.date || validLines.length === 0) {
      return [];
    }

    const itemIds = new Set(validLines.map((line) => line.itemId));
    return documents
      .filter((document) => document.id !== editingDocumentId)
      .filter((document) => document.warehouseId === form.warehouseId && document.date === form.date)
      .map((document) => ({
        document,
        overlappingItemCount: document.lines.filter((line) => itemIds.has(line.itemId)).length,
      }))
      .filter((entry) => entry.overlappingItemCount > 0);
  }, [documents, editingDocumentId, form.date, form.warehouseId, validLines]);

  const updateLine = <K extends keyof OpeningStockLineDraft>(id: string, field: K, value: OpeningStockLineDraft[K]) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: makeId(),
        itemId: '',
        quantity: 0,
        unitCostInMoveCurrency: 0,
        moveCurrency: baseCurrency,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        unitCostBase: 0,
      },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const resetForm = () => {
    setEditingDocumentId(null);
    setForm((prev) => ({
      ...prev,
      notes: '',
      createAccountingEffect: false,
      openingBalanceAccountId: '',
    }));
    setLines([
      {
        id: makeId(),
        itemId: '',
        quantity: 0,
        unitCostInMoveCurrency: 0,
        moveCurrency: baseCurrency,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        unitCostBase: 0,
      },
    ]);
  };

  const loadDraftIntoForm = (document: OpeningStockDocumentDTO) => {
    setEditingDocumentId(document.id);
    setForm({
      warehouseId: document.warehouseId,
      date: document.date,
      notes: document.notes || '',
      createAccountingEffect: document.createAccountingEffect,
      openingBalanceAccountId: document.openingBalanceAccountId || '',
    });
    setLines(
      document.lines.map((line) => ({
        id: line.lineId,
        itemId: line.itemId,
        quantity: line.quantity,
        unitCostInMoveCurrency: line.unitCostInMoveCurrency,
        moveCurrency: line.moveCurrency,
        fxRateMovToBase: line.fxRateMovToBase,
        fxRateCCYToBase: line.fxRateCCYToBase,
        unitCostBase: line.unitCostBase,
      }))
    );
    setResult({
      type: 'info',
      message: `Editing draft ${getOpeningStockDocumentRef(document.id)}. Posted documents stay locked; correct posted values through reversal or inventory adjustment, not direct edit.`,
    });
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
    openingBalanceAccountId:
      accountingEnabled && form.createAccountingEffect ? form.openingBalanceAccountId || undefined : undefined,
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
      setResult({ type: 'error', message: validationError });
      return;
    }

    const payload = buildPayload();
    if (postAfterSave && accountingEnabled && !payload.createAccountingEffect && !confirmedInventoryOnly) {
      setConfirmState({ kind: 'inventory-only-post-new' });
      return;
    }

    try {
      if (postAfterSave) {
        setPostingNew(true);
        setResult({
          type: 'info',
          message: editingDocumentId
            ? `Updating and posting Opening Stock Document ${getOpeningStockDocumentRef(editingDocumentId)}...`
            : 'Creating and posting Opening Stock Document...',
        });
      } else {
        setSavingDraft(true);
        setResult({
          type: 'info',
          message: editingDocumentId
            ? `Updating Opening Stock Document ${getOpeningStockDocumentRef(editingDocumentId)} draft...`
            : 'Saving Opening Stock Document draft...',
        });
      }

      const saved = editingDocumentId
        ? unwrap<OpeningStockDocumentDTO>(await inventoryApi.updateOpeningStockDocument(editingDocumentId, payload))
        : unwrap<OpeningStockDocumentDTO>(await inventoryApi.createOpeningStockDocument(payload));

      if (postAfterSave) {
        await inventoryApi.postOpeningStockDocument(saved.id);
      }
      await loadPageData();
      resetForm();
      setResult({
        type: 'success',
        message: postAfterSave
          ? `Opening Stock Document ${getOpeningStockDocumentRef(saved.id)} posted successfully.`
          : `Opening Stock Document ${getOpeningStockDocumentRef(saved.id)} saved as draft.`,
      });
    } catch (error) {
      console.error('Failed to create Opening Stock Document', error);
      setResult({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSavingDraft(false);
      setPostingNew(false);
    }
  };

  const postExistingDraft = async (documentId: string, confirmedInventoryOnly = false) => {
    try {
      const document = documents.find((entry) => entry.id === documentId);
      if (accountingEnabled && document && !document.createAccountingEffect && !confirmedInventoryOnly) {
        setConfirmState({ kind: 'inventory-only-post-existing', documentId });
        return;
      }

      setPostingExistingId(documentId);
      setResult({ type: 'info', message: `Posting Opening Stock Document ${getOpeningStockDocumentRef(documentId)}...` });
      await inventoryApi.postOpeningStockDocument(documentId);
      await loadPageData();
      setResult({ type: 'success', message: `Opening Stock Document ${getOpeningStockDocumentRef(documentId)} posted successfully.` });
    } catch (error) {
      console.error('Failed to post Opening Stock Document', error);
      setResult({ type: 'error', message: getErrorMessage(error) });
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
      setResult({ type: 'info', message: `Deleting Opening Stock Document ${getOpeningStockDocumentRef(documentId)} draft...` });
      await inventoryApi.deleteOpeningStockDocument(documentId);
      await loadPageData();
      if (editingDocumentId === documentId) {
        resetForm();
      }
      setResult({ type: 'success', message: `Opening Stock Document ${getOpeningStockDocumentRef(documentId)} draft deleted.` });
    } catch (error) {
      console.error('Failed to delete Opening Stock Document', error);
      setResult({ type: 'error', message: getErrorMessage(error) });
    }
    finally {
      setDeletingDraftId(null);
    }
  };

  const confirmDialogConfig = useMemo(() => {
    if (!confirmState) return null;

    switch (confirmState.kind) {
      case 'inventory-only-post-new':
        return {
          title: 'Post as Inventory Only?',
          message: (
            <>
              <p>Accounting is enabled for this company, but this Opening Stock Document is set to inventory-only.</p>
              <p className="mt-3">Posting will change stock quantities and inventory values without creating any accounting entry.</p>
            </>
          ),
          confirmLabel: 'Continue Posting',
          cancelLabel: 'Keep Editing',
          tone: 'warning' as const,
          icon: <AlertCircle className="h-5 w-5" />,
          isConfirming: postingNew,
        };
      case 'inventory-only-post-existing':
        return {
          title: 'Post as Inventory Only?',
          message: (
            <>
              <p>
                <span className="font-black">{getOpeningStockDocumentRef(confirmState.documentId)}</span> is set to inventory-only.
              </p>
              <p className="mt-3">Posting will change stock quantities and inventory values without creating any accounting entry.</p>
            </>
          ),
          confirmLabel: 'Continue Posting',
          cancelLabel: 'Cancel',
          tone: 'warning' as const,
          icon: <AlertCircle className="h-5 w-5" />,
          isConfirming: postingExistingId === confirmState.documentId,
        };
      case 'delete-draft':
        return {
          title: 'Delete Draft?',
          message: (
            <>
              <p>
                Delete <span className="font-black">{getOpeningStockDocumentRef(confirmState.documentId)}</span>?
              </p>
              <p className="mt-3">This removes the draft document only. Posted documents stay locked and cannot be deleted.</p>
            </>
          ),
          confirmLabel: 'Delete Draft',
          cancelLabel: 'Keep Draft',
          tone: 'danger' as const,
          icon: <Trash2 className="h-5 w-5" />,
          isConfirming: deletingDraftId === confirmState.documentId,
        };
      default:
        return null;
    }
  }, [confirmState, deletingDraftId, postingExistingId, postingNew]);

  const handleConfirmDialogConfirm = () => {
    if (!confirmState) return;

    const currentState = confirmState;
    setConfirmState(null);
    switch (currentState.kind) {
      case 'inventory-only-post-new':
        void saveDocument(true, true);
        break;
      case 'inventory-only-post-existing':
        void postExistingDraft(currentState.documentId, true);
        break;
      case 'delete-draft':
        void deleteDraft(currentState.documentId, true);
        break;
      default:
        break;
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-6">
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-100 p-3">
            <Package className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Opening Stock Documents</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Record stock that already exists physically at go-live or migration. This is not a purchase, GRN, or purchase invoice.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadPageData}
          disabled={loadingPage}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loadingPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Accounting Status</h2>
          <p className="mt-2 text-sm text-slate-700">
            {modulesLoading
              ? 'Checking whether the Accounting module is initialized...'
              : accountingEnabled
              ? 'Accounting is enabled. Each Opening Stock Document can be inventory-only or inventory + accounting.'
              : 'Accounting is disabled. This operation will affect stock quantities only and will not create any accounting entry.'}
          </p>
        </Card>
        <Card className="border-slate-200 p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Core Rules</h2>
          <p className="mt-2 text-sm text-slate-700">
            Only active stock-tracked items are selectable here. Warehouse is required. Quantity must be greater than zero. Multiple documents are supported.
          </p>
        </Card>
      </div>

      {result && (
        <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
          result.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : result.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          {result.message}
        </div>
      )}

      <Card className="border-slate-200">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {editingDocumentId ? `Editing Draft ${getOpeningStockDocumentRef(editingDocumentId)}` : 'New Opening Stock Document'}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {editingDocumentId
                  ? 'Drafts are editable. Posted documents are locked and should be corrected through reversal or inventory adjustment.'
                  : 'Save draft or create and post immediately. Accounting effect stays optional per document.'}
              </p>
            </div>
            {editingDocumentId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>
        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Warehouse</label>
              <WarehouseSelector value={form.warehouseId} warehouses={warehouses} onChange={(warehouse) => setForm((prev) => ({ ...prev, warehouseId: warehouse?.id || '' }))} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Document Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Total Value ({baseCurrency})</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800">{documentValueBase.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={4} placeholder="Optional migration batch or cutover note..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Create Accounting Effect</label>
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, createAccountingEffect: false, openingBalanceAccountId: '' }))} className={`rounded-lg px-4 py-2 text-sm font-bold ${!form.createAccountingEffect ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>No</button>
                  <button type="button" disabled={!accountingEnabled} onClick={() => accountingEnabled && setForm((prev) => ({ ...prev, createAccountingEffect: true }))} className={`rounded-lg px-4 py-2 text-sm font-bold ${form.createAccountingEffect && accountingEnabled ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'}`}>Yes</button>
                </div>
              </div>
              {!accountingEnabled && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This operation will affect stock quantities only and will not create any accounting entry.
                </div>
              )}
              {accountingEnabled && !form.createAccountingEffect && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Accounting is enabled, but this document is currently set to inventory-only. Posting will change stock quantities and inventory values without creating any accounting entry.
                </div>
              )}
              {accountingEnabled && form.createAccountingEffect && (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Opening Balance / Clearing Account</label>
                    <AccountSelector value={form.openingBalanceAccountId} onChange={(account) => setForm((prev) => ({ ...prev, openingBalanceAccountId: account?.id || '' }))} placeholder="Search opening balance or clearing account..." />
                    <p className="mt-2 text-xs text-slate-500">Posting debits Inventory Asset and credits this account.</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Inventory Asset is resolved from item, then category, then Inventory Settings. Posting is blocked if any required account is missing.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Document Lines</h3>
                <p className="mt-1 text-sm text-slate-600">Item search is filtered to stock-tracked inventory items only.</p>
              </div>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-100">
                <Plus className="h-4 w-4" />
                Add Line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Stock Item</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-500">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-500">Unit Cost</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-slate-500">Currency</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-500">Doc FX</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-500">Cost FX</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-500">Value ({baseCurrency})</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    return (
                      <tr key={line.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <ItemSelector value={line.itemId} trackInventoryOnly onChange={(item) => setLines((prev) => prev.map((entry) => entry.id === line.id ? { ...entry, itemId: item?.id || '', itemCostCurrency: item?.costCurrency || '', unitCostBase: undefined } : entry))} placeholder="Search stock item..." noBorder />
                          {line.itemCostCurrency && <p className="mt-2 text-[11px] font-semibold text-slate-500">Item cost currency: {line.itemCostCurrency}</p>}
                        </td>
                        <td className="px-4 py-3"><input type="number" min="0" step="0.0001" value={line.quantity || ''} onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="0.00" /></td>
                        <td className="px-4 py-3"><input type="number" min="0" step="0.0001" value={line.unitCostInMoveCurrency || ''} onChange={(e) => updateLine(line.id, 'unitCostInMoveCurrency', Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="0.00" /></td>
                        <td className="px-4 py-3"><CurrencySelector value={line.moveCurrency} onChange={(currencyCode) => updateLine(line.id, 'moveCurrency', currencyCode)} noBorder /></td>
                        <td className="px-4 py-3"><input type="number" min="0.000001" step="0.000001" value={line.fxRateMovToBase} onChange={(e) => updateLine(line.id, 'fxRateMovToBase', Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></td>
                        <td className="px-4 py-3"><input type="number" min="0.000001" step="0.000001" value={line.fxRateCCYToBase} onChange={(e) => updateLine(line.id, 'fxRateCCYToBase', Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-800">{(line.quantity * getLineUnitCostBase(line)).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length <= 1} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {duplicateWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <div className="font-black">Possible duplicate opening entry warning</div>
              <div className="mt-1">
                Existing Opening Stock Documents already contain one or more of these items in the same warehouse on the same document date:
                {' '}
                {duplicateWarnings
                  .map(({ document, overlappingItemCount }) => `${getDocumentLabel(document)} (${overlappingItemCount} overlapping item${overlappingItemCount === 1 ? '' : 's'})`)
                  .join(', ')}
                . This is warning-only; review before saving or posting.
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">{validLines.length} valid line{validLines.length === 1 ? '' : 's'} ready for this document.</div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => saveDocument(false)} disabled={savingDraft || postingNew} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingDocumentId ? 'Update Draft' : 'Save Draft'}
              </button>
              <button type="button" onClick={() => saveDocument(true)} disabled={savingDraft || postingNew} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">
                {postingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {editingDocumentId ? 'Update & Post' : 'Create & Post'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-black text-slate-900">Recent Opening Stock Documents</h2>
          <p className="mt-1 text-sm text-slate-600">Unlimited documents are supported for phased migration, multiple warehouses, or separate data-entry batches.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Document</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Warehouse</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Accounting</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-500">Value ({baseCurrency})</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Voucher</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm font-semibold text-slate-500">No Opening Stock Documents created yet.</td>
                </tr>
              )}
              {documents.map((document) => (
                <tr key={document.id} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <div className="font-black text-slate-800" title={document.id}>{getDocumentLabel(document)}</div>
                    <div className="mt-1 text-xs text-slate-500">{document.date} · {document.lines.length} line{document.lines.length === 1 ? '' : 's'}</div>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">{warehouseNameById.get(document.warehouseId) || document.warehouseId}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] ${document.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{document.status}</span></td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                    <div>{document.createAccountingEffect ? 'Inventory + Accounting' : 'Inventory only'}</div>
                    {document.createAccountingEffect && document.openingBalanceAccountId && (
                      <div className="mt-1 text-xs text-slate-500">
                        Offset: {getAccountLabel(document.openingBalanceAccountId)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-black text-slate-800">{document.totalValueBase.toFixed(2)}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                    {document.voucherId ? (
                      <div>
                        <Link className="font-black text-indigo-700 hover:underline" to={`/accounting/vouchers/${document.voucherId}/view`}>
                          {getVoucherLabel(document)}
                        </Link>
                        <div className="mt-1 text-xs text-slate-500">Linked accounting voucher</div>
                      </div>
                    ) : (
                      'No voucher'
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {document.status === 'DRAFT' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => loadDraftIntoForm(document)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteDraft(document.id)} disabled={deletingDraftId === document.id} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                          Delete
                        </button>
                        <button type="button" onClick={() => postExistingDraft(document.id)} disabled={postingExistingId === document.id} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50">
                          {postingExistingId === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Post
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <AlertCircle className="h-4 w-4" />
        Draft documents can be edited or deleted. Posted documents are locked; use reversal or inventory adjustment to correct them. Accounting entries remain optional per document and use the existing voucher posting engine.
      </div>
    </div>
  );
};

export default OpeningStockPage;
