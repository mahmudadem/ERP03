import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreatePurchaseInvoicePayload,
  PurchaseInvoiceAttachmentDTO,
  PurchaseInvoiceDTO,
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
import { PartySelector } from '../../../components/shared/selectors';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';

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
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialPurchaseOrderId, initialVendorId));
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderLineLoading, setOrderLineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PurchaseInvoiceAttachmentDTO[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentDeletingId, setAttachmentDeletingId] = useState<string | null>(null);
  const [attachmentPendingDelete, setAttachmentPendingDelete] = useState<PurchaseInvoiceAttachmentDTO | null>(null);
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([]);

  // Settlement state
  const [settlementMode, setSettlementMode] = useState<'DEFERRED' | 'CASH_FULL' | 'MULTI'>('DEFERRED');
  const [apAccountId, setApAccountId] = useState('');
  const [settlementRows, setSettlementRows] = useState<{ settlementAccountId: string; amountBase: number; paymentMethod: string; reference: string; notes: string; paymentDate: string }[]>([]);
  const [showSettlement, setShowSettlement] = useState(false);

  const vendorNameById = useMemo(
    () =>
      vendors.reduce<Record<string, string>>((acc, vendor) => {
        acc[vendor.id] = vendor.displayName;
        return acc;
      }, {}),
    [vendors]
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
      const taxRate = line.taxCodeId ? taxById[line.taxCodeId]?.rate ?? 0 : 0;
      const lineTotalDoc = roundMoney((line.invoicedQty || 0) * (line.unitPriceDoc || 0));
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
    const [settingsResult, vendorResult, itemResult, taxResult, warehouseResult] = await Promise.all([
      purchasesApi.getSettings(),
      sharedApi.listParties({ role: 'VENDOR', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
      inventoryApi.listWarehouses({ active: true }),
    ]);

    const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
    const vendorList = unwrap<PartyDTO[]>(vendorResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);

    setSettings(currentSettings);
    setVendors(Array.isArray(vendorList) ? vendorList : []);
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
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
          next.taxCodeId = undefined;
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

      const posted = await purchasesApi.postPI(invoice.id, settlementInput);
      setInvoice(unwrap<PurchaseInvoiceDTO>(posted));
      setShowSettlement(false);
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
    const outstanding = roundMoney((invoice.grandTotalBase || 0) - (invoice.paidAmountBase || 0));
    if (outstanding > 0.005) {
      setShowSettlement(true);
      setSettlementRows([{ settlementAccountId: '', amountBase: outstanding, paymentMethod: 'CASH', reference: '', notes: '', paymentDate: todayIso() }]);
    } else {
      postDraft();
    }
  };

  const unpostPI = async () => {
    if (!invoice?.id) return;
    if (!window.confirm('Are you sure you want to unpost this invoice? This will reverse all accounting and inventory entries.')) return;
    try {
      setBusy(true);
      setError(null);
      const unposted = await purchasesApi.unpostPI(invoice.id);
      setInvoice(unwrap<PurchaseInvoiceDTO>(unposted));
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
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isCreateMode ? 'New Purchase Invoice' : `Edit ${invoice?.invoiceNumber}`}
          </h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => (isEditMode ? setIsEditMode(false) : navigate('/purchases/invoices'))}
          >
            {isEditMode ? 'Cancel' : 'Back to List'}
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">PO Reference (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.purchaseOrderId}
                  onChange={(e) => setForm((prev) => ({ ...prev, purchaseOrderId: e.target.value }))}
                  placeholder="purchaseOrderId"
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-50"
                  onClick={() => loadPurchaseOrderLines(form.purchaseOrderId)}
                  disabled={busy || orderLineLoading || !form.purchaseOrderId.trim()}
                >
                  {orderLineLoading ? 'Loading...' : 'Load PO Lines'}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
              <PartySelector 
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
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor Invoice #</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.vendorInvoiceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, vendorInvoiceNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Invoice Date</label>
              <DatePicker 
                value={form.invoiceDate}
                onChange={(val) => setForm((prev) => ({ ...prev, invoiceDate: val }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Due Date (optional)</label>
              <DatePicker 
                value={form.dueDate}
                onChange={(val) => setForm((prev) => ({ ...prev, dueDate: val }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Currency</label>
              <CurrencySelector
                value={form.currency}
                onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Exchange Rate</label>
              <CurrencyExchangeWidget
                currency={form.currency}
                baseCurrency={company?.baseCurrency || 'USD'}
                voucherDate={form.invoiceDate}
                value={form.exchangeRate}
                onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
                disabled={busy}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="mt-4 text-xs text-slate-500">
            If PO reference is provided, you can load open order lines into this draft.
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Line Items</h2>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={addLine}
              disabled={busy}
            >
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-left">UOM</th>
                  <th className="py-2 text-right">Unit Cost</th>
                  <th className="py-2 text-left">Tax Code</th>
                  <th className="py-2 text-left">Warehouse</th>
                  <th className="py-2 text-right">Line Total</th>
                  <th className="py-2 text-right">Tax</th>
                  <th className="py-2 text-right">Line Base</th>
                  <th className="py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => (
                  <tr key={line.lineId || `line-${index}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2">
                      <select
                        className="w-52 rounded-lg border border-slate-300 px-2 py-1.5"
                        value={line.itemId}
                        onChange={(e) => setLine(index, { itemId: e.target.value })}
                      >
                        <option value="">Select item</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.code} - {item.name}
                          </option>
                        ))}
                      </select>
                      {(line.itemCode || line.itemName) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {(line.itemCode || '') + (line.itemName ? ` - ${line.itemName}` : '')}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0.000001}
                        step={0.000001}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                        value={line.invoicedQty}
                        onChange={(e) => setLine(index, { invoicedQty: Number(e.target.value) })}
                      />
                    </td>
                  <td className="py-2 pr-2">
                    <select
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 uppercase"
                      value={
                        findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId ||
                        line.uomId ||
                        line.uom
                      }
                      disabled={!line.itemId}
                      onChange={(e) => {
                        const selected = (uomOptionsByItemId[line.itemId] || []).find(
                          (option) => (option.uomId || option.code) === e.target.value
                        );
                        setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' });
                      }}
                    >
                      <option value="">{line.itemId ? 'Select UOM' : 'No item'}</option>
                      {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                        <option key={option.uomId || option.code} value={option.uomId || option.code}>
                          {option.code}
                        </option>
                      ))}
                    </select>
                  </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                        value={line.unitPriceDoc}
                        onChange={(e) => setLine(index, { unitPriceDoc: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="w-40 rounded-lg border border-slate-300 px-2 py-1.5"
                        value={line.taxCodeId || ''}
                        onChange={(e) => setLine(index, { taxCodeId: e.target.value || undefined })}
                      >
                        <option value="">No Tax</option>
                        {purchaseTaxCodes.map((taxCode) => (
                          <option key={taxCode.id} value={taxCode.id}>
                            {taxCode.code} ({Math.round(taxCode.rate * 100)}%)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="w-40 rounded-lg border border-slate-300 px-2 py-1.5"
                        value={line.warehouseId || ''}
                        disabled={busy}
                        onChange={(e) => setLine(index, { warehouseId: e.target.value || undefined })}
                      >
                        <option value="">Select Warehouse</option>
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {form.currency} {computedLines[index]?.lineTotalDoc.toFixed(2)}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {form.currency} {computedLines[index]?.taxAmountDoc.toFixed(2)}
                    </td>
                    <td className="py-2 pr-2 text-right">{computedLines[index]?.lineTotalBase.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                        onClick={() => removeLine(index)}
                        disabled={busy || form.lines.length <= 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Totals</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal ({form.currency})</span>
              <span className="font-medium">
                {form.currency} {totals.subtotalDoc.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal (Base)</span>
              <span className="font-medium">{totals.subtotalBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tax ({form.currency})</span>
              <span className="font-medium">
                {form.currency} {totals.taxTotalDoc.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tax (Base)</span>
              <span className="font-medium">{totals.taxTotalBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total ({form.currency})</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {form.currency} {totals.grandTotalDoc.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total (Base)</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{totals.grandTotalBase.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {isCreateMode && (
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('purchases.invoices.attachments.title', 'Attachments')}
              </h2>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                  onChange={uploadAttachment}
                  disabled={attachmentBusy || pendingAttachmentFiles.length >= MAX_ATTACHMENT_FILES}
                />
                {t('purchases.invoices.attachments.upload', 'Upload Attachment')}
              </label>
            </div>

            <p className="mb-4 text-xs text-slate-500">
              {t(
                'purchases.invoices.attachments.unsavedHelp',
                'Files selected here are queued locally and uploaded automatically when the invoice is saved.'
              )}
            </p>

            {pendingAttachmentFiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                {t('purchases.invoices.attachments.emptyQueued', 'No attachments queued yet.')}
              </div>
            ) : (
              <div className="space-y-2">
                {pendingAttachmentFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {file.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatFileSize(file.size)} - {file.type || t('purchases.invoices.attachments.unknownType', 'Unknown type')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
                      onClick={() => setPendingAttachmentFiles((current) => current.filter((_, idx) => idx !== index))}
                    >
                      {t('purchases.invoices.attachments.remove', 'Remove')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {showSettlement && (
          <Card className="p-5 border-blue-200 bg-blue-50">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Settlement on Save & Post</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Settlement Mode</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={settlementMode}
                  onChange={(e) => setSettlementMode(e.target.value as any)}
                >
                  <option value="DEFERRED">Deferred (No Payment)</option>
                  <option value="CASH_FULL">Cash Full Payment</option>
                  <option value="MULTI">Multiple Payments</option>
                </select>
              </div>

              {settlementMode !== 'DEFERRED' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">AP Account</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={apAccountId}
                      onChange={(e) => setApAccountId(e.target.value)}
                      placeholder="Account ID or Code"
                    />
                  </div>

                  {settlementRows.map((row, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                      <div className="text-sm font-medium text-slate-700">Payment Row {idx + 1}</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium">Settlement Account</label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.settlementAccountId}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].settlementAccountId = e.target.value;
                              setSettlementRows(updated);
                            }}
                            placeholder="Account ID or Code"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Amount (Base)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.amountBase}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].amountBase = parseFloat(e.target.value) || 0;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Payment Method</label>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.paymentMethod}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].paymentMethod = e.target.value;
                              setSettlementRows(updated);
                            }}
                          >
                            <option value="CASH">Cash</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="CHECK">Check</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Payment Date</label>
                          <input
                            type="date"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.paymentDate}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].paymentDate = e.target.value;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Reference</label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.reference}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].reference = e.target.value;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Notes</label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.notes}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].notes = e.target.value;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                      </div>
                      {settlementMode === 'MULTI' && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:text-red-800"
                          onClick={() => setSettlementRows(settlementRows.filter((_, i) => i !== idx))}
                        >
                          Remove Row
                        </button>
                      )}
                    </div>
                  ))}

                  {settlementMode === 'MULTI' && (
                    <button
                      type="button"
                      className="rounded-lg border border-blue-300 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                      onClick={() => setSettlementRows([...settlementRows, { settlementAccountId: '', amountBase: roundMoney(totals.grandTotalBase / (settlementRows.length + 1)), paymentMethod: 'CASH', reference: '', notes: '', paymentDate: todayIso() }])}
                    >
                      + Add Payment Row
                    </button>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={createAndPostDraft}
                  disabled={busy || orderLineLoading}
                >
                  {busy ? 'Saving & Posting...' : 'Confirm Save & Post'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                  onClick={() => setShowSettlement(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50"
            onClick={saveInvoice}
            disabled={busy || orderLineLoading}
          >
            {busy ? 'Saving...' : isCreateMode ? 'Save Draft' : 'Update Draft'}
          </button>
          {isCreateMode && (
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                const outstanding = roundMoney(totals.grandTotalBase);
                if (outstanding > 0.005) {
                  setShowSettlement(true);
                  setSettlementRows([{ settlementAccountId: '', amountBase: outstanding, paymentMethod: 'CASH', reference: '', notes: '', paymentDate: todayIso() }]);
                } else {
                  setSettlementMode('DEFERRED');
                  createAndPostDraft();
                }
              }}
              disabled={busy || orderLineLoading}
            >
              {busy ? 'Saving & Posting...' : 'Save & Post'}
            </button>
          )}
        </div>
      </div>
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
  const paymentHref = `/accounting/vouchers?mode=create&type=payment&sourceType=PURCHASE_INVOICE&sourceId=${invoice.id}`;
  const createReturnHref = `/purchases/returns/new?purchaseInvoiceId=${encodeURIComponent(invoice.id)}${
    invoice.purchaseOrderId ? `&purchaseOrderId=${encodeURIComponent(invoice.purchaseOrderId)}` : ''
  }`;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-600">
            Vendor: <span className="font-medium">{vendorNameById[invoice.vendorId] || invoice.vendorName}</span>
            {invoice.vendorInvoiceNumber ? ` • Vendor Ref: ${invoice.vendorInvoiceNumber}` : ''}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {invoice.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Invoice Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.invoiceDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Due Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.dueDate || '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">PO Reference</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.purchaseOrderId || '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Currency</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.currency}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Exchange Rate</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.exchangeRate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Direct Invoicing</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {settings ? (settings.allowDirectInvoicing ? 'Enabled' : 'Disabled') : '-'}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Lines</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-left">Tax Code</th>
                <th className="py-2 text-right">Line Total</th>
                <th className="py-2 text-right">Tax</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                  <td className="py-2 text-right">{line.invoicedQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitPriceDoc.toFixed(2)}</td>
                  <td className="py-2">{line.taxCode || line.taxCodeId || '-'}</td>
                  <td className="py-2 text-right">{line.lineTotalDoc.toFixed(2)}</td>
                  <td className="py-2 text-right">{line.taxAmountDoc.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Payment Info</h2>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Payment Terms (days)</span>
            <span className="font-medium">{invoice.paymentTermsDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Payment Status</span>
            <span className="font-medium">{invoice.paymentStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Outstanding (Base)</span>
            <span className="font-medium">{invoice.outstandingAmountBase.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Paid (Base)</span>
            <span className="font-medium">{invoice.paidAmountBase.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('purchases.invoices.attachments.title', 'Attachments')}
          </h2>
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
              onChange={uploadAttachment}
              disabled={attachmentBusy}
            />
            {attachmentBusy
              ? t('purchases.invoices.attachments.uploading', 'Uploading...')
              : t('purchases.invoices.attachments.upload', 'Upload Attachment')}
          </label>
        </div>

        <p className="mb-4 text-xs text-slate-500">
          {t(
            'purchases.invoices.attachments.help',
            'Allowed: PDF, PNG, JPG, DOCX, XLSX. Max 10 MB per file, 5 files per invoice.'
          )}
        </p>

        {attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            {t('purchases.invoices.attachments.empty', 'No attachments yet.')}
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {attachment.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatFileSize(attachment.size)} - {attachment.type} - {new Date(attachment.uploadedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                    onClick={() => downloadAttachment(attachment.id)}
                  >
                    {t('purchases.invoices.attachments.open', 'Open')}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50"
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
      </Card>

      {showSettlement && invoice && (
        <Card className="p-5 border-blue-200 bg-blue-50">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Settlement on Post</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Settlement Mode</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value as any)}
              >
                <option value="DEFERRED">Deferred (No Payment)</option>
                <option value="CASH_FULL">Cash Full Payment</option>
                <option value="MULTI">Multiple Payments</option>
              </select>
            </div>

            {settlementMode !== 'DEFERRED' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">AP Account</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={apAccountId}
                    onChange={(e) => setApAccountId(e.target.value)}
                    placeholder="Account ID or Code"
                  />
                </div>

                {settlementRows.map((row, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="text-sm font-medium text-slate-700">Payment Row {idx + 1}</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium">Settlement Account</label>
                        <input
                          type="text"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.settlementAccountId}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].settlementAccountId = e.target.value;
                            setSettlementRows(updated);
                          }}
                          placeholder="Account ID or Code"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Amount (Base)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.amountBase}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].amountBase = parseFloat(e.target.value) || 0;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Payment Method</label>
                        <select
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.paymentMethod}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].paymentMethod = e.target.value;
                            setSettlementRows(updated);
                          }}
                        >
                          <option value="CASH">Cash</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHECK">Check</option>
                          <option value="CREDIT_CARD">Credit Card</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Payment Date</label>
                        <input
                          type="date"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.paymentDate}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].paymentDate = e.target.value;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Reference</label>
                        <input
                          type="text"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.reference}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].reference = e.target.value;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Notes</label>
                        <input
                          type="text"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.notes}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].notes = e.target.value;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                    </div>
                    {settlementMode === 'MULTI' && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800"
                        onClick={() => setSettlementRows(settlementRows.filter((_, i) => i !== idx))}
                      >
                        Remove Row
                      </button>
                    )}
                  </div>
                ))}

                {settlementMode === 'MULTI' && (
                  <button
                    type="button"
                    className="rounded-lg border border-blue-300 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                    onClick={() => setSettlementRows([...settlementRows, { settlementAccountId: '', amountBase: 0, paymentMethod: 'CASH', reference: '', notes: '', paymentDate: todayIso() }])}
                  >
                    + Add Payment Row
                  </button>
                )}
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={postDraft}
                disabled={busy}
              >
                {busy ? 'Posting...' : 'Confirm & Post'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={() => setShowSettlement(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => navigate('/purchases/invoices')}
        >
          Back to List
        </button>
        {invoice.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={toggleEdit}
            disabled={busy}
          >
            Edit Draft
          </button>
        )}
        {invoice.status === 'DRAFT' && !showSettlement && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            onClick={handlePostClick}
            disabled={busy}
          >
            {busy ? 'Posting...' : 'Post Invoice'}
          </button>
        )}
        {invoice.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => navigate(createReturnHref)}
            disabled={!canCreateReturn}
          >
            Create Return
          </button>
        )}
        {invoice.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => navigate(paymentHref)}
            disabled={!canCreatePayment}
          >
            Create Payment
          </button>
        )}
        {invoice.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            onClick={unpostPI}
            disabled={busy || canCreatePayment === false || invoice.paymentStatus !== 'UNPAID'}
          >
            {busy ? 'Unposting...' : 'Unpost Invoice'}
          </button>
        )}
      </div>

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
    </div>
  );
};

export default PurchaseInvoiceDetailPage;

