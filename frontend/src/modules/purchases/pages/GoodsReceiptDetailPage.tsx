import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  GoodsReceiptDTO,
  GoodsReceiptLineInputDTO,
  PurchaseInvoiceDTO,
  PurchaseOrderDTO,
  PurchaseSettingsDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { ItemSelector, PartySelector, UomSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { buildItemUomOptions, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { Truck } from 'lucide-react';
import {
  DocumentDetailScaffold,
  DocumentFooterTotalsStrip,
  DocumentHeaderField,
  DocumentHeaderGrid,
  DocumentPill,
  DocumentRailChecklist,
  DocumentRailKeyValueList,
  DocumentRailTotals,
  DocumentScaffoldRailSections,
  documentHeaderControlClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  poLineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  receivedQty: number;
  uomId?: string;
  uom: string;
  warehouseId?: string;
  description?: string;
}

interface EditableForm {
  purchaseOrderId: string;
  vendorId: string;
  receiptDate: string;
  warehouseId: string;
  notes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  receivedQty: 1,
  uomId: undefined,
  uom: '',
  warehouseId: undefined,
  description: '',
});

const createEmptyForm = (purchaseOrderId = '', vendorId = '', warehouseId = ''): EditableForm => ({
  purchaseOrderId,
  vendorId,
  receiptDate: todayIso(),
  warehouseId,
  notes: '',
  lines: [createEmptyLine()],
});

const GoodsReceiptDetailPage: React.FC = () => { 
  const { t } = useTranslation(['purchases', 'common']);
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const initialPurchaseOrderId = searchParams.get('purchaseOrderId') || '';
  const initialVendorId = searchParams.get('vendorId') || '';

  const [grn, setGrn] = useState<GoodsReceiptDTO | null>(null);
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialPurchaseOrderId, initialVendorId));
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingPOLines, setLoadingPOLines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLinkedInvoiceLine, setHasLinkedInvoiceLine] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [unpostConfirmOpen, setUnpostConfirmOpen] = useState(false);
  const [linkedPO, setLinkedPO] = useState<PurchaseOrderDTO | null>(null);

  const warehouseLabelById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const roundQty = (value: number): number => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

  const getLineItemLabel = (line: { itemId: string; itemCode?: string; itemName?: string }): string => {
    const code = line.itemCode || itemById[line.itemId]?.code;
    const name = line.itemName || itemById[line.itemId]?.name;
    if (code && name) return `${code} - ${name}`;
    return name || code || line.itemId;
  };

  const mapOpenPOLinesToEditable = (
    po: PurchaseOrderDTO,
    fallbackWarehouseId?: string
  ): EditableLine[] =>
    po.lines
      .filter((line) => line.trackInventory && line.orderedQty - line.receivedQty > 0)
      .map((line) => ({
        poLineId: line.lineId,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        receivedQty: roundQty(Math.max(line.orderedQty - line.receivedQty, 0)),
        uomId: line.uomId,
        uom: line.uom || itemById[line.itemId]?.purchaseUom || itemById[line.itemId]?.baseUom || 'EA',
        warehouseId: line.warehouseId || fallbackWarehouseId,
        description: line.description,
      }));

  const loadOpenLinesFromPO = async (poId?: string, silent = false, fallbackWarehouseId?: string) => {
    const targetPOId = (poId || form.purchaseOrderId || '').trim();
    if (!targetPOId) {
      if (!silent) setError(t('goodsReceiptDetail.errors.poReferenceRequired', 'Please enter a PO reference first.'));
      return;
    }

    try {
      setLoadingPOLines(true);
      setError(null);

      const result = await purchasesApi.getPO(targetPOId);
      const po = unwrap<PurchaseOrderDTO>(result);
      const mappedLines = mapOpenPOLinesToEditable(
        po,
        fallbackWarehouseId || form.warehouseId || settings?.defaultWarehouseId
      );

      setForm((prev) => ({
        ...prev,
        purchaseOrderId: targetPOId,
        vendorId: po.vendorId || prev.vendorId,
        lines: mappedLines.length > 0 ? mappedLines : [createEmptyLine()],
      }));

      if (!mappedLines.length && !silent) {
        setError(t('goodsReceiptDetail.errors.noOpenStockLines', 'No open stock lines found on this PO.'));
      }
    } catch (err: any) {
      console.error('Failed to load PO lines', err);
      if (!silent) {
        setError(
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            t('goodsReceiptDetail.errors.loadPoLinesFailed', 'Failed to load lines from PO.')
        );
      }
    } finally {
      setLoadingPOLines(false);
    }
  };

  const loadReferenceData = async () => {
    const [settingsResult, warehouseResult, itemResult] = await Promise.all([
      purchasesApi.getSettings(),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
      inventoryApi.listItems({ limit: 1000 }),
    ]);

    const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);

    setSettings(currentSettings);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    setItems(Array.isArray(itemList) ? itemList : []);

    return currentSettings;
  };

  const ensureItemUomOptions = async (itemId: string) => {
    if (!itemId || uomOptionsByItemId[itemId] || !itemById[itemId]) return;
    try {
      const result = await inventoryApi.listUomConversions(itemId);
      const conversions = unwrap<UomConversionDTO[]>(result) || [];
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], conversions),
      }));
    } catch (loadError) {
      console.error('Failed to load UOM conversions', loadError);
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], []),
      }));
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentSettings = await loadReferenceData();
      const defaultWarehouseId = currentSettings?.defaultWarehouseId || '';

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getGRN(params.id);
        const loaded = unwrap<GoodsReceiptDTO>(result);
        setGrn(loaded);

        if (loaded.purchaseOrderId) {
          try {
            const poResult = await purchasesApi.getPO(loaded.purchaseOrderId);
            setLinkedPO(unwrap<PurchaseOrderDTO>(poResult));
          } catch {
            setLinkedPO(null);
          }

          const invoicesResult = await purchasesApi.listPIs({
            purchaseOrderId: loaded.purchaseOrderId,
            limit: 200,
          });
          const invoices = unwrap<PurchaseInvoiceDTO[]>(invoicesResult);
          const grnLineIdSet = new Set(loaded.lines.map((line) => line.lineId));
          const linked = (Array.isArray(invoices) ? invoices : []).some((invoice) =>
            invoice.lines.some((line) => line.grnLineId && grnLineIdSet.has(line.grnLineId))
          );
          setHasLinkedInvoiceLine(linked);
        } else {
          setLinkedPO(null);
          setHasLinkedInvoiceLine(false);
        }
      } else {
        setGrn(null);
        setLinkedPO(null);
        setHasLinkedInvoiceLine(false);
        setForm(createEmptyForm(initialPurchaseOrderId, initialVendorId, defaultWarehouseId));
        if (initialPurchaseOrderId) {
          await loadOpenLinesFromPO(initialPurchaseOrderId, true);
        }
      }
    } catch (err: any) {
      console.error('Failed to load goods receipt detail', err);
      setError(
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goodsReceiptDetail.errors.loadFailed', 'Failed to load goods receipt.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((isCreateMode || isEditMode) && form.lines.length === 0) {
      setForm((prev) => ({ ...prev, lines: [createEmptyLine()] }));
    }
  }, [form.lines.length, isCreateMode, isEditMode]);

  useEffect(() => {
    const ids = Array.from(new Set(form.lines.map((line) => line.itemId).filter(Boolean)));
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };

      if (patch.itemId !== undefined) {
        const item = itemById[patch.itemId];
        if (item) {
          const defaultUom = getDefaultItemUomOption(item, 'purchase');
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uomId = next.uomId || defaultUom?.uomId;
          next.uom = next.uom || defaultUom?.code || item.purchaseUom || item.baseUom;
          if (!next.warehouseId && settings?.defaultWarehouseId) {
            next.warehouseId = settings.defaultWarehouseId;
          }
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
        }
      }

      lines[index] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((_, idx) => idx !== index),
      };
    });
  };

  const validateBeforeSave = (): string | null => {
    if (!form.receiptDate) return t('goodsReceiptDetail.validation.receiptDateRequired', 'Receipt date is required.');
    if (!form.warehouseId) return t('goodsReceiptDetail.validation.warehouseRequired', 'Warehouse is required.');
    if (!form.purchaseOrderId && !form.vendorId) return t('goodsReceiptDetail.validation.vendorRequiredWithoutPo', 'Vendor is required when PO is not provided.');

    const activeLines = form.lines.filter((line) => line.itemId || line.poLineId);

    if (!form.purchaseOrderId) {
      if (!activeLines.length) return t('goodsReceiptDetail.validation.directLinesRequired', 'At least one line is required for direct goods receipts.');
      for (let i = 0; i < form.lines.length; i += 1) {
        const line = form.lines[i];
        if (!line.itemId) return t('goodsReceiptDetail.validation.lineItemRequired', 'Line {{lineNum}}: item is required.', { lineNum: i + 1 });
        if (Number.isNaN(line.receivedQty) || line.receivedQty <= 0) {
          return t('goodsReceiptDetail.validation.lineReceivedQtyPositive', 'Line {{lineNum}}: received quantity must be greater than 0.', { lineNum: i + 1 });
        }
      }
    } else if (activeLines.length > 0) {
      for (let i = 0; i < form.lines.length; i += 1) {
        const line = form.lines[i];
        if (!line.itemId && !line.poLineId) continue;
        if (!line.itemId) return t('goodsReceiptDetail.validation.lineItemRequired', 'Line {{lineNum}}: item is required.', { lineNum: i + 1 });
        if (Number.isNaN(line.receivedQty) || line.receivedQty <= 0) {
          return t('goodsReceiptDetail.validation.lineReceivedQtyPositive', 'Line {{lineNum}}: received quantity must be greater than 0.', { lineNum: i + 1 });
        }
      }
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): GoodsReceiptLineInputDTO => {
    const item = itemById[line.itemId];
    const payload = {
      lineId: line.lineId,
      lineNo: index + 1,
      poLineId: line.poLineId || undefined,
      itemId: line.itemId || undefined,
      receivedQty: line.receivedQty,
      uomId: line.uomId,
      uom: line.uom || item?.purchaseUom || item?.baseUom || 'EA',
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
    return payload;
  };

  const saveDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const mappedLines = form.lines
        .filter((line) => line.itemId && line.receivedQty > 0)
        .map((line, index) => buildLinePayload(line, index));

      if (isCreateMode) {
        const created = await purchasesApi.createGRN({
          purchaseOrderId: form.purchaseOrderId || undefined,
          vendorId: form.purchaseOrderId ? undefined : form.vendorId || undefined,
          receiptDate: form.receiptDate,
          warehouseId: form.warehouseId,
          lines: mappedLines.length ? mappedLines : undefined,
          notes: form.notes || undefined,
        });

        const dto = unwrap<GoodsReceiptDTO>(created);
        navigate(`/purchases/goods-receipts/${dto.id}`, { replace: true });
      } else if (grn?.id) {
        const updated = await purchasesApi.updateGRN(grn.id, {
          vendorId: form.purchaseOrderId ? undefined : form.vendorId || undefined,
          receiptDate: form.receiptDate,
          warehouseId: form.warehouseId,
          lines: mappedLines.length ? mappedLines : undefined,
          notes: form.notes || undefined,
        });
        setGrn(unwrap<GoodsReceiptDTO>(updated));
        setIsEditMode(false);
      }
    } catch (err: any) {
      console.error('Failed to save goods receipt', err);
      setError(
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goodsReceiptDetail.errors.saveDraftFailed', 'Failed to save draft GRN.')
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleEdit = () => {
    if (!grn) return;
    const editableLines = grn.lines.map((l) => ({
      lineId: l.lineId,
      poLineId: l.poLineId,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      receivedQty: l.receivedQty,
      uomId: l.uomId,
      uom: l.uom,
      warehouseId: grn.warehouseId,
      description: l.description,
    }));

    setForm({
      purchaseOrderId: grn.purchaseOrderId || '',
      vendorId: grn.vendorId || '',
      receiptDate: grn.receiptDate,
      warehouseId: grn.warehouseId,
      notes: grn.notes || '',
      lines: editableLines.length > 0 ? editableLines : [createEmptyLine()],
    });
    setIsEditMode(true);

    if (grn.purchaseOrderId && editableLines.length === 0) {
      void loadOpenLinesFromPO(grn.purchaseOrderId, true, grn.warehouseId);
    }
  };

  const postDraft = async () => {
    if (!grn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await purchasesApi.postGRN(grn.id);
      setGrn(unwrap<GoodsReceiptDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post goods receipt', err);
      setError(
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goodsReceiptDetail.errors.postFailed', 'Failed to post goods receipt.')
      );
    } finally {
      setBusy(false);
    }
  };

  const unpostGRN = async () => {
    if (!grn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const unposted = await purchasesApi.unpostGRN(grn.id);
      setGrn(unwrap<GoodsReceiptDTO>(unposted));
      setUnpostConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to unpost goods receipt', err);
      setError(
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goodsReceiptDetail.errors.unpostFailed', 'Failed to unpost goods receipt.')
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("auto.GoodsReceiptDetailPage.goodsReceipt", "Goods Receipt")}</h1>
        <Card className="p-6">{t("auto.GoodsReceiptDetailPage.loadingGoodsReceipt", "Loading goods receipt...")}</Card>
      </div>
    );
  }

  const hasUnsavedDocumentChanges = (() => {
    if (!(isCreateMode || isEditMode)) return false;
    const hasLines = form.lines.some((line) =>
      Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.uomId || line.uom)
    );
    return Boolean(
      form.purchaseOrderId ||
      form.vendorId ||
      form.notes.trim() ||
      hasLines
    );
  })();

  const openNewGoodsReceiptForm = () => {
    setGrn(null);
    setForm(createEmptyForm('', '', ''));
    setIsEditMode(false);
    setError(null);
    navigate('/purchases/goods-receipts/new');
  };

  if (isCreateMode || isEditMode) {
    const receivedQtyTotal = form.lines.reduce((sum, line) => sum + (Number(line.receivedQty) || 0), 0);
    const draftRailSections: DocumentScaffoldRailSections = {
      info: {
        title: t('goodsReceiptDetail.rail.info', 'Info'),
        action: <DocumentPill tone={form.purchaseOrderId ? 'blue' : 'slate'}>{form.purchaseOrderId ? t('goodsReceiptDetail.rail.po', 'PO') : t('goodsReceiptDetail.rail.direct', 'Direct')}</DocumentPill>,
        content: (
          <DocumentRailKeyValueList
            items={[
              { label: t('goodsReceiptDetail.labels.lines', 'Lines'), value: form.lines.length },
              { label: t('goodsReceiptDetail.labels.receivedQty', 'Received Qty'), value: receivedQtyTotal.toFixed(2) },
              { label: t('goodsReceiptDetail.labels.warehouse', 'Warehouse'), value: form.warehouseId || '-' },
            ]}
          />
        ),
      },
      readiness: {
        title: t('goodsReceiptDetail.rail.documentStatus', 'Document Status'),
        content: (
          <DocumentRailChecklist
            items={[
              { state: 'info', label: t('goodsReceiptDetail.labels.draftReceiptPostingWillUpdateInventoryReceiptStateThroughTheExistingPurchaseFlow', 'Draft receipt. Posting will update inventory receipt state through the existing purchase flow.') },
              ...(form.purchaseOrderId
                ? [{ state: 'info' as const, label: t('goodsReceiptDetail.labels.sourcePOLinesCanBeLoadedIntoThisReceipt', 'Source PO lines can be loaded into this receipt.') }]
                : []),
            ]}
          />
        ),
      },
      totals: {
        title: t('goodsReceiptDetail.rail.totals', 'Totals'),
        content: (
          <DocumentRailTotals
            rows={[
              { label: t('goodsReceiptDetail.labels.lines', 'Lines'), value: form.lines.length },
              { label: t('goodsReceiptDetail.labels.receiptDate', 'Receipt Date'), value: form.receiptDate || '-' },
            ]}
            grand={{ label: t('goodsReceiptDetail.labels.receivedQty', 'Received Qty'), value: receivedQtyTotal.toFixed(2) }}
          />
        ),
      },
    };

    return (
      <DocumentDetailScaffold
        title={isCreateMode ? t('goodsReceiptDetail.labels.newGoodsReceipt', 'New Goods Receipt') : t('goodsReceiptDetail.labels.editGoodsReceipt', 'Edit {{number}}', { number: grn?.grnNumber })}
        subtitle={t('goodsReceiptDetail.subtitle', 'Warehouse receiving document. Posting records received stock through the existing Purchases flow.')}
        icon={Truck}
        backLabel={isEditMode ? t('goodsReceiptDetail.labels.cancelEdit', 'Cancel edit') : t('goodsReceiptDetail.labels.backToGoodsReceipts', 'Back to goods receipts')}
        onBack={() => (isEditMode ? setIsEditMode(false) : navigate('/purchases/goods-receipts'))}
        badges={<DocumentPill tone="slate">{t("auto.GoodsReceiptDetailPage.draft", "Draft")}</DocumentPill>}
        railSections={draftRailSections}
        railTitle={t('goodsReceiptDetail.rail.title', 'Goods receipt side rail')}
        newAction={{
          label: t('goodsReceiptDetail.labels.newGoodsReceipt', 'New Goods Receipt'),
          title: t('goodsReceiptDetail.labels.newGoodsReceipt', 'New Goods Receipt'),
          hasUnsavedChanges: hasUnsavedDocumentChanges,
          onNew: openNewGoodsReceiptForm,
        }}
        footerSections={{
          totals: {
            content: (
          <DocumentFooterTotalsStrip
            totals={[
              { label: t('goodsReceiptDetail.labels.lines', 'Lines'), value: form.lines.length },
              { label: t('goodsReceiptDetail.labels.received', 'Received'), value: receivedQtyTotal.toFixed(2), tone: 'green' },
            ]}
          />
            ),
          },
          actions: {
            content: (
          <button
            type="button"
            className="rounded bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            onClick={saveDraft}
            disabled={busy}
          >
            {busy ? t('common.saving', 'Saving...') : (isCreateMode ? t('goodsReceiptDetail.labels.createDraftGrn', 'Create Draft GRN') : t('goodsReceiptDetail.labels.updateDraft', 'Update Draft'))}
          </button>
            ),
          },
        }}
        sections={{
          banner: {
            content: error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null,
          },
          header: {
            content: (
        <Card className="overflow-visible p-0">
          <DocumentHeaderGrid>
            <DocumentHeaderField label={t('goodsReceiptDetail.labels.poReference', 'PO Reference')}>
              <input
                type="text"
                className={documentHeaderControlClass}
                value={form.purchaseOrderId}
                onChange={(e) => setForm((prev) => ({ ...prev, purchaseOrderId: e.target.value }))}
                placeholder={t("auto.GoodsReceiptDetailPage.purchaseOrderId", "purchaseOrderId")}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label={t('goodsReceiptDetail.labels.vendorStandaloneOnly', 'Vendor (standalone only)')}>
              <PartySelector 
                className={documentHeaderSelectorClass}
                value={form.vendorId}
                disabled={!!form.purchaseOrderId}
                onChange={(party) => {
                  setForm((prev) => ({
                    ...prev,
                    vendorId: party?.id || '',
                  }));
                }}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label={t('goodsReceiptDetail.labels.receiptDate', 'Receipt Date')}>
              <DatePicker 
                className="w-full"
                inputClassName={documentHeaderControlClass}
                value={form.receiptDate}
                onChange={(val) => setForm((prev) => ({ ...prev, receiptDate: val }))}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label={t('goodsReceiptDetail.labels.warehouse', 'Warehouse')}>
              <WarehouseSelector
                className={documentHeaderSelectorClass}
                value={form.warehouseId}
                onChange={(warehouse) => setForm((prev) => ({ ...prev, warehouseId: warehouse?.id || '' }))}
              />
            </DocumentHeaderField>
          </DocumentHeaderGrid>

          <div className="px-3 pb-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t("auto.GoodsReceiptDetailPage.notes", "Notes")}</label>
            <textarea
              rows={3}
              className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="px-3 pb-3 text-xs text-slate-500">{t("auto.GoodsReceiptDetailPage.ifPOIsProvidedLinesArePreFilled", "If PO is provided, lines are pre-filled from open stock lines using server-side rules.")}</div>
        </Card>
            ),
          },
          lines: {
            content: (
        <ClassicLineItemsTable<EditableLine>
          tableId="purchases.goodsReceipt.lines"
          title={t('goodsReceiptDetail.labels.lineItems', 'Line Items')}
          headerAction={
            form.purchaseOrderId ? (
              <button
                type="button"
                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700 disabled:opacity-50"
                onClick={() => loadOpenLinesFromPO()}
                disabled={busy || loadingPOLines}
              >
                {loadingPOLines ? t('common.loading', 'Loading...') : t('goodsReceiptDetail.labels.loadPoLines', 'Load PO Lines')}
              </button>
            ) : undefined
          }
          rows={form.lines}
          disabled={busy}
          onRowChange={setLine}
          onRowRemove={!form.purchaseOrderId ? removeLine : undefined}
          onRowsChange={!form.purchaseOrderId ? (lines) => setForm((prev) => ({ ...prev, lines })) : undefined}
          createEmptyRow={createEmptyLine}
          isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.warehouseId)}
          onRowAdd={!form.purchaseOrderId ? addLine : undefined}
          addLabel={t('goodsReceiptDetail.labels.addItem', 'Add Item')}
          minTableWidth="860px"
          columns={[
            {
              id: 'item',
              label: t('goodsReceiptDetail.labels.item', 'Item'),
              kind: 'custom',
              width: '280px',
              render: (line, index) => (
                <ItemSelector
                  value={line.itemId}
                  disabled={!!form.purchaseOrderId || busy}
                  noBorder
                  placeholder={t("auto.GoodsReceiptDetailPage.selectItem", "Select item")}
                  trackInventoryOnly
                  onChange={(item) => {
                    if (!item) {
                      setLine(index, { itemId: '', itemCode: undefined, itemName: undefined });
                      return;
                    }
                    const defaultUom = getDefaultItemUomOption(item, 'purchase');
                    setLine(index, {
                      itemId: item.id,
                      itemCode: item.code,
                      itemName: item.name,
                      uomId: defaultUom?.uomId,
                      uom: defaultUom?.code || item.purchaseUom || item.baseUom,
                    });
                  }}
                />
              ),
            } as ColumnDef<EditableLine>,
            { id: 'receivedQty', label: t('goodsReceiptDetail.labels.receivedQty', 'Received Qty'), kind: 'number', width: '130px', accessor: (line) => line.receivedQty, setter: (value) => ({ receivedQty: Number(value) }) },
            {
              id: 'uom',
              label: t('goodsReceiptDetail.labels.uOM', 'UOM'),
              kind: 'custom',
              width: '110px',
              render: (line, index) => (
                <UomSelector
                  item={itemById[line.itemId]}
                  itemId={line.itemId}
                  valueId={line.uomId}
                  valueCode={line.uom}
                  usage="purchase"
                  disabled={!line.itemId || busy}
                  noBorder
                  onChange={(selected) => setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' })}
                />
              ),
            },
            {
              id: 'warehouse',
              label: t('goodsReceiptDetail.labels.warehouse', 'Warehouse'),
              kind: 'custom',
              width: '220px',
              render: (line, index) => (
                <WarehouseSelector
                  value={line.warehouseId}
                  disabled={busy}
                  noBorder
                  placeholder={t("auto.GoodsReceiptDetailPage.selectWarehouse", "Select Warehouse")}
                  onChange={(warehouse) => setLine(index, { warehouseId: warehouse?.id })}
                />
              ),
            },
          ]}
        />
            ),
          },
        }}
      />
    );
  }

  if (!grn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("auto.GoodsReceiptDetailPage.goodsReceipt2", "Goods Receipt")}</h1>
        <Card className="p-6 text-sm text-red-700">{t("auto.GoodsReceiptDetailPage.goodsReceiptNotFound", "Goods receipt not found.")}</Card>
      </div>
    );
  }

  const canCreateReturn = grn.status === 'POSTED'
    && !!settings?.requirePOForStockItems
    && !hasLinkedInvoiceLine;
  const createReturnHref = `/purchases/returns/new?goodsReceiptId=${encodeURIComponent(grn.id)}${
    grn.purchaseOrderId ? `&purchaseOrderId=${encodeURIComponent(grn.purchaseOrderId)}` : ''
  }`;

  const viewReceivedQtyTotal = grn.lines.reduce((sum, line) => sum + (line.receivedQty || 0), 0);
  const viewRailSections: DocumentScaffoldRailSections = {
    info: {
      title: t('goodsReceiptDetail.rail.info', 'Info'),
      action: <DocumentPill tone={grn.purchaseOrderId ? 'blue' : 'slate'}>{grn.purchaseOrderId ? t('goodsReceiptDetail.rail.po', 'PO') : t('goodsReceiptDetail.rail.direct', 'Direct')}</DocumentPill>,
      content: (
        <DocumentRailKeyValueList
          items={[
            { label: t('goodsReceiptDetail.labels.vendor', 'Vendor'), value: grn.vendorName },
            { label: t('goodsReceiptDetail.labels.purchaseOrder', 'Purchase Order'), value: grn.purchaseOrderId ? linkedPO?.orderNumber || grn.purchaseOrderId : '-' },
          ]}
        />
      ),
    },
    totals: {
      title: t('goodsReceiptDetail.rail.totals', 'Totals'),
      content: (
        <DocumentRailTotals
          rows={[
            { label: t('goodsReceiptDetail.labels.lines', 'Lines'), value: grn.lines.length },
            { label: t('goodsReceiptDetail.labels.receiptDate', 'Receipt Date'), value: grn.receiptDate || '-' },
          ]}
          grand={{ label: t('goodsReceiptDetail.labels.receivedQty', 'Received Qty'), value: viewReceivedQtyTotal.toFixed(2) }}
        />
      ),
    },
  };

  return (
    <>
    <DocumentDetailScaffold
      title={grn.grnNumber}
      subtitle={t('goodsReceiptDetail.labels.viewSubtitle', 'Vendor: {{vendor}}{{poPart}}', {
        vendor: grn.vendorName,
        poPart: grn.purchaseOrderId ? t('goodsReceiptDetail.labels.viewSubtitlePoPart', ' | PO: {{po}}', { po: linkedPO?.orderNumber || grn.purchaseOrderId }) : '',
      })}
      icon={Truck}
      backLabel={t('goodsReceiptDetail.labels.backToGoodsReceipts', 'Back to goods receipts')}
      onBack={() => navigate('/purchases/goods-receipts')}
      badges={
        <DocumentPill tone={grn.status === 'POSTED' ? 'green' : grn.status === 'CANCELLED' ? 'rose' : 'slate'}>
          {grn.status}
        </DocumentPill>
      }
      newAction={{
        label: t('goodsReceiptDetail.labels.newGoodsReceipt', 'New Goods Receipt'),
        title: t('goodsReceiptDetail.labels.newGoodsReceipt', 'New Goods Receipt'),
        hasUnsavedChanges: false,
        onNew: openNewGoodsReceiptForm,
      }}
      railSections={viewRailSections}
      railTitle={t('goodsReceiptDetail.rail.title', 'Goods receipt side rail')}
      footerSections={{
        totals: {
          content: (
            <DocumentFooterTotalsStrip
              totals={[
                { label: t('goodsReceiptDetail.labels.lines', 'Lines'), value: grn.lines.length },
                { label: t('goodsReceiptDetail.labels.received', 'Received'), value: viewReceivedQtyTotal.toFixed(2), tone: 'green' },
              ]}
            />
          ),
        },
        actions: {
          content: (
            <>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => navigate('/purchases/goods-receipts')}
              >{t("auto.GoodsReceiptDetailPage.backToList", "Back to List")}</button>
              {grn.status === 'DRAFT' && (
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  onClick={toggleEdit}
                  disabled={busy}
                >{t("auto.GoodsReceiptDetailPage.editDraft", "Edit Draft")}</button>
              )}
              {grn.status === 'DRAFT' && (
                <button
                  type="button"
                  className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  onClick={postDraft}
                  disabled={busy}
                >
                  {busy ? t('goodsReceiptDetail.labels.posting', 'Posting...') : t('goodsReceiptDetail.labels.postGrn', 'Post GRN')}
                </button>
              )}
              {grn.status === 'POSTED' && (
                <button
                  type="button"
                  className="rounded border border-indigo-300 bg-white px-4 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => navigate(createReturnHref)}
                  disabled={!canCreateReturn}
                >{t("auto.GoodsReceiptDetailPage.createReturn", "Create Return")}</button>
              )}
              {grn.status === 'POSTED' && (
                <button
                  type="button"
                  className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  onClick={() => setUnpostConfirmOpen(true)}
                  disabled={busy || hasLinkedInvoiceLine}
                  title={hasLinkedInvoiceLine ? t('goodsReceiptDetail.labels.cannotUnpostLinkedPi', 'Cannot unpost because this GRN is linked to a PI') : ""}
                >
                  {busy ? t('goodsReceiptDetail.labels.unposting', 'Unposting...') : t('goodsReceiptDetail.labels.unpostGrn', 'Unpost GRN')}
                </button>
              )}
            </>
          ),
        },
      }}
      sections={{
        banner: {
          content: error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null,
        },
        header: {
          content: (
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.GoodsReceiptDetailPage.receiptDate", "Receipt Date")}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{grn.receiptDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.GoodsReceiptDetailPage.warehouse", "Warehouse")}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {warehouseLabelById[grn.warehouseId] || grn.warehouseId}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.GoodsReceiptDetailPage.created", "Created")}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {new Date(grn.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </Card>
          ),
        },
        lines: {
          content: (
      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t("auto.GoodsReceiptDetailPage.lines", "Lines")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 text-left">{t("auto.GoodsReceiptDetailPage.item", "Item")}</th>
                <th className="py-2 px-4 text-right">{t("auto.GoodsReceiptDetailPage.receivedQty", "Received Qty")}</th>
                <th className="py-2 px-4 text-left">{t("auto.GoodsReceiptDetailPage.uOM", "UOM")}</th>
                <th className="py-2 px-4 text-right">{t("auto.GoodsReceiptDetailPage.unitCost", "Unit Cost")}</th>
                <th className="py-2 pl-4 text-left">{t("auto.GoodsReceiptDetailPage.currency", "Currency")}</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{getLineItemLabel(line)}</td>
                  <td className="py-2 px-4 text-right">{line.receivedQty}</td>
                  <td className="py-2 px-4">{line.uom}</td>
                  <td className="py-2 px-4 text-right">{line.unitCostDoc.toFixed(2)}</td>
                  <td className="py-2 pl-4">{line.moveCurrency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
          ),
        },
      }}
    />

      <ConfirmDialog
        isOpen={unpostConfirmOpen}
        title={t('goodsReceiptDetail.unpost.confirmTitle', 'Unpost Goods Receipt')}
        message={t('goodsReceiptDetail.unpost.confirmMessage', 'This will reverse all inventory movements recorded for this goods receipt. The action is auditable but cannot be undone in place. Continue?')}
        confirmLabel={t('goodsReceiptDetail.labels.unpostGrn', 'Unpost GRN')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        isConfirming={busy}
        onConfirm={unpostGRN}
        onCancel={() => { if (!busy) setUnpostConfirmOpen(false); }}
      />
    </>
  );
};

export default GoodsReceiptDetailPage;

