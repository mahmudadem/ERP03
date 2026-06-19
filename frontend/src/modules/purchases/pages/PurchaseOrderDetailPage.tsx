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
import { ItemSelector, PartySelector, UomSelector, WarehouseSelector, TaxCodeSelector, DiscountTypeSelector } from '../../../components/shared/selectors';
import { LinePriceSource, LinePriceSourceSelector } from '../../../components/shared/pricing/LinePriceSourceSelector';
import { createDocumentPriceOverrideMenuItems, createLinePriceOverrideMenuItems } from '../../../components/shared/pricing/createPriceOverrideMenuItems';
import { LinePriceOverrideBadge } from '../../../components/shared/pricing/LinePriceOverrideBadge';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import toast from 'react-hot-toast';
import { buildItemUomOptions, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { FileText } from 'lucide-react';
import {
  DocumentDetailScaffold,
  DocumentFooterTotalsStrip,
  DocumentHeaderField,
  DocumentHeaderGrid,
  DocumentPill,
  DocumentRailKeyValueList,
  DocumentRailTotals,
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
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
  receivedQty: number;
  invoicedQty: number;
  returnedQty: number;
  /**
   * Per-line price-source override (Task 243 Part C). Transient: stripped
   * from buildLinePayload before posting.
   */
  priceSourceOverride?: LinePriceSource | null;
  /**
   * Per-line manual lock. Transient: stripped from buildLinePayload.
   */
  priceLocked?: boolean;
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
  linePriceSource: LinePriceSource;
  notes: string;
  internalNotes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  orderedQty: 0,
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  discountType: undefined,
  discountValue: 0,
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
  linePriceSource: 'LAST_PARTY_PRICE',
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
      const grossLineTotalDoc = roundMoney((line.orderedQty || 0) * (line.unitPriceDoc || 0));
      const discountValue = Number(line.discountValue || 0);
      const discountAmountDoc = line.discountType === 'PERCENT'
        ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (discountValue / 100))))
        : line.discountType === 'AMOUNT'
          ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, discountValue)))
          : 0;
      const lineTotalDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
      const lineTotalBase = roundMoney(lineTotalDoc * (form.exchangeRate || 0));
      const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = roundMoney(lineTotalBase * taxRate);

      return {
        grossLineTotalDoc,
        discountAmountDoc,
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
    linePriceSource: 'LAST_PARTY_PRICE',
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
      discountType: line.discountType,
      discountValue: line.discountValue,
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
  const hasUnsavedDocumentChanges = useMemo(() => {
    if (isReadOnly) return false;
    const hasLines = form.lines.some((line) =>
      Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.taxCodeId || line.warehouseId || line.orderedQty || line.unitPriceDoc || line.discountValue)
    );
    return Boolean(
      form.vendorId ||
      form.expectedDeliveryDate ||
      form.notes.trim() ||
      form.internalNotes.trim() ||
      hasLines
    );
  }, [form, isReadOnly]);
  const downstreamActionQuery = form.id
    ? `purchaseOrderId=${encodeURIComponent(form.id)}&vendorId=${encodeURIComponent(form.vendorId || '')}`
    : '';
  const canReceiveGoods = form.status === 'CONFIRMED' || form.status === 'PARTIALLY_RECEIVED';
  const canCreateInvoice =
    form.status === 'CONFIRMED' || form.status === 'PARTIALLY_RECEIVED' || form.status === 'FULLY_RECEIVED';
  const canCloseOrder =
    form.status === 'CONFIRMED' || form.status === 'PARTIALLY_RECEIVED' || form.status === 'FULLY_RECEIVED';
  const canCancelOrder = form.status === 'CONFIRMED';

  const openNewOrderForm = () => {
    setForm(createEmptyForm());
    setError(null);
    navigate('/purchases/orders/new');
  };

  const triggerLinePriceLookup = async (vendorId: string, itemId: string, qty: number, lineIndex: number) => {
    if (!vendorId || !itemId) return;
    const line = form.lines[lineIndex];
    if (line?.priceLocked) return; // Task 243 Part C — locked lines never auto-resolve
    const effectiveSource: LinePriceSource = line?.priceSourceOverride ?? form.linePriceSource;
    try {
      const result = await purchasesApi.getEffectivePurchasePrice({
        vendorId,
        itemId,
        qty,
        asOfDate: form.orderDate || undefined,
        currency: form.currency,
        exchangeRate: Number(form.exchangeRate || 1),
        uomId: line?.uomId,
        uom: line?.uom,
        priceSource: effectiveSource,
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

  const refreshLinePrices = async (priceSource: LinePriceSource = form.linePriceSource) => {
    if (!form.vendorId) return;
    await Promise.all(
      form.lines.map(async (line, index) => {
        if (!line.itemId) return;
        if (line.priceLocked) return; // Task 243 Part C — locked lines never auto-resolve
        const effectiveSource: LinePriceSource = line.priceSourceOverride ?? priceSource;
        try {
          const result = await purchasesApi.getEffectivePurchasePrice({
            vendorId: form.vendorId,
            itemId: line.itemId,
            qty: line.orderedQty || 1,
            asOfDate: form.orderDate || undefined,
            currency: form.currency,
            exchangeRate: Number(form.exchangeRate || 1),
            uomId: line.uomId,
            uom: line.uom,
            priceSource: effectiveSource,
          });
          if (result?.unitPrice != null) {
            setForm((currentForm) => {
              const currentLines = [...currentForm.lines];
              if (currentLines[index]?.itemId === line.itemId) {
                currentLines[index] = { ...currentLines[index], unitPriceDoc: result.unitPrice };
              }
              return { ...currentForm, lines: currentLines };
            });
          }
        } catch (err) {
          console.error('Failed to refresh effective purchase price', err);
        }
      }),
    );
  };

  // Task 243 Part C — right-click handlers (PO).
  const handleDocumentPriceSourceOverride = (source: LinePriceSource) => {
    if (form.linePriceSource === source) return;
    setForm((prev) => ({ ...prev, linePriceSource: source }));
    void refreshLinePrices(source);
    toast.success(
      t('pricing.override.toastDocumentOverrideSet', 'Document price source set to {{source}}', {
        source: source.replace(/_/g, ' '),
      }),
    );
  };
  const handleResetDocumentPriceSource = () => {
    if (form.linePriceSource === 'LAST_PARTY_PRICE') return;
    setForm((prev) => ({ ...prev, linePriceSource: 'LAST_PARTY_PRICE' }));
    void refreshLinePrices('LAST_PARTY_PRICE');
    toast.success(
      t('pricing.override.toastOverrideCleared', 'Override cleared — using document source'),
    );
  };
  const handleLinePriceSourceOverride = (rowIndex: number | undefined, source: LinePriceSource | null) => {
    if (rowIndex == null) return;
    setLine(rowIndex, { priceSourceOverride: source, priceLocked: false });
    if (source) {
      toast.success(
        t('pricing.override.toastLineOverrideSet', 'Line price source set to {{source}}', {
          source: source.replace(/_/g, ' '),
        }),
      );
    } else {
      toast.success(
        t('pricing.override.toastOverrideCleared', 'Override cleared — using document source'),
      );
    }
  };
  const handleLinePriceLocked = (rowIndex: number | undefined, locked: boolean) => {
    if (rowIndex == null) return;
    setLine(rowIndex, { priceLocked: locked, priceSourceOverride: null });
    if (locked) {
      toast.success(
        t('pricing.override.toastLineLocked', 'Line locked — price will not be auto-resolved'),
      );
    } else {
      toast.success(
        t('pricing.override.toastOverrideCleared', 'Override cleared — using document source'),
      );
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

  const isFilledLine = (line: EditableLine): boolean =>
    Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.taxCodeId || line.warehouseId);

  const validateBeforeSave = (): string | null => {
    if (!form.vendorId) return t('purchases.poDetail.vendorRequired');
    if (!form.orderDate) return t('purchases.poDetail.orderDateRequired');
    if (!form.currency.trim()) return t('purchases.poDetail.currencyRequired');
    if (Number.isNaN(form.exchangeRate) || form.exchangeRate <= 0) return t('purchases.poDetail.exchangeRatePositive');
    // Validate only filled lines — ignore the line table's trailing empty working row.
    const filled = form.lines.filter(isFilledLine);
    if (!filled.length) return t('purchases.poDetail.minLines');

    for (let i = 0; i < filled.length; i += 1) {
      const line = filled[i];
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
      discountType: line.discountType,
      discountValue: line.discountValue,
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
        lines: form.lines.filter(isFilledLine).map((line, index) => buildLinePayload(line, index)),
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
    info: {
      title: t('purchases.poDetail.procurementStatus'),
      content: (
        <DocumentRailKeyValueList
          items={[
            { label: t('purchases.poDetail.linesCount'), value: form.lines.length },
            { label: t('purchases.poDetail.vendor'), value: form.vendorName || '-' },
            {
              label: t('purchases.poDetail.workflow'),
              value: (
                <DocumentPill tone={isDraft ? 'slate' : form.status === 'CONFIRMED' ? 'blue' : form.status === 'CLOSED' ? 'green' : 'amber'}>
                  {form.status}
                </DocumentPill>
              ),
            },
          ]}
        />
      ),
    },
    totals: {
      title: t('purchases.poDetail.orderTotals'),
      action: <DocumentPill tone="slate">{form.currency}</DocumentPill>,
      content: (
        <DocumentRailTotals
          rows={[
            { label: t('purchases.poDetail.subtotalWithCurrency', { currency: form.currency }), value: `${form.currency} ${totals.subtotalDoc.toFixed(2)}` },
            { label: t('purchases.poDetail.subtotalBase'), value: totals.subtotalBase.toFixed(2) },
            { label: t('purchases.poDetail.taxWithCurrency', { currency: form.currency }), value: `${form.currency} ${totals.taxTotalDoc.toFixed(2)}` },
            { label: t('purchases.poDetail.taxBase'), value: totals.taxTotalBase.toFixed(2) },
          ]}
          grand={{
            label: t('purchases.poDetail.grandTotal'),
            value: `${form.currency} ${totals.grandTotalDoc.toFixed(2)}`,
            subLabel: t('purchases.poDetail.baseSuffix'),
            subValue: totals.grandTotalBase.toFixed(2),
          }}
        />
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
      newAction={{
        label: t('purchases.poDetail.newPurchaseOrder', 'New Purchase Order'),
        title: t('purchases.poDetail.newPurchaseOrder', 'New Purchase Order'),
        hasUnsavedChanges: hasUnsavedDocumentChanges,
        onNew: openNewOrderForm,
      }}
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
          <LinePriceSourceSelector
            className="min-w-0"
            labelClassName="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500"
            selectClassName={documentHeaderControlClass}
            value={form.linePriceSource}
            disabled={isReadOnly || saving || actionBusy}
            onChange={(source) => {
              setForm((prev) => ({ ...prev, linePriceSource: source }));
              void refreshLinePrices(source);
            }}
          />
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
        columnContextMenus={!isReadOnly ? {
          unitPrice: createDocumentPriceOverrideMenuItems({
            currentDocumentSource: form.linePriceSource,
            baseSource: 'LAST_PARTY_PRICE',
            onSelectDocumentSource: handleDocumentPriceSourceOverride,
            onResetDocumentSource: handleResetDocumentPriceSource,
          }),
        } : undefined}
        cellContextMenus={!isReadOnly ? {
          unitPrice: createLinePriceOverrideMenuItems({
            currentLineSource: null,
            currentLineLocked: false,
            onSelectLineSource: () => {},
            onToggleLineLocked: () => {},
          }).map((item) => ({
            ...item,
            onSelect: (rowIndex) => {
              if (item.key === 'line-manual') {
                handleLinePriceLocked(rowIndex, true);
              } else if (item.key === 'line-none') {
                handleLinePriceSourceOverride(rowIndex, null);
              } else {
                const source = item.key.replace(/^line-/, '') as LinePriceSource;
                handleLinePriceSourceOverride(rowIndex, source);
              }
            },
          })),
        } : undefined}
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
                    // Clearing item resets the whole row to defaults.
                    const empty = createEmptyLine();
                    setLine(index, {
                      itemId: empty.itemId,
                      itemCode: empty.itemCode,
                      itemName: empty.itemName,
                      orderedQty: empty.orderedQty,
                      uomId: empty.uomId,
                      uom: empty.uom,
                      unitPriceDoc: empty.unitPriceDoc,
                      discountType: empty.discountType,
                      discountValue: empty.discountValue,
                      taxCodeId: empty.taxCodeId,
                      warehouseId: empty.warehouseId,
                      description: empty.description,
                    });
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
              <UomSelector
                item={itemById[line.itemId]}
                itemId={line.itemId}
                valueId={line.uomId}
                valueCode={line.uom}
                usage="purchase"
                disabled={isReadOnly || !line.itemId}
                noBorder
                onChange={(selected) => setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' })}
              />
            ),
          },
          {
            id: 'unitPrice',
            label: t('purchases.poDetail.unitPriceColumn'),
            kind: 'custom',
            width: '130px',
            labelExtras:
              !isReadOnly && form.linePriceSource !== 'LAST_PARTY_PRICE' ? (
                <LinePriceOverrideBadge variant="document" source={form.linePriceSource} />
              ) : undefined,
            labelTitle: !isReadOnly
              ? t(
                  'pricing.override.headerMenuTitle',
                  'Right-click the Unit Price column header to override the document source',
                )
              : undefined,
            render: (line, _index, onChange) => {
              if (isReadOnly) {
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 text-right text-xs text-slate-800 dark:text-slate-200 tabular-nums">
                      {line.unitPriceDoc ? Number(line.unitPriceDoc).toFixed(2) : '—'}
                    </span>
                    {line.priceLocked ? (
                      <LinePriceOverrideBadge variant="lineLocked" source={null} compact />
                    ) : line.priceSourceOverride ? (
                      <LinePriceOverrideBadge variant="line" source={line.priceSourceOverride} compact />
                    ) : null}
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.unitPriceDoc ? String(line.unitPriceDoc) : ''}
                    disabled={saving}
                    onChange={(e) => onChange({ unitPriceDoc: Number(e.target.value) || 0 })}
                    onFocus={(event) => { try { event.currentTarget.select(); } catch { /* noop */ } }}
                    className="h-9 min-w-0 flex-1 bg-transparent px-2 text-right text-xs text-slate-900 outline-none focus:bg-blue-50/40 dark:text-slate-100 dark:focus:bg-blue-950/20 font-mono"
                    placeholder=""
                  />
                  {line.priceLocked ? (
                    <LinePriceOverrideBadge variant="lineLocked" source={null} compact />
                  ) : line.priceSourceOverride ? (
                    <LinePriceOverrideBadge variant="line" source={line.priceSourceOverride} compact />
                  ) : null}
                </div>
              );
            },
          },
          {
            id: 'discountType',
            label: t('purchases.poDetail.discountTypeColumn', 'Discount Type'),
            kind: 'custom',
            width: '64px',
            render: (line, index) => (
              <DiscountTypeSelector
                noBorder
                value={line.discountType}
                currencyCode={form.currency}
                disabled={isReadOnly || !line.itemId}
                onChange={(next) => setLine(index, { discountType: next || undefined, discountValue: 0 })}
              />
            ),
          },
          {
            id: 'discountValue',
            label: t('purchases.poDetail.discountColumn', 'Discount'),
            kind: 'number',
            width: '70px',
            accessor: (line) => line.discountValue || 0,
            setter: (value) => ({ discountValue: Number(value) }),
          },
          {
            id: 'taxCode',
            label: t('purchases.poDetail.taxCodeColumn'),
            kind: 'custom',
            width: '120px',
            render: (line, index) => (
              <TaxCodeSelector
                noBorder
                options={purchaseTaxCodes.map((tc) => ({ id: tc.id, code: tc.code, name: tc.name, rate: tc.rate }))}
                valueId={line.taxCodeId}
                disabled={isReadOnly || !line.itemId}
                emptySetupMessage={t(
                  'purchases.poDetail.taxCodeEmptyHint',
                  'No purchase tax codes set up. Create one with scope PURCHASE or BOTH to use it here.',
                )}
                onChange={(option) => setLine(index, { taxCodeId: option?.id })}
              />
            ),
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
          {
            id: 'lineTotal',
            label: t('purchases.poDetail.lineTotalColumn'),
            kind: 'computed',
            width: '115px',
            compute: (_line, index) => computedLines[index]?.lineTotalDoc || 0,
            formatter: (value) => `${form.currency} ${Number(value).toFixed(2)}`,
            // PO's Line Total is post-discount net (pre-tax). Back-solve unit
            // price using qty + discount (no inclusive flag on PO yet).
            solveFromTotal: (value, line) => {
              const q = Number(line.orderedQty || 0);
              if (q <= 0 || !Number.isFinite(value)) return { unitPriceDoc: 0 };
              const dt = line.discountType;
              const dv = Number(line.discountValue || 0);
              if (dt === 'PERCENT') {
                const factor = 1 - dv / 100;
                if (factor <= 0) return { unitPriceDoc: 0 };
                return { unitPriceDoc: value / (q * factor) };
              }
              if (dt === 'AMOUNT') {
                return { unitPriceDoc: (value + dv) / q };
              }
              return { unitPriceDoc: value / q };
            },
          },
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
