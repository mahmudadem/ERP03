import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { InventoryItemDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreatePurchaseOrderPayload,
  GoodsReceiptDTO,
  POStatus,
  PurchaseInvoiceDTO,
  PurchaseOrderDTO,
  PurchaseOrderLineInputDTO,
  PurchaseReturnDTO,
  purchasesApi,
  UpdatePurchaseOrderPayload,
} from '../../../api/purchasesApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { ItemSelector, PartySelector, WarehouseSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { FileText } from 'lucide-react';
import {
  DocumentDetailScaffold,
  DocumentFooterTotalsStrip,
  DocumentHeaderField,
  DocumentHeaderGrid,
  DocumentPill,
  DocumentRailStat,
  DocumentScaffoldRailSections,
  documentHeaderControlClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  orderedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
  receivedQty: number;
  invoicedQty: number;
  returnedQty: number;
}

interface EditableForm {
  id?: string;
  orderNumber?: string;
  status: POStatus;
  vendorId: string;
  vendorName?: string;
  orderDate: string;
  expectedDeliveryDate: string;
  currency: string;
  exchangeRate: number;
  notes: string;
  internalNotes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  orderedQty: 1,
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
  receivedQty: 0,
  invoicedQty: 0,
  returnedQty: 0,
});

const createEmptyForm = (): EditableForm => ({
  status: 'DRAFT',
  vendorId: '',
  orderDate: todayIso(),
  expectedDeliveryDate: '',
  currency: 'USD',
  exchangeRate: 1,
  notes: '',
  internalNotes: '',
  lines: [createEmptyLine()],
});

const statusBadgeClass = (status: POStatus): string => {
  if (status === 'DRAFT') return 'bg-slate-100 text-slate-700';
  if (status === 'CONFIRMED') return 'bg-blue-100 text-blue-700';
  if (status === 'PARTIALLY_RECEIVED') return 'bg-amber-100 text-amber-700';
  if (status === 'FULLY_RECEIVED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'CLOSED') return 'bg-emerald-100 text-emerald-700';
  return 'bg-rose-100 text-rose-700';
};

const PurchaseOrderDetailPage: React.FC = () => {
  const { company } = useCompanyAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isCreateMode = !params.id || params.id === 'new';

  const [form, setForm] = useState<EditableForm>(createEmptyForm());
  const [vendors, setVendors] = useState<PartyDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relatedGRNs, setRelatedGRNs] = useState<GoodsReceiptDTO[]>([]);
  const [relatedPIs, setRelatedPIs] = useState<PurchaseInvoiceDTO[]>([]);
  const [relatedReturns, setRelatedReturns] = useState<PurchaseReturnDTO[]>([]);

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const taxById = useMemo(
    () =>
      taxCodes.reduce<Record<string, TaxCodeDTO>>((acc, taxCode) => {
        acc[taxCode.id] = taxCode;
        return acc;
      }, {}),
    [taxCodes]
  );

  const purchaseTaxCodes = useMemo(
    () => taxCodes.filter((taxCode) => taxCode.scope === 'PURCHASE' || taxCode.scope === 'BOTH'),
    [taxCodes]
  );

  const computedLines = useMemo(() => {
    return form.lines.map((line) => {
      const taxRate = line.taxCodeId ? taxById[line.taxCodeId]?.rate ?? 0 : 0;
      const lineTotalDoc = roundMoney((line.orderedQty || 0) * (line.unitPriceDoc || 0));
      const lineTotalBase = roundMoney(lineTotalDoc * (form.exchangeRate || 0));
      const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = roundMoney(lineTotalBase * taxRate);

      return {
        lineTotalDoc,
        lineTotalBase,
        taxAmountDoc,
        taxAmountBase,
      };
    });
  }, [form.exchangeRate, form.lines, taxById]);

  const totals = useMemo(() => {
    const subtotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
    const subtotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalBase, 0));
    const taxTotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    const taxTotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountBase, 0));

    return {
      subtotalDoc,
      subtotalBase,
      taxTotalDoc,
      taxTotalBase,
      grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc),
      grandTotalBase: roundMoney(subtotalBase + taxTotalBase),
    };
  }, [computedLines]);

  const toEditableForm = (po: PurchaseOrderDTO): EditableForm => ({
    id: po.id,
    orderNumber: po.orderNumber,
    status: po.status,
    vendorId: po.vendorId,
    vendorName: po.vendorName,
    orderDate: po.orderDate,
    expectedDeliveryDate: po.expectedDeliveryDate || '',
    currency: po.currency,
    exchangeRate: po.exchangeRate,
    notes: po.notes || '',
    internalNotes: po.internalNotes || '',
    lines: po.lines.map((line) => ({
      lineId: line.lineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      orderedQty: line.orderedQty,
      uomId: line.uomId,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId,
      warehouseId: line.warehouseId,
      description: line.description,
      receivedQty: line.receivedQty,
      invoicedQty: line.invoicedQty,
      returnedQty: line.returnedQty,
    })),
  });

  const loadReferenceData = async () => {
    const [vendorResult, itemResult, taxResult] = await Promise.all([
      sharedApi.listParties({ role: 'VENDOR', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
    ]);

    const vendorList = unwrap<PartyDTO[]>(vendorResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);

    setVendors(Array.isArray(vendorList) ? vendorList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setTaxCodes(Array.isArray(taxCodeList) ? taxCodeList : []);
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

  const loadOrder = async (id: string) => {
    const result = await purchasesApi.getPO(id);
    const po = unwrap<PurchaseOrderDTO>(result);
    setForm(toEditableForm(po));
    await loadRelatedDocuments(id);
  };

  const loadRelatedDocuments = async (purchaseOrderId: string) => {
    const [grnResult, invoiceResult, returnResult] = await Promise.all([
      purchasesApi.listGRNs({ purchaseOrderId, limit: 200 }),
      purchasesApi.listPIs({ purchaseOrderId, limit: 200 }),
      purchasesApi.listReturns(),
    ]);

    const grns = unwrap<GoodsReceiptDTO[]>(grnResult);
    const invoices = unwrap<PurchaseInvoiceDTO[]>(invoiceResult);
    const returns = unwrap<PurchaseReturnDTO[]>(returnResult);

    setRelatedGRNs(Array.isArray(grns) ? grns : []);
    setRelatedPIs(Array.isArray(invoices) ? invoices : []);
    setRelatedReturns(
      (Array.isArray(returns) ? returns : []).filter((entry) => entry.purchaseOrderId === purchaseOrderId)
    );
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();

      if (isCreateMode) {
        setForm(createEmptyForm());
        setRelatedGRNs([]);
        setRelatedPIs([]);
        setRelatedReturns([]);
      } else if (params.id) {
        await loadOrder(params.id);
      }
    } catch (err: any) {
      console.error('Failed to load purchase order detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('purchases.poDetail.loadFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = Array.from(new Set(form.lines.map((line) => line.itemId).filter(Boolean)));
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDraft = form.status === 'DRAFT';
  const isReadOnly = !isDraft;
  const downstreamActionQuery = form.id
    ? `purchaseOrderId=${encodeURIComponent(form.id)}&vendorId=${encodeURIComponent(form.vendorId || '')}`
    : '';
  const canReceiveGoods = form.status === 'CONFIRMED' || form.status === 'PARTIALLY_RECEIVED';
  const canCreateInvoice =
    form.status === 'CONFIRMED' || form.status === 'PARTIALLY_RECEIVED' || form.status === 'FULLY_RECEIVED';
  const canCloseOrder =
    form.status === 'CONFIRMED' || form.status === 'PARTIALLY_RECEIVED' || form.status === 'FULLY_RECEIVED';
  const canCancelOrder = form.status === 'CONFIRMED';

  const triggerLinePriceLookup = async (vendorId: string, itemId: string, qty: number, lineIndex: number) => {
    if (!vendorId || !itemId) return;
    try {
      const result = await purchasesApi.getEffectivePurchasePrice({
        vendorId,
        itemId,
        qty,
        asOfDate: form.orderDate || undefined,
      });
      if (result && result.unitPrice != null) {
        setForm(currentForm => {
          const currentLines = [...currentForm.lines];
          if (currentLines[lineIndex] && currentLines[lineIndex].itemId === itemId) {
            currentLines[lineIndex] = { ...currentLines[lineIndex], unitPriceDoc: result.unitPrice };
          }
          return { ...currentForm, lines: currentLines };
        });
      }
    } catch (err) {
      console.error('Failed to resolve effective purchase price', err);
    }
  };

  // Trigger pricing refresh when vendor changes
  useEffect(() => {
    if (!form.vendorId) return;
    form.lines.forEach((line, index) => {
      if (line.itemId) {
        void triggerLinePriceLookup(form.vendorId, line.itemId, line.orderedQty, index);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendorId]);

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
          if (!next.taxCodeId && item.defaultPurchaseTaxCodeId) {
            const defaultTax = purchaseTaxCodes.find((taxCode) => taxCode.id === item.defaultPurchaseTaxCodeId);
            if (defaultTax) next.taxCodeId = defaultTax.id;
          }
          // Trigger price lookup
          if (prev.vendorId) {
            void triggerLinePriceLookup(prev.vendorId, patch.itemId, next.orderedQty, index);
          }
        }
      } else if (patch.orderedQty !== undefined && current.itemId && prev.vendorId) {
        void triggerLinePriceLookup(prev.vendorId, current.itemId, patch.orderedQty, index);
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
      const nextLines = prev.lines.filter((_, idx) => idx !== index);
      return { ...prev, lines: nextLines };
    });
  };

  const validateBeforeSave = (): string | null => {
    if (!form.vendorId) return t('purchases.poDetail.vendorRequired');
    if (!form.orderDate) return t('purchases.poDetail.orderDateRequired');
    if (!form.currency.trim()) return t('purchases.poDetail.currencyRequired');
    if (Number.isNaN(form.exchangeRate) || form.exchangeRate <= 0) return t('purchases.poDetail.exchangeRatePositive');
    if (!form.lines.length) return t('purchases.poDetail.minLines');

    for (let i = 0; i < form.lines.length; i += 1) {
      const line = form.lines[i];
      if (!line.itemId) return t('purchases.poDetail.lineItemRequired', { lineNum: i + 1 });
      if (Number.isNaN(line.orderedQty) || line.orderedQty <= 0) return t('purchases.poDetail.lineQtyPositive', { lineNum: i + 1 });
      if (Number.isNaN(line.unitPriceDoc) || line.unitPriceDoc < 0) return t('purchases.poDetail.lineUnitPriceNonNegative', { lineNum: i + 1 });
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): PurchaseOrderLineInputDTO => {
    const item = itemById[line.itemId];
    return {
      lineId: line.lineId,
      lineNo: index + 1,
      itemId: line.itemId,
      orderedQty: line.orderedQty,
      uomId: line.uomId,
      uom: line.uom || item?.purchaseUom || item?.baseUom || 'EA',
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId || undefined,
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
  };

  const saveOrder = async (): Promise<PurchaseOrderDTO | null> => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return null;
    }

    try {
      setSaving(true);
      setError(null);

      const payloadBase = {
        vendorId: form.vendorId,
        orderDate: form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        notes: form.notes || undefined,
        internalNotes: form.internalNotes || undefined,
      };

      let saved: PurchaseOrderDTO;
      if (isCreateMode || !form.id) {
        const created = await purchasesApi.createPO(payloadBase as CreatePurchaseOrderPayload);
        saved = unwrap<PurchaseOrderDTO>(created);
        navigate(`/purchases/orders/${saved.id}`, { replace: true });
      } else {
        const updated = await purchasesApi.updatePO(form.id, payloadBase as UpdatePurchaseOrderPayload);
        saved = unwrap<PurchaseOrderDTO>(updated);
      }

      setForm(toEditableForm(saved));
      return saved;
    } catch (err: any) {
      console.error('Failed to save purchase order', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('purchases.poDetail.saveFailed')
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const withBusyAction = async (action: () => Promise<void>) => {
    try {
      setActionBusy(true);
      setError(null);
      await action();
    } catch (err: any) {
      console.error('Purchase order action failed', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('purchases.poDetail.actionFailed')
      );
    } finally {
      setActionBusy(false);
    }
  };

  const confirmOrder = async () => {
    await withBusyAction(async () => {
      let currentId = form.id;
      if (!currentId) {
        const saved = await saveOrder();
        if (!saved) return;
        currentId = saved.id;
      }

      const result = await purchasesApi.confirmPO(currentId);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
    });
  };

  const cancelOrder = async () => {
    if (!form.id) return;
    await withBusyAction(async () => {
      const result = await purchasesApi.cancelPO(form.id as string);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
    });
  };

  const closeOrder = async () => {
    if (!form.id) return;
    await withBusyAction(async () => {
      const result = await purchasesApi.closePO(form.id as string);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
    });
  };

  const deleteDraft = async () => {
    if (!form.id) {
      navigate('/purchases/orders');
      return;
    }

    await withBusyAction(async () => {
      const result = await purchasesApi.cancelPO(form.id as string);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
      navigate('/purchases/orders');
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('purchases.poDetail.title')}</h1>
        <Card className="p-6">{t('purchases.poDetail.loading')}</Card>
      </div>
    );
  }

  const footerSummary = (
    <DocumentFooterTotalsStrip
      totals={[
        { label: t('purchases.poDetail.subtotal'), value: `${form.currency} ${totals.subtotalDoc.toFixed(2)}` },
        { label: t('purchases.poDetail.tax'), value: `${form.currency} ${totals.taxTotalDoc.toFixed(2)}`, tone: 'blue' },
        { label: t('purchases.poDetail.grand'), value: `${form.currency} ${totals.grandTotalDoc.toFixed(2)}`, tone: 'green' },
      ]}
    />
  );

  const footerActions = (
    <>
      {isDraft && (
        <>
          <button
            type="button"
            className="rounded bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700"
            onClick={saveOrder}
            disabled={saving || actionBusy}
          >
            {saving ? t('purchases.poDetail.saving') : t('purchases.poDetail.save')}
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            onClick={confirmOrder}
            disabled={saving || actionBusy}
          >
            {t('purchases.poDetail.confirm')}
          </button>
          <button
            type="button"
            className="rounded border border-rose-300 bg-rose-50/50 px-4 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100/50 disabled:opacity-50"
            onClick={deleteDraft}
            disabled={saving || actionBusy}
          >
            {t('purchases.poDetail.delete')}
          </button>
        </>
      )}

      {!isDraft && (canReceiveGoods || canCreateInvoice || canCloseOrder || canCancelOrder) && (
        <>
          {canReceiveGoods && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              onClick={() => navigate(`/purchases/goods-receipts/new?${downstreamActionQuery}`)}
              disabled={!form.id}
            >
              {t('purchases.poDetail.receiveGoods')}
            </button>
          )}
          {canCreateInvoice && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              onClick={() => navigate(`/purchases/invoices/new?${downstreamActionQuery}`)}
              disabled={!form.id}
            >
              {t('purchases.poDetail.createInvoice')}
            </button>
          )}
          {canCancelOrder && (
            <button
              type="button"
              className="rounded border border-rose-300 bg-rose-50/50 px-4 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100/50 disabled:opacity-50"
              onClick={cancelOrder}
              disabled={saving || actionBusy}
            >
              {t('purchases.poDetail.cancel')}
            </button>
          )}
          {canCloseOrder && (
            <button
              type="button"
              className="rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              onClick={closeOrder}
              disabled={saving || actionBusy}
            >
              {t('purchases.poDetail.close')}
            </button>
          )}
        </>
      )}

      {!isDraft && !(canReceiveGoods || canCreateInvoice || canCloseOrder || canCancelOrder) && (
        <span className="text-xs font-semibold text-slate-500">{t('purchases.poDetail.readOnlyStatus', { status: form.status })}</span>
      )}
    </>
  );

  const railSections: DocumentScaffoldRailSections = {
    totals: {
      title: t('purchases.poDetail.orderTotals'),
      content: (
        <div className="grid grid-cols-2 gap-1.5 p-2 text-xs">
          <DocumentRailStat label={t('purchases.poDetail.subtotalWithCurrency', { currency: form.currency })} value={`${form.currency} ${totals.subtotalDoc.toFixed(2)}`} />
          <DocumentRailStat label={t('purchases.poDetail.subtotalBase')} value={totals.subtotalBase.toFixed(2)} />
          <DocumentRailStat label={t('purchases.poDetail.taxWithCurrency', { currency: form.currency })} value={`${form.currency} ${totals.taxTotalDoc.toFixed(2)}`} tone="blue" />
          <DocumentRailStat label={t('purchases.poDetail.taxBase')} value={totals.taxTotalBase.toFixed(2)} tone="blue" />
          <div className="col-span-2 rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{t('purchases.poDetail.grandTotal')}</div>
            <div className="truncate font-mono text-sm font-black text-slate-900 dark:text-slate-100">
              {form.currency} {totals.grandTotalDoc.toFixed(2)}
            </div>
            <div className="truncate font-mono text-[10px] text-slate-500">{totals.grandTotalBase.toFixed(2)} {t('purchases.poDetail.baseSuffix')}</div>
          </div>
        </div>
      ),
    },
    info: {
      title: t('purchases.poDetail.procurementStatus'),
      content: (
        <div className="space-y-1.5 p-2.5 text-xs">
          <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="font-bold text-slate-600 dark:text-slate-300">{t('purchases.poDetail.linesCount')}</span>
            <span className="font-mono font-black text-slate-900 dark:text-slate-100">{form.lines.length}</span>
          </div>
          <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="font-bold text-slate-600 dark:text-slate-300">{t('purchases.poDetail.vendor')}</span>
            <span className="max-w-[160px] truncate font-black text-slate-900 dark:text-slate-100">
              {form.vendorName || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="font-bold text-slate-600 dark:text-slate-300">{t('purchases.poDetail.workflow')}</span>
            <DocumentPill tone={isDraft ? 'slate' : form.status === 'CONFIRMED' ? 'blue' : form.status === 'CLOSED' ? 'green' : 'amber'}>
              {form.status}
            </DocumentPill>
          </div>
        </div>
      ),
    },
  };

  return (
    <DocumentDetailScaffold
      title={form.orderNumber || t('purchases.poDetail.newPurchaseOrder')}
      subtitle={t('purchases.poDetail.subtitle')}
      icon={FileText}
      backLabel={t('purchases.poDetail.backToList')}
      onBack={() => navigate('/purchases/orders')}
      badges={
        <DocumentPill tone={form.status === 'CONFIRMED' ? 'blue' : form.status === 'CLOSED' ? 'green' : form.status === 'CANCELLED' ? 'rose' : 'slate'}>
          {form.status}
        </DocumentPill>
      }
      railSections={railSections}
      railTitle={t('purchases.poDetail.sideRailTitle')}
      footerSections={{
        totals: { content: footerSummary },
        actions: { content: footerActions },
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
          <DocumentHeaderField label={t('purchases.poDetail.vendorLabel')}>
            <PartySelector 
              className={documentHeaderSelectorClass}
              value={form.vendorId}
              disabled={isReadOnly}
              onChange={(party) => {
                setForm((prev) => ({
                  ...prev,
                  vendorId: party?.id || '',
                  vendorName: party?.displayName || '',
                  currency: party?.defaultCurrency || prev.currency,
                }));
              }}
            />
          </DocumentHeaderField>
          <DocumentHeaderField label={t('purchases.poDetail.orderDate')}>
            <DatePicker 
              className="w-full"
              inputClassName={documentHeaderControlClass}
              value={form.orderDate}
              disabled={isReadOnly}
              onChange={(val) => setForm((prev) => ({ ...prev, orderDate: val }))}
            />
          </DocumentHeaderField>
          <DocumentHeaderField label={t('purchases.poDetail.expectedDelivery')}>
            <DatePicker 
              className="w-full"
              inputClassName={documentHeaderControlClass}
              value={form.expectedDeliveryDate}
              disabled={isReadOnly}
              onChange={(val) => setForm((prev) => ({ ...prev, expectedDeliveryDate: val }))}
            />
          </DocumentHeaderField>
          <DocumentHeaderField label={t('purchases.poDetail.currency')}>
            <CurrencySelector
              className={documentHeaderSelectorClass}
              value={form.currency}
              onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
              disabled={isReadOnly || saving || actionBusy}
            />
          </DocumentHeaderField>
          <DocumentHeaderField label={t('purchases.poDetail.exchangeRate')}>
            <CurrencyExchangeWidget
              currency={form.currency}
              baseCurrency={company?.baseCurrency || 'USD'}
              voucherDate={form.orderDate}
              value={form.exchangeRate}
              onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
              disabled={isReadOnly || saving || actionBusy}
            />
          </DocumentHeaderField>
        </DocumentHeaderGrid>
      </Card>
          ),
        },
        lines: {
          content: (
      <ClassicLineItemsTable<EditableLine>
        tableId="purchases.order.lines"
        title={t('purchases.poDetail.lineItems')}
        rows={form.lines}
        disabled={isReadOnly}
        onRowChange={setLine}
        onRowRemove={!isReadOnly ? removeLine : undefined}
        onRowsChange={!isReadOnly ? (lines) => setForm((prev) => ({ ...prev, lines })) : undefined}
        createEmptyRow={createEmptyLine}
        isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.taxCodeId || line.warehouseId)}
        onRowAdd={!isReadOnly ? addLine : undefined}
        addLabel={t('purchases.poDetail.addLine')}
        minTableWidth="1160px"
        columns={[
          {
            id: 'item',
            label: t('purchases.poDetail.itemColumn'),
            kind: 'custom',
            width: '260px',
            render: (line, index) => (
              <ItemSelector
                value={line.itemId}
                disabled={isReadOnly}
                noBorder
                placeholder={t('purchases.poDetail.selectItem')}
                onChange={(item) => {
                  if (!item) {
                    setLine(index, { itemId: '', itemCode: undefined, itemName: undefined });
                    return;
                  }
                  const defaultUom = getDefaultItemUomOption(item, 'purchase');
                  const defaultTax = item.defaultPurchaseTaxCodeId
                    ? purchaseTaxCodes.find((taxCode) => taxCode.id === item.defaultPurchaseTaxCodeId)
                    : undefined;
                  setLine(index, {
                    itemId: item.id,
                    itemCode: item.code,
                    itemName: item.name,
                    uomId: defaultUom?.uomId,
                    uom: defaultUom?.code || item.purchaseUom || item.baseUom,
                    taxCodeId: line.taxCodeId || defaultTax?.id,
                  });
                }}
              />
            ),
          } as ColumnDef<EditableLine>,
          { id: 'qty', label: t('purchases.poDetail.qtyColumn'), kind: 'number', width: '90px', accessor: (line) => line.orderedQty, setter: (value) => ({ orderedQty: Number(value) }) },
          {
            id: 'uom',
            label: t('purchases.poDetail.uomColumn'),
            kind: 'custom',
            width: '95px',
            render: (line, index) => (
              <select
                className="h-9 w-full border-0 bg-transparent px-2 text-xs uppercase outline-none disabled:opacity-60"
                value={
                  findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId ||
                  line.uomId ||
                  line.uom
                }
                disabled={isReadOnly || !line.itemId}
                onChange={(e) => {
                  const selected = (uomOptionsByItemId[line.itemId] || []).find(
                    (option) => (option.uomId || option.code) === e.target.value
                  );
                  setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' });
                }}
              >
                <option value="">{line.itemId ? t('purchases.poDetail.uomSelect') : t('purchases.poDetail.uomNoItem')}</option>
                {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                  <option key={option.uomId || option.code} value={option.uomId || option.code}>
                    {option.code}
                  </option>
                ))}
              </select>
            ),
          },
          { id: 'unitPrice', label: t('purchases.poDetail.unitPriceColumn'), kind: 'number', width: '115px', accessor: (line) => line.unitPriceDoc, setter: (value) => ({ unitPriceDoc: Number(value) }) },
          {
            id: 'taxCode',
            label: t('purchases.poDetail.taxCodeColumn'),
            kind: 'select',
            width: '150px',
            accessor: (line) => line.taxCodeId || '',
            setter: (value) => ({ taxCodeId: value || undefined }),
            options: [
              { value: '', label: t('purchases.poDetail.noTax') },
              ...purchaseTaxCodes.map((taxCode) => ({ value: taxCode.id, label: `${taxCode.code} (${Math.round(taxCode.rate * 100)}%)` })),
            ],
          },
          {
            id: 'warehouse',
            label: t('purchases.poDetail.warehouseColumn'),
            kind: 'custom',
            width: '190px',
            render: (line, index) => (
              <WarehouseSelector
                value={line.warehouseId}
                disabled={isReadOnly}
                noBorder
                placeholder={t('purchases.poDetail.warehousePlaceholder')}
                onChange={(warehouse) => setLine(index, { warehouseId: warehouse?.id })}
              />
            ),
          },
          { id: 'lineTotal', label: t('purchases.poDetail.lineTotalColumn'), kind: 'computed', width: '115px', compute: (_line, index) => computedLines[index]?.lineTotalDoc || 0, formatter: (value) => `${form.currency} ${Number(value).toFixed(2)}` },
          { id: 'tax', label: t('purchases.poDetail.taxColumn'), kind: 'computed', width: '100px', compute: (_line, index) => computedLines[index]?.taxAmountDoc || 0, formatter: (value) => `${form.currency} ${Number(value).toFixed(2)}` },
          { id: 'base', label: t('purchases.poDetail.lineBaseColumn'), kind: 'computed', width: '110px', compute: (_line, index) => computedLines[index]?.lineTotalBase || 0 },
          { id: 'statusQty', label: t('purchases.poDetail.statusQtyColumn'), kind: 'computed', width: '150px', align: 'left', compute: (line) => t('purchases.poDetail.statusQtyFormat', { received: line.receivedQty, invoiced: line.invoicedQty, returned: line.returnedQty }) },
        ]}
      />
          ),
        },
        secondary: {
          content: (
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('purchases.poDetail.vendorNotes')}</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.notes}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('purchases.poDetail.internalNotes')}</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.internalNotes}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, internalNotes: e.target.value }))}
            />
          </div>
        </div>
      </Card>
          ),
        },
        custom: {
          content: !isCreateMode && form.id ? (
        <Card className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('purchases.poDetail.linkedDocuments')}</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">{t('purchases.poDetail.goodsReceipts')}</div>
              <div className="space-y-2">
                {relatedGRNs.length === 0 && <div className="text-sm text-slate-500">{t('purchases.poDetail.noLinkedGRNs')}</div>}
                {relatedGRNs.map((grn) => (
                  <button
                    key={grn.id}
                    type="button"
                    className="block text-sm text-primary-700 hover:underline"
                    onClick={() => navigate(`/purchases/goods-receipts/${grn.id}`)}
                  >
                    {grn.grnNumber}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">{t('purchases.poDetail.purchaseInvoices')}</div>
              <div className="space-y-2">
                {relatedPIs.length === 0 && <div className="text-sm text-slate-500">{t('purchases.poDetail.noLinkedInvoices')}</div>}
                {relatedPIs.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    className="block text-sm text-primary-700 hover:underline"
                    onClick={() => navigate(`/purchases/invoices/${invoice.id}`)}
                  >
                    {invoice.invoiceNumber}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">{t('purchases.poDetail.purchaseReturns')}</div>
              <div className="space-y-2">
                {relatedReturns.length === 0 && <div className="text-sm text-slate-500">{t('purchases.poDetail.noLinkedReturns')}</div>}
                {relatedReturns.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="block text-sm text-primary-700 hover:underline"
                    onClick={() => navigate(`/purchases/returns/${entry.id}`)}
                  >
                    {entry.returnNumber}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
          ) : null,
        },
      }}
    />
  );
};

export default PurchaseOrderDetailPage;
