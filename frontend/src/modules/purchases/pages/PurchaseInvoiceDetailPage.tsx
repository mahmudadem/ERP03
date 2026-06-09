import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreatePurchaseInvoicePayload,
  PurchaseInvoiceAttachmentDTO,
  PurchaseInvoiceDTO,
  PurchaseInvoiceLineDTO,
  PurchaseInvoiceLineInputDTO,
  PurchaseOrderDTO,
  PurchaseSettingsDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { errorHandler } from '../../../services/errorHandler';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector, ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { SettlementBlock } from '../../../components/shared/settlement/SettlementBlock';
import { RecordPaymentDialog, RecordPaymentPayload } from '../../../components/shared/settlement/RecordPaymentDialog';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Link2,
  Paperclip,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  DocumentCompactCard,
  DocumentControlPanel,
  DocumentDetailScaffold,
  DocumentEmptyPanel,
  DocumentField,
  DocumentFooterTotalsStrip,
  DocumentIconButton,
  DocumentLinesRegion,
  DocumentPill,
  DocumentRailCard,
  DocumentRailStat,
  DocumentSecondaryPanel,
  DocumentSegmentButton,
  DocumentSegmentedGroup,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const todayIso = (): string => new Date().toISOString().slice(0, 10);
const MAX_ATTACHMENT_FILES = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface EditableLine {
  lineId?: string;
  poLineId?: string;
  grnLineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  invoicedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  /** Per-line inclusive override. When undefined, the tax code's default applies. */
  priceIsInclusive?: boolean;
  warehouseId?: string;
  description?: string;
}

interface EditableForm {
  purchaseOrderId: string;
  vendorId: string;
  vendorName?: string;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  notes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  invoicedQty: 1,
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
});

const createEmptyForm = (purchaseOrderId = '', vendorId = ''): EditableForm => ({
  purchaseOrderId,
  vendorId,
  vendorInvoiceNumber: '',
  invoiceDate: todayIso(),
  dueDate: '',
  currency: 'USD',
  exchangeRate: 1,
  notes: '',
  lines: [createEmptyLine()],
});

const PurchaseInvoiceDetailPage: React.FC = () => {
  const { company } = useCompanyAccess();
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';
  const [isEditMode, setIsEditMode] = useState(false);

  const initialPurchaseOrderId = searchParams.get('purchaseOrderId') || '';
  const initialVendorId = searchParams.get('vendorId') || '';

  const [invoice, setInvoice] = useState<PurchaseInvoiceDTO | null>(null);
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [vendors, setVendors] = useState<PartyDTO[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialPurchaseOrderId, initialVendorId));
  const [requestedSourceMode, setRequestedSourceMode] = useState<'direct' | 'po'>(initialPurchaseOrderId ? 'po' : 'direct');
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderLineLoading, setOrderLineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PurchaseInvoiceAttachmentDTO[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentDeletingId, setAttachmentDeletingId] = useState<string | null>(null);
  const [attachmentPendingDelete, setAttachmentPendingDelete] = useState<PurchaseInvoiceAttachmentDTO | null>(null);
  const [unpostConfirmOpen, setUnpostConfirmOpen] = useState(false);
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([]);

  // Settlement state
  const [settlementMode, setSettlementMode] = useState<'DEFERRED' | 'CASH_FULL' | 'MULTI'>('DEFERRED');
  const [apAccountId, setApAccountId] = useState('');
  const [settlementRows, setSettlementRows] = useState<{ settlementAccountId: string; amountBase: number; paymentMethod: string; reference: string; notes: string; paymentDate: string }[]>([]);
  const [settlementValidity, setSettlementValidity] = useState<{ ok: boolean; message?: string }>({ ok: true });
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentBusy, setRecordPaymentBusy] = useState(false);

  const vendorNameById = useMemo(
    () =>
      vendors.reduce<Record<string, string>>((acc, vendor) => {
        acc[vendor.id] = vendor.displayName;
        return acc;
      }, {}),
    [vendors]
  );

  const invoiceablePurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter((order) =>
        ['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(order.status) ||
        order.id === form.purchaseOrderId
      ),
    [form.purchaseOrderId, purchaseOrders]
  );

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
      const taxCode = line.taxCodeId ? taxById[line.taxCodeId] : undefined;
      const taxRate = taxCode?.rate ?? 0;
      // Honour the inclusive flag — line-level override (set via API) wins,
      // otherwise inherit from the tax code's default. Same shape as the SI
      // detail page and the entity's normalizeLine.
      const effectiveInclusive =
        (line as any).priceIsInclusive !== undefined
          ? (line as any).priceIsInclusive === true
          : taxCode?.priceIsInclusive === true;
      const divisor = effectiveInclusive ? 1 + taxRate : 1;
      // Raw qty × unit extension — needed only to derive Net (lineTotalDoc) for
      // inclusive lines. NOT displayed; the LINE TOTAL column is Net + Tax.
      const lineExtensionDoc = roundMoney((line.invoicedQty || 0) * (line.unitPriceDoc || 0));
      const lineExtensionBase = roundMoney(lineExtensionDoc * (form.exchangeRate || 0));
      const lineTotalDoc = roundMoney(lineExtensionDoc / divisor);
      const lineTotalBase = roundMoney(lineExtensionBase / divisor);
      const taxAmountDoc = effectiveInclusive
        ? roundMoney(lineExtensionDoc - lineTotalDoc)
        : roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = effectiveInclusive
        ? roundMoney(lineExtensionBase - lineTotalBase)
        : roundMoney(lineTotalBase * taxRate);
      // `lineGrossDoc` is what the customer pays for this line — Net + Tax —
      // matching SI's convention. Always == lineTotalDoc + taxAmountDoc.
      const lineGrossDoc = roundMoney(lineTotalDoc + taxAmountDoc);
      const lineGrossBase = roundMoney(lineTotalBase + taxAmountBase);

      return {
        lineGrossDoc,
        lineGrossBase,
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

  const toEditableLinesFromPurchaseOrder = (po: PurchaseOrderDTO): EditableLine[] => {
    return po.lines
      .map((line) => {
        const remainingQty = Math.max(line.orderedQty - line.invoicedQty, 0);
        if (remainingQty <= 0) return null;

        return {
          poLineId: line.lineId,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          invoicedQty: remainingQty,
          uomId: line.uomId,
          uom: line.uom,
          unitPriceDoc: line.unitPriceDoc,
          taxCodeId: line.taxCodeId,
          warehouseId: line.warehouseId,
          description: line.description,
        } as EditableLine;
      })
      .filter((line): line is EditableLine => line !== null);
  };

  const loadReferenceData = async () => {
    const [settingsResult, vendorResult, orderResult, itemResult, taxResult, warehouseResult] = await Promise.all([
      purchasesApi.getSettings(),
      sharedApi.listParties({ role: 'VENDOR', active: true }),
      purchasesApi.listPOs({ limit: 500 }).catch(() => []),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
      inventoryApi.listWarehouses({ active: true }),
    ]);

    const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
    const vendorList = unwrap<PartyDTO[]>(vendorResult);
    const orderList = unwrap<PurchaseOrderDTO[]>(orderResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);

    setSettings(currentSettings);
    setVendors(Array.isArray(vendorList) ? vendorList : []);
    setPurchaseOrders(Array.isArray(orderList) ? orderList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setTaxCodes(Array.isArray(taxCodeList) ? taxCodeList : []);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
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

  const loadPurchaseOrderLines = async (orderId: string) => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) return;

    try {
      setOrderLineLoading(true);
      setError(null);

      const orderResult = await purchasesApi.getPO(trimmedOrderId);
      const po = unwrap<PurchaseOrderDTO>(orderResult);
      const nextLines = toEditableLinesFromPurchaseOrder(po);

      setForm((prev) => ({
        ...prev,
        purchaseOrderId: trimmedOrderId,
        vendorId: po.vendorId,
        currency: po.currency,
        exchangeRate: po.exchangeRate,
        lines: nextLines.length ? nextLines : [createEmptyLine()],
      }));
    } catch (err: any) {
      console.error('Failed to load purchase order lines', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load purchase order lines.'
      );
    } finally {
      setOrderLineLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getPI(params.id);
        const loaded = unwrap<PurchaseInvoiceDTO>(result);
        setInvoice(loaded);
        setAttachments(Array.isArray(loaded.attachments) ? loaded.attachments : []);
      } else {
        setInvoice(null);
        setAttachments([]);
        setPendingAttachmentFiles([]);
        setForm(createEmptyForm(initialPurchaseOrderId, initialVendorId));
        if (initialPurchaseOrderId) {
          await loadPurchaseOrderLines(initialPurchaseOrderId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load purchase invoice detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load purchase invoice.'
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

  const triggerLinePriceLookup = async (vendorId: string, itemId: string, qty: number, lineIndex: number) => {
    if (!vendorId || !itemId) return;
    try {
      const result = await purchasesApi.getEffectivePurchasePrice({
        vendorId,
        itemId,
        qty,
        asOfDate: form.invoiceDate || undefined,
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
        void triggerLinePriceLookup(form.vendorId, line.itemId, line.invoicedQty, index);
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
          if (!next.warehouseId && settings?.defaultWarehouseId) {
            next.warehouseId = settings.defaultWarehouseId;
          }
          if (!next.taxCodeId && item.defaultPurchaseTaxCodeId) {
            const defaultTax = purchaseTaxCodes.find((taxCode) => taxCode.id === item.defaultPurchaseTaxCodeId);
            if (defaultTax) next.taxCodeId = defaultTax.id;
          }
          // Trigger price lookup
          if (prev.vendorId) {
            void triggerLinePriceLookup(prev.vendorId, patch.itemId, next.invoicedQty, index);
          }
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
          next.taxCodeId = undefined;
        }
      } else if (patch.invoicedQty !== undefined && current.itemId && prev.vendorId) {
        void triggerLinePriceLookup(prev.vendorId, current.itemId, patch.invoicedQty, index);
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
    if (!form.vendorId) return 'Vendor is required.';
    if (!form.invoiceDate) return 'Invoice date is required.';
    if (!form.currency.trim()) return 'Currency is required.';
    if (Number.isNaN(form.exchangeRate) || form.exchangeRate <= 0) return 'Exchange rate must be greater than 0.';
    if (!form.lines.length) return 'At least one line is required.';

    for (let i = 0; i < form.lines.length; i += 1) {
      const line = form.lines[i];
      const item = itemById[line.itemId];
      if (!line.itemId) return `Line ${i + 1}: item is required.`;
      if (Number.isNaN(line.invoicedQty) || line.invoicedQty <= 0) return `Line ${i + 1}: quantity must be greater than 0.`;
      if (Number.isNaN(line.unitPriceDoc) || line.unitPriceDoc < 0) {
        return `Line ${i + 1}: unit cost must be greater than or equal to 0.`;
      }
      // Warehouse is mandatory for stock items when direct invoicing is enabled
      const isStockItem = item?.trackInventory ?? true; // Default to true if unsure
      if (isStockItem && !line.warehouseId) {
        return `Line ${i + 1}: Warehouse is required for stock item "${item?.name || line.itemId}".`;
      }
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): PurchaseInvoiceLineInputDTO => {
    const item = itemById[line.itemId];
    // Resolve the EFFECTIVE inclusive flag — line override wins, otherwise inherit
    // from the chosen tax code's default. Without this, the backend defaults to
    // exclusive math and the posted voucher disagrees with the form's display.
    const taxCode = line.taxCodeId ? taxById[line.taxCodeId] : undefined;
    const effectiveInclusive =
      line.priceIsInclusive !== undefined ? line.priceIsInclusive : taxCode?.priceIsInclusive === true;
    return {
      lineId: line.lineId,
      lineNo: index + 1,
      poLineId: line.poLineId || undefined,
      grnLineId: line.grnLineId || undefined,
      itemId: line.itemId || undefined,
      invoicedQty: line.invoicedQty,
      uomId: line.uomId,
      uom: line.uom || item?.purchaseUom || item?.baseUom || 'EA',
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId || undefined,
      priceIsInclusive: effectiveInclusive,
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
  };

  const validateAttachmentFile = (file: File, currentCount: number): string | null => {
    if (currentCount >= MAX_ATTACHMENT_FILES) {
      return t('purchases.invoices.attachments.limitError', 'Maximum 5 files per invoice.');
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return t('purchases.invoices.attachments.sizeError', 'File must be 10 MB or smaller.');
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return t('purchases.invoices.attachments.typeError', 'Unsupported file type.');
    }
    return null;
  };

  const uploadPendingAttachments = async (invoiceId: string) => {
    if (pendingAttachmentFiles.length === 0) return;

    const failed: string[] = [];
    for (const file of pendingAttachmentFiles) {
      try {
        await purchasesApi.uploadInvoiceAttachment(invoiceId, file);
      } catch {
        failed.push(file.name);
      }
    }

    if (failed.length > 0) {
      errorHandler.showError(
        t('purchases.invoices.attachments.pendingUploadPartialError', {
          defaultValue: 'Invoice saved, but some attachments failed to upload: {{files}}',
          files: failed.join(', '),
        })
      );
    } else {
      errorHandler.showSuccess(t('purchases.invoices.attachments.pendingUploadSuccess', 'Invoice saved and attachments uploaded.'));
      setPendingAttachmentFiles([]);
    }
  };

  const saveInvoice = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const payload: CreatePurchaseInvoicePayload = {
        source: 'native',
        purchaseOrderId: form.purchaseOrderId || undefined,
        vendorId: form.vendorId,
        vendorInvoiceNumber: form.vendorInvoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        notes: form.notes || undefined,
      };

      if (isCreateMode) {
        const created = await purchasesApi.createPI(payload);
        const dto = unwrap<PurchaseInvoiceDTO>(created);
        await uploadPendingAttachments(dto.id);
        navigate(`/purchases/invoices/${dto.id}`, { replace: true });
      } else if (params.id) {
        const updated = await purchasesApi.updatePI(params.id, payload);
        setInvoice(unwrap<PurchaseInvoiceDTO>(updated));
        setIsEditMode(false);
      }
    } catch (err: any) {
      console.error('Failed to save purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save purchase invoice.'
      );
    } finally {
      setBusy(false);
    }
  };

  const createAndPostDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const outstanding = roundMoney(totals.grandTotalBase);
      const useSettlement = settlementMode !== 'DEFERRED' && outstanding > 0.005;

      const settlementInput = useSettlement ? {
        settlementMode,
        receivablePayableAccountId: apAccountId,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;

      const payload: CreatePurchaseInvoicePayload = {
        source: 'native',
        purchaseOrderId: form.purchaseOrderId || undefined,
        vendorId: form.vendorId,
        vendorInvoiceNumber: form.vendorInvoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        notes: form.notes || undefined,
        settlementInput,
      };

      const created = await purchasesApi.createAndPostPI(payload);
      const dto = unwrap<PurchaseInvoiceDTO>(created);
      await uploadPendingAttachments(dto.id);
      navigate(`/purchases/invoices/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create and post purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to create and post purchase invoice.'
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleEdit = () => {
    if (!invoice) return;
    setForm({
      purchaseOrderId: invoice.purchaseOrderId || '',
      vendorId: invoice.vendorId,
      vendorInvoiceNumber: invoice.vendorInvoiceNumber || '',
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate || '',
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      notes: invoice.notes || '',
      lines: invoice.lines.map((l) => ({
        lineId: l.lineId,
        poLineId: l.poLineId,
        grnLineId: l.grnLineId,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        invoicedQty: l.invoicedQty,
        uomId: l.uomId,
        uom: l.uom,
        unitPriceDoc: l.unitPriceDoc,
        taxCodeId: l.taxCodeId,
        warehouseId: l.warehouseId,
        description: l.description,
      })),
    });
    setRequestedSourceMode(invoice.purchaseOrderId ? 'po' : 'direct');
    setIsEditMode(true);
  };

  const postDraft = async () => {
    if (!invoice?.id) return;
    try {
      setBusy(true);
      setError(null);

      const settlementInput = settlementMode !== 'DEFERRED' ? {
        settlementMode,
        receivablePayableAccountId: apAccountId,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;

      // SoD: Purchases never approves. If the PI is already PENDING_APPROVAL,
      // bail out and direct the user to the Accounting Approval Center. Calling
      // approvePI from here would route the approval through the source module,
      // which violates the "one approval authority, one guard" architecture
      // (see docs/architecture/posting-authority.md §4.1 and Task 167).
      if (invoice.status === 'PENDING_APPROVAL') {
        setError(
          'This invoice is waiting for accounting approval. Approve it from Accounting → Approval Center.',
        );
        return;
      }
      const posted = await purchasesApi.postPI(invoice.id, settlementInput);
      setInvoice(unwrap<PurchaseInvoiceDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to post purchase invoice.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePostClick = () => {
    if (!invoice) return;
    // The inline SettlementBlock already holds the user's settlement rows.
    // Gate on its validity, then post directly. (#193 retired the old settlement
    // modal — re-opening it here silently wiped the entry.)
    if (settlementMode !== 'DEFERRED' && !settlementValidity.ok) {
      setError(settlementValidity.message || 'Settlement needs attention.');
      return;
    }
    postDraft();
  };

  const unpostPI = async () => {
    if (!invoice?.id) return;
    try {
      setBusy(true);
      setError(null);
      const unposted = await purchasesApi.unpostPI(invoice.id);
      setInvoice(unwrap<PurchaseInvoiceDTO>(unposted));
      setUnpostConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to unpost purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to unpost purchase invoice.'
      );
    } finally {
      setBusy(false);
    }
  };

  const refreshAttachments = async () => {
    if (!invoice?.id) return;
    const result = await purchasesApi.listInvoiceAttachments(invoice.id);
    const list = unwrap<PurchaseInvoiceAttachmentDTO[]>(result);
    const normalized = Array.isArray(list) ? list : [];
    setAttachments(normalized);
    setInvoice((current) => (current ? { ...current, attachments: normalized } : current));
  };

  const uploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const currentCount = invoice?.id ? attachments.length : pendingAttachmentFiles.length;
    const validationError = validateAttachmentFile(file, currentCount);
    if (validationError) {
      setError(validationError);
      errorHandler.showError(validationError);
      return;
    }

    if (!invoice?.id) {
      setPendingAttachmentFiles((current) => [...current, file]);
      errorHandler.showSuccess(t('purchases.invoices.attachments.queued', 'Attachment queued for upload when the invoice is saved.'));
      return;
    }

    try {
      setAttachmentBusy(true);
      setError(null);
      await purchasesApi.uploadInvoiceAttachment(invoice.id, file);
      await refreshAttachments();
      errorHandler.showSuccess(t('purchases.invoices.attachments.uploadSuccess', 'Attachment uploaded successfully.'));
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('purchases.invoices.attachments.uploadError', 'Failed to upload attachment.');
      setError(message);
      errorHandler.showError(message);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeAttachment = async () => {
    if (!invoice?.id || !attachmentPendingDelete) return;
    try {
      setAttachmentDeletingId(attachmentPendingDelete.id);
      setError(null);
      await purchasesApi.removeInvoiceAttachment(invoice.id, attachmentPendingDelete.id);
      await refreshAttachments();
      errorHandler.showSuccess(t('purchases.invoices.attachments.removeSuccess', 'Attachment removed successfully.'));
      setAttachmentPendingDelete(null);
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('purchases.invoices.attachments.removeError', 'Failed to remove attachment.');
      setError(message);
      errorHandler.showError(message);
    } finally {
      setAttachmentDeletingId(null);
    }
  };

  const downloadAttachment = async (attachmentId: string) => {
    if (!invoice?.id) return;
    try {
      setError(null);
      const result = await purchasesApi.getInvoiceAttachmentDownloadLink(invoice.id, attachmentId);
      const payload = unwrap<{ url?: string }>(result);
      if (!payload?.url) {
        throw new Error(t('purchases.invoices.attachments.downloadError', 'Failed to generate download link.'));
      }
      window.open(payload.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('purchases.invoices.attachments.downloadError', 'Failed to generate download link.');
      setError(message);
      errorHandler.showError(message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Invoice</h1>
        <Card className="p-6">Loading purchase invoice...</Card>
      </div>
    );
  }

  if (isCreateMode || isEditMode) {
    const baseCurrency = company?.baseCurrency || 'USD';
    const activeSourceMode = form.purchaseOrderId || requestedSourceMode === 'po' ? 'po' : 'direct';
    const selectedPurchaseOrder = form.purchaseOrderId
      ? invoiceablePurchaseOrders.find((order) => order.id === form.purchaseOrderId)
      : undefined;
    const selectedVendorName =
      selectedPurchaseOrder?.vendorName ||
      vendorNameById[form.vendorId] ||
      form.vendorName ||
      '-';
    const filledDraftLines = form.lines.filter((line) => line.itemId && line.invoicedQty > 0);
    const draftHasVendor = !!form.vendorId;
    const draftHasLines = filledDraftLines.length > 0;
    const draftBalanced = totals.grandTotalDoc >= 0;
    const draftTaxResolved = filledDraftLines.every((line) => !line.taxCodeId || !!taxById[line.taxCodeId]);
    const draftAttachmentInputId = isCreateMode ? 'purchase-invoice-draft-attachment-input' : 'purchase-invoice-edit-attachment-input';
    const draftAttachmentCount = invoice?.id ? attachments.length : pendingAttachmentFiles.length;
    const headerLabelClass = 'mb-1 block text-[10px] font-bold uppercase text-slate-500';
    const headerFieldWrapperClass = 'min-w-0';
    const headerControlClass = 'h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
    const headerSelectorClass = 'h-9 [&>input]:h-9 [&>input]:rounded [&>input]:border-slate-300 [&>input]:py-0 [&>input]:text-xs dark:[&>input]:border-slate-700';

    const draftFooterSummary = (
      <DocumentFooterTotalsStrip
        totals={[
          { label: 'Subtotal', value: `${form.currency} ${totals.subtotalDoc.toFixed(2)}` },
          { label: 'Tax', value: `${form.currency} ${totals.taxTotalDoc.toFixed(2)}`, tone: 'blue' },
          { label: 'Grand', value: `${form.currency} ${totals.grandTotalDoc.toFixed(2)}`, tone: 'green' },
        ]}
      />
    );
    const draftSideRail = (
      <>
        <DocumentRailCard
          title="Info"
          action={<DocumentPill tone={form.purchaseOrderId ? 'blue' : 'slate'}>{form.purchaseOrderId ? 'PO' : 'Account'}</DocumentPill>}
        >
          <div className="flex min-h-[132px] flex-col gap-2 overflow-auto p-2.5 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="truncate text-[9px] font-black uppercase tracking-wide text-slate-500">
                {form.purchaseOrderId ? selectedPurchaseOrder?.orderNumber || form.purchaseOrderId : 'Direct bill'}
              </div>
              <div className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-slate-100">
                {selectedVendorName}
              </div>
              <div className="truncate text-[10px] font-semibold text-slate-500">
                {form.vendorInvoiceNumber || 'Vendor invoice number not entered'}
              </div>
            </div>
            <div className="rounded border border-blue-50 bg-blue-50/50 px-2 py-1.5 text-[11px] leading-relaxed text-blue-700 dark:border-blue-950/20 dark:bg-blue-950/10 dark:text-blue-300">
              Select or hover over an item line to review purchasing details, warehouse, tax, and AP impact.
            </div>
          </div>
        </DocumentRailCard>

        <DocumentRailCard title="Posting Readiness">
          <div className="space-y-1.5 p-2.5 text-xs">
            <div className={clsx(
              'flex items-center gap-2 rounded border px-2 py-1.5 font-bold',
              draftHasVendor && draftHasLines && draftBalanced
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-red-100 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300',
            )}>
              {draftHasVendor && draftHasLines && draftBalanced ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>Balanced AP posting preview</span>
            </div>

            <div className={clsx(
              'flex items-center gap-2 rounded border px-2 py-1.5 font-bold',
              draftTaxResolved
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-red-100 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300',
            )}>
              {draftTaxResolved ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>Purchase tax accounts resolved</span>
            </div>

            <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
              <Info className="h-4 w-4 shrink-0" />
              <span>AP, inventory, and approval policy active</span>
            </div>
          </div>
        </DocumentRailCard>

        <SettlementBlock
          variant="summary"
          module="purchases"
          mode={settlementMode}
          rows={settlementRows}
          partyAccountId={apAccountId}
          partyAccountLabel={selectedVendorName || apAccountId}
          outstandingBase={totals.grandTotalBase}
        />

        <DocumentRailCard title="Totals" action={<DocumentPill tone="slate">{form.currency}</DocumentPill>}>
          <div className="space-y-1.5 p-2.5">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50/40 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/30">
              <span className="font-bold text-slate-500">Subtotal</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{form.currency} {totals.subtotalDoc.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50/40 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/30">
              <span className="font-bold text-slate-500">Tax</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{form.currency} {totals.taxTotalDoc.toFixed(2)}</span>
            </div>
            <div className="rounded-lg border border-slate-950 bg-slate-900 px-3 py-2 text-white shadow-md dark:bg-slate-950">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Grand Total</div>
              <div className="mt-0.5 text-right font-mono text-xl font-black text-emerald-400">
                {form.currency} {totals.grandTotalDoc.toFixed(2)}
              </div>
              {form.currency !== baseCurrency && (
                <div className="mt-1.5 flex justify-between border-t border-white/10 pt-1 text-[10px] font-bold text-slate-300">
                  <span>Grand Total (Base)</span>
                  <span className="font-mono">{baseCurrency} {totals.grandTotalBase.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </DocumentRailCard>
      </>
    );

    return (
      <DocumentDetailScaffold
        title={isCreateMode ? 'New Purchase Invoice' : `Edit ${invoice?.invoiceNumber}`}
        subtitle="Vendor bill document. Posting creates AP and purchase/inventory entries."
        icon={FileText}
        backLabel="Back to purchase invoices"
        onBack={() => (isEditMode ? setIsEditMode(false) : navigate('/purchases/invoices'))}
        badges={
          <>
            <DocumentPill tone="slate">{isEditMode ? 'Edit Draft' : 'Draft'}</DocumentPill>
            {activeSourceMode === 'po' && <DocumentPill tone="blue">From PO</DocumentPill>}
          </>
        }
        sideRail={draftSideRail}
        railTitle="Purchase invoice side rail"
        footerSummary={draftFooterSummary}
        footerActions={
          <>
            <button
              type="button"
              className="rounded bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700"
              onClick={saveInvoice}
              disabled={busy || orderLineLoading}
            >
              {busy ? 'Saving...' : isCreateMode ? 'Save Draft' : 'Update Draft'}
            </button>
            {isCreateMode && (
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                onClick={() => {
                  const outstanding = roundMoney(totals.grandTotalBase);
                  if (outstanding <= 0.005) {
                    setSettlementMode('DEFERRED');
                    createAndPostDraft();
                    return;
                  }
                  // Inline SettlementBlock holds the rows; gate on validity, then post.
                  // (#193 retired the old settlement modal — re-opening it wiped the entry.)
                  if (settlementMode !== 'DEFERRED' && !settlementValidity.ok) {
                    setError(settlementValidity.message || 'Settlement needs attention.');
                    return;
                  }
                  createAndPostDraft();
                }}
                disabled={busy || orderLineLoading}
              >
                {busy ? 'Saving & Posting...' : 'Save & Post'}
              </button>
            )}
          </>
        }
      >

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <DocumentControlPanel>
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DocumentSegmentedGroup>
                <DocumentSegmentButton
                  active={activeSourceMode === 'direct'}
                  disabled={busy || orderLineLoading || isEditMode}
                  icon={FileText}
                  label="Direct"
                  onClick={() => {
                    setRequestedSourceMode('direct');
                    setForm((prev) => ({ ...prev, purchaseOrderId: '' }));
                  }}
                />
                <DocumentSegmentButton
                  active={activeSourceMode === 'po'}
                  disabled={busy || orderLineLoading || isEditMode}
                  icon={Link2}
                  label="From PO"
                  onClick={() => setRequestedSourceMode('po')}
                />
              </DocumentSegmentedGroup>
              <button
                type="button"
                disabled
                className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 disabled:cursor-default dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
              >
                <Link2 className="h-3.5 w-3.5" />
                {activeSourceMode === 'po' ? 'Pick PO in header' : 'Direct header driven'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
              <input
                id={draftAttachmentInputId}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={uploadAttachment}
                disabled={attachmentBusy || (!invoice?.id && pendingAttachmentFiles.length >= MAX_ATTACHMENT_FILES)}
              />
              <DocumentIconButton
                title={t('purchases.invoices.attachments.upload', 'Upload Attachment')}
                onClick={() => document.getElementById(draftAttachmentInputId)?.click()}
                disabled={attachmentBusy || (!invoice?.id && pendingAttachmentFiles.length >= MAX_ATTACHMENT_FILES)}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </DocumentIconButton>
              <DocumentIconButton
                title="Download Excel"
                onClick={() => errorHandler.showWarning('Purchase invoice line export is not connected yet.')}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </DocumentIconButton>
              <DocumentIconButton
                title="Upload from file"
                onClick={() => errorHandler.showWarning('Purchase invoice file import is not connected yet.')}
              >
                <Upload className="h-3.5 w-3.5" />
              </DocumentIconButton>
              <DocumentIconButton
                title="Read from image"
                onClick={() => errorHandler.showWarning('Purchase invoice image reading is not connected yet.')}
              >
                <FileImage className="h-3.5 w-3.5" />
              </DocumentIconButton>
            </div>
          </div>
        </DocumentControlPanel>

        <DocumentCompactCard
          title={activeSourceMode === 'po' ? 'Header - From Purchase Order' : 'Header - Direct Bill'}
          action={
            <div className="flex items-center gap-1.5">
              <DocumentPill tone={activeSourceMode === 'po' ? 'blue' : 'slate'}>
                {activeSourceMode === 'po' ? 'From PO' : 'Direct'}
              </DocumentPill>
              <DocumentPill tone="slate">{form.currency}</DocumentPill>
              {draftHasVendor && (
                <DocumentPill tone="green">
                  <ShieldCheck className="h-3 w-3" />
                  AP Ready
                </DocumentPill>
              )}
            </div>
          }
          className="overflow-visible"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 p-3">
            {activeSourceMode === 'po' ? (
              <>
                <div className={headerFieldWrapperClass}>
                  <label className={headerLabelClass}>Purchase Order</label>
                  <select
                    className={headerControlClass}
                    value={form.purchaseOrderId}
                    onChange={(e) => {
                      const nextOrderId = e.target.value;
                      setRequestedSourceMode('po');
                      if (!nextOrderId) {
                        setForm((prev) => ({ ...prev, purchaseOrderId: '' }));
                        return;
                      }
                      void loadPurchaseOrderLines(nextOrderId);
                    }}
                    disabled={busy || orderLineLoading || isEditMode}
                  >
                    <option value="">Select invoiceable purchase order...</option>
                    {invoiceablePurchaseOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} - {vendorNameById[order.vendorId] || order.vendorName} ({order.status})
                      </option>
                    ))}
                  </select>
                </div>
                <DocumentField label="Vendor" value={selectedVendorName} locked />
              </>
            ) : (
              <div className={headerFieldWrapperClass}>
                <label className={headerLabelClass}>Vendor</label>
                <PartySelector
                  role="VENDOR"
                  placeholder="Select vendor..."
                  className={headerSelectorClass}
                  value={form.vendorId}
                  onChange={(party) => {
                    setForm((prev) => ({
                      ...prev,
                      vendorId: party?.id || '',
                      vendorName: party?.displayName || '',
                      currency: party?.defaultCurrency || prev.currency,
                    }));
                  }}
                />
              </div>
            )}

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>Vendor Invoice #</label>
              <input
                type="text"
                className={headerControlClass}
                value={form.vendorInvoiceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, vendorInvoiceNumber: e.target.value }))}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>Invoice Date</label>
              <DatePicker
                className="w-full"
                inputClassName={clsx(headerControlClass, 'pr-8')}
                value={form.invoiceDate}
                onChange={(val) => setForm((prev) => ({ ...prev, invoiceDate: val }))}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>Due Date</label>
              <DatePicker
                className="w-full"
                inputClassName={clsx(headerControlClass, 'pr-8')}
                value={form.dueDate}
                onChange={(val) => setForm((prev) => ({ ...prev, dueDate: val }))}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>Currency</label>
              <CurrencySelector
                className={headerSelectorClass}
                value={form.currency}
                onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
                disabled={busy || activeSourceMode === 'po'}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>Exchange Rate</label>
              <div className="[&>div]:h-9 [&>div]:rounded">
                <CurrencyExchangeWidget
                  currency={form.currency}
                  baseCurrency={baseCurrency}
                  voucherDate={form.invoiceDate}
                  value={form.exchangeRate}
                  onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
                  disabled={busy || activeSourceMode === 'po'}
                />
              </div>
            </div>

            <div className="min-w-0 md:col-span-2 xl:col-span-2">
              <label className={headerLabelClass}>Notes</label>
              <textarea
                rows={1}
                className={clsx(headerControlClass, 'h-9 resize-none py-2')}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
        </DocumentCompactCard>

        <DocumentLinesRegion>
          <ClassicLineItemsTable<EditableLine>
            rows={form.lines}
            disabled={busy}
            onRowChange={(index, patch) => setLine(index, patch)}
            onRowRemove={(index) => removeLine(index)}
            onRowAdd={addLine}
            addLabel="Add Item"
            columns={[
              {
                id: 'item',
                label: 'Item',
                kind: 'custom',
                width: '240px',
                render: (row, index) => (
                  <ItemSelector
                    value={row.itemId}
                    onChange={(item) => setLine(index, { itemId: item?.id || '' })}
                    noBorder
                    disabled={busy}
                  />
                ),
              },
              {
                id: 'qty',
                label: 'Qty',
                kind: 'number',
                width: '80px',
                accessor: (row) => row.invoicedQty,
                setter: (value) => ({ invoicedQty: Number(value) }),
              },
              {
                id: 'uom',
                label: 'UOM',
                kind: 'custom',
                width: '90px',
                render: (row, index) => {
                  const opts = uomOptionsByItemId[row.itemId] || [];
                  const value =
                    findItemUomOption(opts, row.uomId, row.uom)?.uomId || row.uomId || row.uom || '';
                  return (
                    <select
                      value={value}
                      disabled={busy || !row.itemId}
                      onChange={(e) => {
                        const selected = opts.find(
                          (option) => (option.uomId || option.code) === e.target.value,
                        );
                        setLine(index, {
                          uomId: selected?.uomId,
                          uom: selected?.code || '',
                        });
                      }}
                      className="w-full h-9 px-2 bg-transparent border-0 outline-none text-xs uppercase text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 appearance-none cursor-pointer"
                    >
                      <option value="">{row.itemId ? 'Select' : 'No item'}</option>
                      {opts.map((option) => (
                        <option key={option.uomId || option.code} value={option.uomId || option.code}>
                          {option.code}
                        </option>
                      ))}
                    </select>
                  );
                },
              },
              {
                id: 'unitCost',
                label: 'Unit Cost',
                kind: 'number',
                width: '110px',
                accessor: (row) => row.unitPriceDoc,
                setter: (value) => ({ unitPriceDoc: Number(value) }),
              },
              {
                id: 'taxCode',
                label: 'Tax Code',
                kind: 'select',
                width: '140px',
                accessor: (row) => row.taxCodeId || '',
                setter: (value) => ({ taxCodeId: value || undefined }),
                options: [
                  { value: '', label: 'No Tax' },
                  ...purchaseTaxCodes.map((tc) => ({
                    value: tc.id,
                    label: `${tc.code} (${Math.round(tc.rate * 100)}%)`,
                  })),
                ],
              },
              {
                id: 'warehouse',
                label: 'Warehouse',
                kind: 'custom',
                width: '180px',
                render: (row, index) => (
                  <WarehouseSelector
                    value={row.warehouseId}
                    onChange={(wh) => setLine(index, { warehouseId: wh?.id || undefined })}
                    noBorder
                    disabled={busy}
                  />
                ),
              },
              {
                id: 'lineTotal',
                label: 'Line Total',
                kind: 'computed',
                width: '110px',
                compute: (_row, index) => computedLines[index]?.lineGrossDoc ?? 0,
              },
              {
                id: 'net',
                label: 'Net',
                kind: 'computed',
                width: '100px',
                compute: (_row, index) => computedLines[index]?.lineTotalDoc ?? 0,
              },
              {
                id: 'tax',
                label: 'Tax',
                kind: 'computed',
                width: '90px',
                compute: (_row, index) => computedLines[index]?.taxAmountDoc ?? 0,
              },
              {
                id: 'netBase',
                label: 'Net Base',
                kind: 'computed',
                width: '110px',
                compute: (_row, index) => computedLines[index]?.lineTotalBase ?? 0,
              },
            ]}
            minRows={1}
            className="flex-1 [&>div:first-child]:h-full [&>div:first-child]:max-h-none"
          />
        </DocumentLinesRegion>

        <DocumentSecondaryPanel
          title="Account Ledger & Purchase Taxes Allocation Grid"
          action={
            <button
              type="button"
              onClick={() => errorHandler.showWarning('Purchase tax preset automation is not connected yet.')}
              className="hidden h-6 items-center rounded border border-emerald-300 px-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-50 md:inline-flex"
            >
              {t('purchases.invoiceDetail.allocation.applyTaxPreset', 'Apply Tax Preset')}
            </button>
          }
        >
          <DocumentEmptyPanel
            title="No allocation rows"
            description="Real AP, inventory, and tax allocation controls are not shown until the controlled allocation contract is implemented."
          />
        </DocumentSecondaryPanel>

        <div className="grid gap-2 md:grid-cols-2">
          <DocumentCompactCard
            title={t('purchases.invoices.attachments.title', 'Attachments')}
            action={
              <label
                htmlFor={draftAttachmentInputId}
                className="inline-flex h-6 cursor-pointer items-center rounded border border-slate-200 px-2 text-[10px] font-black uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {attachmentBusy ? t('purchases.invoices.attachments.uploading', 'Uploading...') : t('purchases.invoices.attachments.upload', 'Upload')}
              </label>
            }
          >
            <div className="min-h-[56px] p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-500" />
                <div className="min-w-0">
                  <div className="font-black text-slate-900 dark:text-slate-100">
                    {draftAttachmentCount} {draftAttachmentCount === 1 ? 'file' : 'files'}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {invoice?.id
                      ? t('purchases.invoices.attachments.help', 'Allowed: PDF, PNG, JPG, DOCX, XLSX. Max 10 MB per file, 5 files per invoice.')
                      : t('purchases.invoices.attachments.unsavedHelp', 'Files selected here are queued locally and uploaded automatically when the invoice is saved.')}
                  </div>
                </div>
              </div>

              {!invoice?.id && pendingAttachmentFiles.length > 0 && (
                <div className="mt-2 grid gap-1">
                  {pendingAttachmentFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <div className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                        {file.name}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-black uppercase text-rose-600"
                        onClick={() => setPendingAttachmentFiles((current) => current.filter((_, idx) => idx !== index))}
                      >
                        {t('purchases.invoices.attachments.remove', 'Remove')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DocumentCompactCard>

          <DocumentCompactCard
            title="Audit & Warnings"
            action={<DocumentPill tone={draftHasVendor && draftHasLines ? 'green' : 'amber'}>{draftHasVendor && draftHasLines ? 'Ready' : 'Open'}</DocumentPill>}
          >
            <div className="flex min-h-[56px] items-center gap-2 p-2.5 text-xs">
              <History className="h-4 w-4 text-slate-500" />
              <div className="min-w-0">
                <div className="font-black text-slate-900 dark:text-slate-100">
                  Draft checks
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  Vendor, line, warehouse, tax, AP, and attachment warnings remain visible before saving.
                </div>
              </div>
            </div>
          </DocumentCompactCard>
        </div>

        <SettlementBlock
          module="purchases"
          mode={settlementMode}
          onModeChange={setSettlementMode}
          rows={settlementRows}
          onRowsChange={setSettlementRows}
          partyAccountId={apAccountId}
          partyAccountLabel={selectedVendorName || apAccountId}
          outstandingBase={totals.grandTotalBase}
          paymentMethodConfigs={(settings as any)?.paymentMethodConfigs || []}
          allowOverpayment={(settings as any)?.allowOverpayment === true}
          currencyCode={form.currency}
          onValidityChange={setSettlementValidity}
        />

      </DocumentDetailScaffold>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Invoice</h1>
        <Card className="p-6 text-sm text-red-700">Purchase invoice not found.</Card>
      </div>
    );
  }

  const canCreatePayment = invoice.status === 'POSTED' && invoice.outstandingAmountBase > 0;
  const canCreateReturn = invoice.status === 'POSTED';
  const createReturnHref = `/purchases/returns/new?purchaseInvoiceId=${encodeURIComponent(invoice.id)}${
    invoice.purchaseOrderId ? `&purchaseOrderId=${encodeURIComponent(invoice.purchaseOrderId)}` : ''
  }`;

  // Pay-later entry point (Task 184 Finding 5): record a payment against this posted invoice
  // via the invoice-aware dialog → recordPayment endpoint (posts the linked payment voucher,
  // reconciles outstanding/paymentStatus). Stays on the invoice page; never routes into Accounting.
  const handleRecordPayment = async (payload: RecordPaymentPayload) => {
    if (!invoice) return;
    setRecordPaymentBusy(true);
    try {
      const res = await purchasesApi.recordPayment(invoice.id, payload as any);
      const dto = ((res as any)?.invoice ?? res) as PurchaseInvoiceDTO;
      setInvoice(dto);
      setRecordPaymentOpen(false);
      errorHandler.showSuccess(t('purchases.invoiceDetail.recordPaymentSuccess', 'Payment recorded.'));
      window.dispatchEvent(new CustomEvent('documents-updated', { detail: { type: 'PI' } }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('purchases.invoiceDetail.recordPaymentFailed', 'Failed to record payment.'));
    } finally {
      setRecordPaymentBusy(false);
    }
  };
  const viewBaseCurrency = company?.baseCurrency || 'USD';
  const viewVendorName = vendorNameById[invoice.vendorId] || invoice.vendorName || '-';
  const viewTaxResolved = invoice.lines.every((line) => !line.taxCodeId || line.taxCode || taxById[line.taxCodeId]);
  const viewPostingOk = invoice.status === 'POSTED' || invoice.status === 'PENDING_APPROVAL' || (invoice.lines.length > 0 && !!invoice.vendorId);
  const viewAttachmentInputId = 'purchase-invoice-view-attachment-input';
  const viewFooterSummary = (
    <DocumentFooterTotalsStrip
      totals={[
        { label: 'Subtotal', value: `${invoice.currency} ${invoice.subtotalDoc.toFixed(2)}` },
        { label: 'Tax', value: `${invoice.currency} ${invoice.taxTotalDoc.toFixed(2)}`, tone: 'blue' },
        { label: 'Outstanding', value: `${company?.baseCurrency || 'Base'} ${invoice.outstandingAmountBase.toFixed(2)}`, tone: 'amber' },
        { label: 'Grand', value: `${invoice.currency} ${invoice.grandTotalDoc.toFixed(2)}`, tone: 'green' },
      ]}
    />
  );
  const viewSideRail = (
    <>
      <DocumentRailCard
        title="Info"
        action={<DocumentPill tone={invoice.purchaseOrderId ? 'blue' : 'slate'}>{invoice.purchaseOrderId ? 'PO' : 'Account'}</DocumentPill>}
      >
        <div className="flex min-h-[132px] flex-col gap-2 overflow-auto p-2.5 text-xs">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="truncate text-[9px] font-black uppercase tracking-wide text-slate-500">
              {invoice.purchaseOrderId || invoice.invoiceNumber}
            </div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-slate-100">
              {viewVendorName}
            </div>
            <div className="truncate text-[10px] font-semibold text-slate-500">
              {invoice.vendorInvoiceNumber || 'Vendor invoice number not entered'}
            </div>
          </div>
          <div className="rounded border border-blue-50 bg-blue-50/50 px-2 py-1.5 text-[11px] leading-relaxed text-blue-700 dark:border-blue-950/20 dark:bg-blue-950/10 dark:text-blue-300">
            Review the vendor bill, stock cost, tax, AP balance, and legal posting actions from this view.
          </div>
        </div>
      </DocumentRailCard>

      <DocumentRailCard title={invoice.status === 'POSTED' ? 'Document Status' : 'Posting Readiness'}>
        <div className="space-y-1.5 p-2.5 text-xs">
          <div className={clsx(
            'flex items-center gap-2 rounded border px-2 py-1.5 font-bold',
            viewPostingOk
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
              : 'border-red-100 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300',
          )}>
            {viewPostingOk ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{invoice.status === 'POSTED' ? 'Ledger voucher created' : 'Balanced AP posting preview'}</span>
          </div>
          <div className={clsx(
            'flex items-center gap-2 rounded border px-2 py-1.5 font-bold',
            viewTaxResolved
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
              : 'border-red-100 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300',
          )}>
            {viewTaxResolved ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{invoice.status === 'POSTED' ? 'Purchase tax lines posted' : 'Purchase tax accounts resolved'}</span>
          </div>
          <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
            <Info className="h-4 w-4 shrink-0" />
            <span>AP, inventory, and approval policy active</span>
          </div>
        </div>
      </DocumentRailCard>

      <DocumentRailCard
        title="Settlement"
        action={
          <DocumentPill tone={invoice.paymentStatus === 'PAID' ? 'green' : invoice.paymentStatus === 'PARTIALLY_PAID' ? 'amber' : 'slate'}>
            {invoice.paymentStatus === 'UNPAID' ? 'Credit' : invoice.paymentStatus}
          </DocumentPill>
        }
      >
        <div className="grid grid-cols-2 gap-1.5 border-b border-slate-100 p-2 dark:border-slate-800">
          <DocumentRailStat label="Paid" value={invoice.paidAmountBase.toFixed(2)} tone="green" />
          <DocumentRailStat label="Remaining" value={invoice.outstandingAmountBase.toFixed(2)} tone={invoice.outstandingAmountBase > 0 ? 'amber' : 'green'} />
          <div className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-[11px] dark:border-slate-800">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Affected Account</div>
            <div className="truncate font-bold text-slate-800 dark:text-slate-100">{viewVendorName}</div>
            <div className="truncate font-mono text-[10px] text-slate-500">
              {viewBaseCurrency} {invoice.outstandingAmountBase.toFixed(2)}
            </div>
          </div>
        </div>
      </DocumentRailCard>

      <DocumentRailCard title="Totals" action={<DocumentPill tone="slate">{invoice.currency}</DocumentPill>}>
        <div className="space-y-1.5 p-2.5">
          <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50/40 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/30">
            <span className="font-bold text-slate-500">Subtotal</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{invoice.currency} {invoice.subtotalDoc.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50/40 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/30">
            <span className="font-bold text-slate-500">Tax</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{invoice.currency} {invoice.taxTotalDoc.toFixed(2)}</span>
          </div>
          <div className="rounded-lg border border-slate-950 bg-slate-900 px-3 py-2 text-white shadow-md dark:bg-slate-950">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Grand Total</div>
            <div className="mt-0.5 text-right font-mono text-xl font-black text-emerald-400">
              {invoice.currency} {invoice.grandTotalDoc.toFixed(2)}
            </div>
            {invoice.currency !== viewBaseCurrency && (
              <div className="mt-1.5 flex justify-between border-t border-white/10 pt-1 text-[10px] font-bold text-slate-300">
                <span>Grand Total (Base)</span>
                <span className="font-mono">{viewBaseCurrency} {invoice.grandTotalBase.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </DocumentRailCard>
    </>
  );

  return (
    <>
    <DocumentDetailScaffold
      title={invoice.invoiceNumber}
      subtitle={`Vendor: ${vendorNameById[invoice.vendorId] || invoice.vendorName}${invoice.vendorInvoiceNumber ? ` | Vendor Ref: ${invoice.vendorInvoiceNumber}` : ''}`}
      icon={FileText}
      backLabel="Back to purchase invoices"
      onBack={() => navigate('/purchases/invoices')}
      badges={
        <>
          <DocumentPill tone={invoice.status === 'POSTED' ? 'green' : invoice.status === 'PENDING_APPROVAL' ? 'amber' : invoice.status === 'CANCELLED' ? 'rose' : 'slate'}>
            {invoice.status === 'PENDING_APPROVAL' ? 'PENDING APPROVAL' : invoice.status}
          </DocumentPill>
          <DocumentPill tone={invoice.paymentStatus === 'PAID' ? 'green' : invoice.paymentStatus === 'PARTIALLY_PAID' ? 'amber' : 'rose'}>
            {invoice.paymentStatus}
          </DocumentPill>
          {invoice.purchaseOrderId && <DocumentPill tone="blue">From PO</DocumentPill>}
        </>
      }
      sideRail={viewSideRail}
      railTitle="Purchase invoice side rail"
      footerSummary={viewFooterSummary}
      footerActions={
        <>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => navigate('/purchases/invoices')}
          >
            Back to List
          </button>
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              onClick={toggleEdit}
              disabled={busy}
            >
              Edit Draft
            </button>
          )}
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              onClick={handlePostClick}
              disabled={busy}
            >
              {busy ? 'Posting...' : 'Post Invoice'}
            </button>
          )}
          {invoice.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-indigo-300 bg-white px-4 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigate(createReturnHref)}
              disabled={!canCreateReturn}
            >
              Create Return
            </button>
          )}
          {invoice.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setRecordPaymentOpen(true)}
              disabled={!canCreatePayment}
            >
              Create Payment
            </button>
          )}
          {invoice.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
              onClick={() => setUnpostConfirmOpen(true)}
              disabled={busy || canCreatePayment === false || invoice.paymentStatus !== 'UNPAID'}
            >
              {busy ? 'Unposting...' : 'Unpost Invoice'}
            </button>
          )}
        </>
      }
    >

      {/*
        SoD: a Purchase Invoice in PENDING_APPROVAL is awaiting accounting approval. Purchases-side
        cannot Approve its own postings. The accountant clears the parked state from the Approval
        Center. See docs/architecture/posting-authority.md §4.1.
      */}
      {invoice.status === 'PENDING_APPROVAL' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <div className="font-semibold mb-0.5">⏳ Awaiting accounting approval</div>
          <div className="text-amber-800">
            This invoice was submitted and is waiting for accounting to approve the ledger effect.
            You cannot edit it while it is pending. The decision will appear here when it is made.
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <DocumentControlPanel>
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DocumentSegmentedGroup>
              <DocumentSegmentButton active={!invoice.purchaseOrderId} disabled icon={FileText} label="Direct" />
              <DocumentSegmentButton active={!!invoice.purchaseOrderId} disabled icon={Link2} label="From PO" />
            </DocumentSegmentedGroup>
            <button
              type="button"
              disabled
              className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 disabled:cursor-default dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
            >
              <Link2 className="h-3.5 w-3.5" />
              {invoice.purchaseOrderId ? 'Source locked from PO' : 'Direct header driven'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
            <input
              id={viewAttachmentInputId}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
              onChange={uploadAttachment}
              disabled={attachmentBusy}
            />
            <DocumentIconButton
              title={t('purchases.invoices.attachments.upload', 'Upload Attachment')}
              onClick={() => document.getElementById(viewAttachmentInputId)?.click()}
              disabled={attachmentBusy}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </DocumentIconButton>
            <DocumentIconButton title="Download Excel" onClick={() => errorHandler.showWarning('Purchase invoice line export is not connected yet.')}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </DocumentIconButton>
            <DocumentIconButton title="Upload from file" onClick={() => errorHandler.showWarning('Purchase invoice file import is not connected yet.')}>
              <Upload className="h-3.5 w-3.5" />
            </DocumentIconButton>
            <DocumentIconButton title="Read from image" onClick={() => errorHandler.showWarning('Purchase invoice image reading is not connected yet.')}>
              <FileImage className="h-3.5 w-3.5" />
            </DocumentIconButton>
          </div>
        </div>
      </DocumentControlPanel>

      <DocumentCompactCard
        title={invoice.purchaseOrderId ? 'Header - From Purchase Order' : 'Header - Direct Bill'}
        action={
          <div className="flex items-center gap-1.5">
            <DocumentPill tone={invoice.purchaseOrderId ? 'blue' : 'slate'}>{invoice.purchaseOrderId ? 'From PO' : 'Direct'}</DocumentPill>
            <DocumentPill tone="slate">{invoice.currency}</DocumentPill>
            {invoice.status === 'POSTED' && (
              <DocumentPill tone="green">
                <ShieldCheck className="h-3 w-3" />
                Policy OK
              </DocumentPill>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-6">
          <DocumentField label="Invoice No." value={invoice.invoiceNumber} plain />
          <DocumentField label="Source" value={invoice.purchaseOrderId || 'Direct'} plain />
          <DocumentField label="Vendor" value={viewVendorName} plain />
          <DocumentField label="Vendor Invoice #" value={invoice.vendorInvoiceNumber || '-'} plain />
          <DocumentField label="Invoice Date" value={invoice.invoiceDate} plain />
          <DocumentField label="Due Date" value={invoice.dueDate || '-'} plain />
          <DocumentField label="Currency" value={invoice.currency} plain />
          <DocumentField label="Exchange Rate" value={invoice.exchangeRate} plain />
          <DocumentField label="Payment Terms" value={`${invoice.paymentTermsDays} days`} plain />
          <DocumentField label="Direct Invoicing" value={settings ? (settings.allowDirectInvoicing ? 'Enabled' : 'Disabled') : '-'} plain />
        </div>
      </DocumentCompactCard>

      <DocumentLinesRegion>
        <ClassicLineItemsTable<PurchaseInvoiceLineDTO>
          rows={invoice.lines}
          disabled
          onRowChange={() => undefined}
          addLabel="Add Item"
          columns={[
            {
              id: 'item',
              label: 'Item',
              kind: 'custom',
              width: '260px',
              render: (row) => (
                <div className="flex h-9 items-center truncate px-2 text-xs font-medium text-slate-800 dark:text-slate-100">
                  {row.itemCode ? `${row.itemCode} - ${row.itemName}` : row.itemName}
                </div>
              ),
            },
            { id: 'qty', label: 'Qty', kind: 'computed', width: '80px', compute: (row) => row.invoicedQty },
            { id: 'uom', label: 'UOM', kind: 'custom', width: '90px', render: (row) => <div className="flex h-9 items-center px-2 text-xs uppercase text-slate-700 dark:text-slate-200">{row.uom}</div> },
            { id: 'unitCost', label: 'Unit Cost', kind: 'computed', width: '110px', compute: (row) => row.unitPriceDoc },
            { id: 'taxCode', label: 'Tax Code', kind: 'custom', width: '140px', render: (row) => <div className="flex h-9 items-center px-2 text-xs text-slate-700 dark:text-slate-200">{row.taxCode || row.taxCodeId || 'No Tax'}</div> },
            { id: 'lineTotal', label: 'Line Total', kind: 'computed', width: '110px', compute: (row) => row.lineTotalDoc + row.taxAmountDoc },
            { id: 'net', label: 'Net', kind: 'computed', width: '100px', compute: (row) => row.lineTotalDoc },
            { id: 'tax', label: 'Tax', kind: 'computed', width: '90px', compute: (row) => row.taxAmountDoc },
            { id: 'netBase', label: 'Net Base', kind: 'computed', width: '110px', compute: (row) => row.lineTotalBase },
          ]}
          minRows={1}
          className="flex-1 [&>div:first-child]:h-full [&>div:first-child]:max-h-none"
        />
      </DocumentLinesRegion>

      <DocumentSecondaryPanel
        title="Account Ledger & Purchase Taxes Allocation Grid"
        action={
          <button
            type="button"
            onClick={() => errorHandler.showWarning('Purchase tax preset automation is not connected yet.')}
            className="hidden h-6 items-center rounded border border-emerald-300 px-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-50 md:inline-flex"
          >
            Apply Tax Preset
          </button>
        }
      >
        <DocumentEmptyPanel
          title="No allocation rows"
          description="Real AP, inventory, and tax allocation controls are not shown until the controlled allocation contract is implemented."
        />
      </DocumentSecondaryPanel>

      <div className="grid gap-2 md:grid-cols-2">
        <DocumentCompactCard
          title={t('purchases.invoices.attachments.title', 'Attachments')}
          action={
            <label
              htmlFor={viewAttachmentInputId}
              className="inline-flex h-6 cursor-pointer items-center rounded border border-slate-200 px-2 text-[10px] font-black uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {attachmentBusy ? t('purchases.invoices.attachments.uploading', 'Uploading...') : t('purchases.invoices.attachments.upload', 'Upload')}
            </label>
          }
        >
          <div className="min-h-[56px] p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-slate-500" />
              <div className="min-w-0">
                <div className="font-black text-slate-900 dark:text-slate-100">
                  {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {t('purchases.invoices.attachments.help', 'Allowed: PDF, PNG, JPG, DOCX, XLSX. Max 10 MB per file, 5 files per invoice.')}
                </div>
              </div>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 grid gap-1">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                      {attachment.name}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="text-[10px] font-black uppercase text-slate-600"
                        onClick={() => downloadAttachment(attachment.id)}
                      >
                        {t('purchases.invoices.attachments.open', 'Open')}
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-black uppercase text-rose-600 disabled:opacity-50"
                        onClick={() => setAttachmentPendingDelete(attachment)}
                        disabled={attachmentDeletingId === attachment.id}
                      >
                        {attachmentDeletingId === attachment.id
                          ? t('purchases.invoices.attachments.removing', 'Removing...')
                          : t('purchases.invoices.attachments.remove', 'Remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DocumentCompactCard>

        <DocumentCompactCard
          title="Audit & Warnings"
          action={<DocumentPill tone={invoice.status === 'POSTED' ? 'green' : invoice.status === 'PENDING_APPROVAL' ? 'amber' : 'slate'}>{invoice.status}</DocumentPill>}
        >
          <div className="flex min-h-[56px] items-center gap-2 p-2.5 text-xs">
            <History className="h-4 w-4 text-slate-500" />
            <div className="min-w-0">
              <div className="font-black text-slate-900 dark:text-slate-100">Document checks</div>
              <div className="truncate text-[11px] text-slate-500">
                Status, payment, AP, inventory, and attachment warnings stay visible before legal actions.
              </div>
            </div>
          </div>
        </DocumentCompactCard>
      </div>

    </DocumentDetailScaffold>

      <ConfirmDialog
        isOpen={unpostConfirmOpen}
        title={t('purchases.invoices.unpost.confirmTitle', 'Unpost Purchase Invoice')}
        message={t('purchases.invoices.unpost.confirmMessage', 'This will reverse all accounting and inventory entries posted for this invoice. The action is auditable but cannot be undone in place. Continue?')}
        confirmLabel={t('purchases.invoices.unpost.confirmAction', 'Unpost Invoice')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        isConfirming={busy}
        onConfirm={unpostPI}
        onCancel={() => { if (!busy) setUnpostConfirmOpen(false); }}
      />

      <ConfirmDialog
        isOpen={!!attachmentPendingDelete}
        title={t('purchases.invoices.attachments.confirmRemoveTitle', 'Remove Attachment')}
        message={t('purchases.invoices.attachments.confirmRemoveMessage', {
          defaultValue: 'Remove {{name}} from this purchase invoice?',
          name: attachmentPendingDelete?.name || t('purchases.invoices.attachments.thisFile', 'this file'),
        })}
        confirmLabel={t('purchases.invoices.attachments.remove', 'Remove')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        isConfirming={!!attachmentDeletingId}
        onConfirm={removeAttachment}
        onCancel={() => {
          if (!attachmentDeletingId) setAttachmentPendingDelete(null);
        }}
      />

      <RecordPaymentDialog
        open={recordPaymentOpen}
        module="purchases"
        invoiceNumber={invoice.invoiceNumber}
        partyName={invoice.vendorName}
        currencyCode={invoice.currency}
        outstandingBase={invoice.outstandingAmountBase || 0}
        paymentMethodConfigs={(settings as any)?.paymentMethodConfigs || []}
        allowOverpayment={(settings as any)?.allowOverpayment === true}
        busy={recordPaymentBusy}
        onClose={() => setRecordPaymentOpen(false)}
        onSubmit={handleRecordPayment}
      />
    </>
  );
};

export default PurchaseInvoiceDetailPage;

