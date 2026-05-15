/**
 * useVoucherActions Hook
 * 
 * ══════════════════════════════════════════════════════════════════
 *  SINGLE SOURCE OF TRUTH for voucher action execution
 * ══════════════════════════════════════════════════════════════════
 * 
 * This hook provides all voucher action handlers (save, submit,
 * approve, reject, confirm, post, cancel, reverse, delete).
 * 
 * All views (VoucherTable, VoucherEntryModal, VoucherWindow,
 * VouchersListPage) should use this hook instead of defining
 * their own handlers.
 * 
 * Action VISIBILITY is determined by voucherActions.ts (pure logic).
 * Action EXECUTION is provided by this hook.
 * 
 * Usage:
 *   const { actions, executeAction } = useVoucherActions();
 *   // Or use individual handlers:
 *   const { approve, reject, post, ... } = useVoucherActions();
 */

import { accountingApi, CorrectionMode, CorrectionRequest } from '../api/accountingApi';
import { salesApi } from '../api/salesApi';
import { purchasesApi } from '../api/purchasesApi';
import { errorHandler } from '../services/errorHandler';
import { VoucherActionType } from '../modules/accounting/utils/voucherActions';

export interface VoucherActionHandlers {
  /** Save a voucher (create or update) */
  save: (windowId: string, data: any) => Promise<any>;
  /** Save and submit for approval */
  submit: (windowId: string, data: any) => Promise<any>;
  /** Approve/verify a pending voucher */
  approve: (id: string) => Promise<void>;
  /** Reject a pending voucher */
  reject: (id: string, reason?: string) => Promise<void>;
  /** Confirm custody on a pending voucher */
  confirmCustody: (id: string) => Promise<void>;
  /** Post an approved voucher to the ledger */
  post: (id: string) => Promise<void>;
  /** Cancel/void a draft or approved voucher */
  cancel: (id: string) => Promise<void>;  
  /** Reverse a posted voucher (creates a reversing entry) */
  reverse: (id: string) => Promise<void>;
  /** Reverse and replace a posted voucher */
  reverseAndReplace: (id: string, request: CorrectionRequest) => Promise<void>;
  /** Delete a voucher permanently */
  remove: (id: string) => Promise<void>;
  /** Trigger print for a voucher */
  print: (id: string) => void;
  /** Execute any action by type */
  executeAction: (type: VoucherActionType, id: string, extra?: any) => Promise<void>;
  /** Force refresh the voucher list */
  refreshList: () => void;
}

// Legacy-compatible types for WindowsDesktop props
export interface LegacyVoucherHandlers {
  handleSaveVoucher: (windowId: string, data: any) => Promise<any>;
  handleSubmitVoucher: (windowId: string, data: any) => Promise<any>;
  handleApproveVoucher: (windowId: string, id: string) => Promise<void>;
  handleRejectVoucher: (windowId: string, id: string, reason?: string) => Promise<void>;
  handleConfirmVoucher: (windowId: string, id: string) => Promise<void>;
}

const dispatchUpdate = () => {
  window.dispatchEvent(new CustomEvent('vouchers-updated'));
};

const dispatchPrint = (id: string) => {
  window.dispatchEvent(new CustomEvent('print-voucher', { detail: { id } }));
};

const UI_ONLY_TOP_LEVEL_FIELDS = new Set([
  'voucherConfig',
  'headerFields',
  'tableColumns',
  'uiModeOverrides',
  'tableStyle',
  'actions',
  'rules',
  '_isForm',
  '_rowId',
]);

const UI_ONLY_METADATA_FIELDS = new Set([
  'voucherConfig',
  'headerFields',
  'tableColumns',
  'uiModeOverrides',
  'tableStyle',
  'actions',
  'rules',
]);

const LEGACY_SOURCE_KEYS = new Set([
  'sourceVoucher',
  'sourcePayload'
]);

// These fields are owned by backend lifecycle/state and must never be restored from source snapshots.
const SYSTEM_MANAGED_SOURCE_FIELDS = new Set([
  'id',
  'voucherNo',
  'voucherNumber',
  'status',
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt',
  'approvedBy',
  'approvedAt',
  'rejectedBy',
  'rejectedAt',
  'postedBy',
  'postedAt',
  'postingLockPolicy'
]);
const SYSTEM_MANAGED_SOURCE_FIELDS_LOWER = new Set(
  Array.from(SYSTEM_MANAGED_SOURCE_FIELDS).map((key) => key.toLowerCase())
);

const isPlainObject = (value: any): value is Record<string, any> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const deepMergeObjects = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => {
  const merged: Record<string, any> = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      merged[key] = deepMergeObjects(baseValue, value);
    } else {
      merged[key] = value;
    }
  });
  return merged;
};

const stripSystemManagedSourceFields = (snapshot: any): any => {
  if (!isPlainObject(snapshot)) return snapshot;
  const out: Record<string, any> = {};
  Object.entries(snapshot).forEach(([key, value]) => {
    if (SYSTEM_MANAGED_SOURCE_FIELDS_LOWER.has(String(key).toLowerCase())) {
      return;
    }
    out[key] = value;
  });
  return out;
};

const sanitizeSourceSnapshot = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeSourceSnapshot(entry))
      .filter((entry) => entry !== undefined);
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (!key) return;
    if (UI_ONLY_TOP_LEVEL_FIELDS.has(key)) return;
    if (LEGACY_SOURCE_KEYS.has(key)) return;
    if (key === 'metadata' && isPlainObject(entry)) {
      const cleanedMeta = sanitizeMetadata(entry);
      if (cleanedMeta && Object.keys(cleanedMeta).length > 0) {
        out[key] = cleanedMeta;
      }
      return;
    }
    const cleaned = sanitizeSourceSnapshot(entry);
    if (cleaned === undefined) return;
    out[key] = cleaned;
  });
  return out;
};

const ENTITY_REF_KEYS = [
  'id',
  'value',
  'code',
  'key',
  'uid',
  'uuid',
  'accountId',
  'itemId',
  'warehouseId',
  'customerId',
  'vendorId',
  'partyId',
  'formType',
  'baseType',
  'voucherType',
  'name',
  'label',
];

const DISPLAY_TEXT_KEYS = [
  'label',
  'name',
  'displayName',
  'text',
  'code',
  'value',
  'id',
  'key',
];

const toEntityRef = (value: any): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || undefined;
  }
  if (typeof value === 'object') {
    for (const key of ENTITY_REF_KEYS) {
      const candidate = value[key];
      if (candidate === undefined || candidate === null || candidate === '') continue;
      const text = String(candidate).trim();
      if (text) return text;
    }
  }
  return undefined;
};

const toDisplayText = (value: any): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || undefined;
  }
  if (typeof value === 'object') {
    for (const key of DISPLAY_TEXT_KEYS) {
      const candidate = value[key];
      if (candidate === undefined || candidate === null || candidate === '') continue;
      const text = String(candidate).trim();
      if (text) return text;
    }
  }
  return undefined;
};

const firstEntityRef = (...values: any[]): string | undefined => {
  for (const value of values) {
    const ref = toEntityRef(value);
    if (ref) return ref;
  }
  return undefined;
};

const firstDisplayText = (...values: any[]): string | undefined => {
  for (const value of values) {
    const text = toDisplayText(value);
    if (text) return text;
  }
  return undefined;
};

const toAccountRef = (value: any): string | undefined => toEntityRef(value);

const sanitizeMetadata = (metadata: any): Record<string, any> | undefined => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const cleaned = Object.entries(metadata).reduce((acc, [key, value]) => {
    if (UI_ONLY_METADATA_FIELDS.has(key)) return acc;
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {} as Record<string, any>);
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

type DocumentSource = 'native' | 'default_form' | 'custom_form';

const resolveDocumentSource = (data: any): DocumentSource => {
  const config = data?.voucherConfig || {};
  const rawSource = firstEntityRef(
    data?.documentSource,
    data?.source,
    data?.metadata?.documentSource,
    config.documentSource,
    config.source
  );
  const source = String(rawSource || '').trim().toLowerCase();

  if (source === 'native') return 'native';
  if (source === 'default_form' || source === 'default' || source === 'system_form') return 'default_form';
  if (source === 'custom_form' || source === 'custom' || source === 'cloned') return 'custom_form';

  const isDefaultForm = Boolean(
    data?.isSystemDefault ||
    data?.isSystemGenerated ||
    data?.isDefault ||
    data?.isLocked ||
    config.isSystemDefault ||
    config.isSystemGenerated ||
    config.isDefault ||
    config.isLocked
  );

  return isDefaultForm ? 'default_form' : 'custom_form';
};

/**
 * Internal save logic — transforms UI data to V2 API payload
 */
const saveVoucherInternal = async (data: any): Promise<any> => {
  const normalizeType = (value: any): string => {
    const raw = String(toEntityRef(value) || '').trim().toLowerCase();
    if (!raw) return 'journal_entry';
    if (raw.includes('purchase_invoice')) return raw;
    if (raw.includes('purchase_order')) return 'purchase_order';
    if (raw.includes('purchase_return')) return 'purchase_return';
    if (raw.includes('goods_receipt') || raw === 'grn') return 'goods_receipt';
    if (raw.includes('sales_invoice')) return raw;
    if (raw.includes('sales_order')) return 'sales_order';
    if (raw.includes('sales_return')) return 'sales_return';
    if (raw.includes('delivery_note')) return 'delivery_note';
    if (raw.includes('receipt')) return 'receipt';
    if (raw.includes('payment')) return 'payment';
    if (raw.includes('opening')) return 'opening_balance';
    if (raw.includes('revaluation') || raw.includes('fx')) return 'fx_revaluation';
    if (raw.includes('journal') || raw === 'jv') return 'journal_entry';
    return raw;
  };

  const detectSemanticTypeFromLines = (lines: any[]): string | undefined => {
    if (!Array.isArray(lines) || lines.length === 0) return undefined;
    const hasReceiptShape = lines.some((line: any) =>
      !!toAccountRef(line?.receiveFromAccountId || line?.metadata?.receiveFromAccountId)
    );
    if (hasReceiptShape) return 'receipt';

    const hasPaymentShape = lines.some((line: any) =>
      !!toAccountRef(line?.payToAccountId || line?.metadata?.payToAccountId)
    );
    if (hasPaymentShape) return 'payment';

    return undefined;
  };

  const detectedTypeFromLines = detectSemanticTypeFromLines(data.lines || []);
  const resolvedType = normalizeType(firstEntityRef(
    data.type ||
    data.typeId,
    data.formType,
    data.baseType,
    data.metadata?.type,
    data.metadata?.typeId,
    detectedTypeFromLines ||
    data.voucherConfig?.formType,
    data.voucherConfig?.baseType,
    data.voucherConfig?.code
  ));
  const isReceipt = resolvedType === 'receipt';
  const isPayment = resolvedType === 'payment';
  const explicitHeaderCurrency = String(toEntityRef(data.currency) || '').toUpperCase();
  const fallbackHeaderCurrency = String(firstEntityRef(
    data.baseCurrency ||
    data.voucherConfig?.defaultCurrency
  ) || '').toUpperCase();
  // Never infer header currency from lines on save; preserve explicit source state.
  const headerCurrency = explicitHeaderCurrency || fallbackHeaderCurrency;
  const baseCurrency = String(toEntityRef(data.baseCurrency) || '').toUpperCase();
  const exchangeRate = Number(data.exchangeRate) || 1;
  const metadata = sanitizeMetadata(data.metadata);
  const documentSource = resolveDocumentSource(data);
  const explicitSnapshot = sanitizeSourceSnapshot(
    data && isPlainObject(data.sourcePayload) ? data.sourcePayload : undefined
  );
  const fallbackSnapshot = sanitizeSourceSnapshot(data);
  const mergedSnapshot = (isPlainObject(explicitSnapshot) && isPlainObject(fallbackSnapshot))
    ? deepMergeObjects(fallbackSnapshot, explicitSnapshot)
    : (explicitSnapshot ?? fallbackSnapshot);
  const sourcePayload = stripSystemManagedSourceFields(mergedSnapshot);

  const semanticLines = (data.lines || [])
    .map((line: any) => {
      const accountRef = isReceipt
        ? toAccountRef(line.receiveFromAccountId || line.accountId || line.account)
        : toAccountRef(line.payToAccountId || line.accountId || line.account);
      const amount = Math.abs(Number(line.amount || line.debit || line.credit || 0));
      const lineCurrency = String(firstEntityRef(line.currency, line.lineCurrency) || '').toUpperCase();
      const lineParity = Number(line.exchangeRate || line.parity || 1) || 1;
      return isReceipt
        ? {
            receiveFromAccountId: accountRef,
            amount,
            notes: firstDisplayText(line.description, line.notes) || '',
            costCenterId: firstEntityRef(line.costCenterId, line.category) || null,
            currency: lineCurrency || undefined,
            lineCurrency: lineCurrency || undefined,
            exchangeRate: lineParity,
            parity: lineParity,
            metadata: sanitizeMetadata(line.metadata) || {}
          }
        : {
            payToAccountId: accountRef,
            amount,
            notes: firstDisplayText(line.description, line.notes) || '',
            costCenterId: firstEntityRef(line.costCenterId, line.category) || null,
            currency: lineCurrency || undefined,
            lineCurrency: lineCurrency || undefined,
            exchangeRate: lineParity,
            parity: lineParity,
            metadata: sanitizeMetadata(line.metadata) || {}
          };
    })
    .filter((line: any) => {
      const accountRef = isReceipt ? line.receiveFromAccountId : line.payToAccountId;
      return !!accountRef && Number(line.amount) > 0;
    });

  const payload: any = {
    type: resolvedType,
    ...(data.id ? { id: data.id } : {}),
    voucherNo: data.voucherNumber || data.voucherNo || undefined,
    description: firstDisplayText(data.description, data.notes),
    formId: toEntityRef(data.formId),
    typeId: toEntityRef(data.typeId),
    prefix: firstDisplayText(data.prefix),
    numberFormat: firstDisplayText(data.numberFormat),
    date: firstDisplayText(data.date),
    reference: firstDisplayText(data.reference),
    postingPeriodNo: data.postingPeriodNo ?? undefined,
    status: data.status || undefined,
    sourceModule: data.sourceModule || 'accounting',
    currency: headerCurrency || undefined,
    baseCurrency: baseCurrency || undefined,
    exchangeRate,
    sourcePayload: sourcePayload || undefined,
    ...(metadata ? { metadata } : {}),
    ...(isReceipt
      ? {
          depositToAccountId: firstEntityRef(data.depositToAccountId, data.accountId, data.account),
          lines: semanticLines
        }
      : isPayment
        ? {
          payFromAccountId: firstEntityRef(data.payFromAccountId, data.accountId, data.account),
            lines: semanticLines
          }
        : {
            lines: (data.lines || []).map((line: any) => {
              const side = line.side || (Number(line.debit || 0) > 0 ? 'Debit' : 'Credit');
              const fxAmount = Math.abs(Number(line.amount || line.debit || line.credit || 0));

              let baseAmount = Math.abs(Number(line.baseAmount || 0));
              if (baseAmount === 0) {
                baseAmount = fxAmount * exchangeRate;
              }

              const lineCurrency = firstEntityRef(line.currency, line.lineCurrency, data.currency) || baseCurrency;

              return {
                id: toEntityRef(line.id),
                accountId: firstEntityRef(line.accountId, line.account),
                side,
                amount: fxAmount,
                currency: lineCurrency,
                baseAmount,
                baseCurrency,
                exchangeRate: Number(line.exchangeRate || line.parity || exchangeRate),
                notes: firstDisplayText(line.description, line.notes),
                costCenterId: firstEntityRef(line.costCenterId, line.category) || null,
                metadata: sanitizeMetadata(line.metadata) || {}
              };
            })
          })
  };

  const cleanPayload = Object.entries(payload).reduce((acc, [key, value]) => {
    if (UI_ONLY_TOP_LEVEL_FIELDS.has(key)) return acc;
    if (value !== '' && value !== undefined && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {} as any);

  if (cleanPayload.id && cleanPayload.id.toString().startsWith('voucher-')) {
    delete cleanPayload.id;
  }

  const SALES_INVOICE_PERSONA_CODES = new Set([
    'sales_invoice',
    'sales_invoice_direct',
    'sales_invoice_linked',
    'sales_invoice_service',
  ]);

  const SALES_INVOICE_VOUCHER_TYPES = new Set([
    'sales_invoice',
    'sales_invoice_direct',
    'sales_invoice_linked',
    'sales_invoice_service',
  ]);

  const resolvePersona = (code: string): 'direct' | 'linked' | 'service' => {
    const normalized = String(toEntityRef(code) || '').toLowerCase();
    if (normalized.includes('linked') || normalized.includes('operational')) return 'linked';
    if (normalized.includes('service')) return 'service';
    return 'direct';
  };

  const resolveVoucherType = (code: string): string => {
    const normalized = String(toEntityRef(code) || '').toLowerCase();
    if (SALES_INVOICE_VOUCHER_TYPES.has(normalized)) return 'sales_invoice';
    if (normalized === 'purchase_invoice' || normalized.startsWith('purchase_invoice_')) return 'purchase_invoice';
    if (normalized === 'sales_order') return 'sales_order';
    if (normalized === 'sales_return') return 'sales_return';
    if (normalized === 'delivery_note') return 'delivery_note';
    if (normalized === 'purchase_invoice') return 'purchase_invoice';
    if (normalized === 'purchase_order') return 'purchase_order';
    if (normalized === 'purchase_return') return 'purchase_return';
    if (normalized === 'goods_receipt') return 'goods_receipt';
    return normalized;
  };

  const formType = firstEntityRef(
    data.formType,
    data.voucherConfig?.formType,
    data.code,
    data.formId,
    data.voucherTypeId,
    resolvedType
  ) || resolvedType;
  const voucherType = resolveVoucherType(
    firstEntityRef(
      data.voucherType,
      data.voucherConfig?.voucherType,
      data.voucherConfig?.baseType,
      resolvedType
    ) ||
    resolvedType
  );
  const rawPersona = firstEntityRef(data.persona, data.voucherConfig?.persona, formType, resolvedType) || resolvedType;
  const persona = ['direct', 'linked', 'service'].includes(String(rawPersona).toLowerCase())
    ? String(rawPersona).toLowerCase() as 'direct' | 'linked' | 'service'
    : resolvePersona(rawPersona);

  const PURCHASE_INVOICE_PERSONA_CODES = new Set([
    'purchase_invoice',
    'purchase_invoice_direct',
    'purchase_invoice_linked',
    'purchase_invoice_service',
  ]);

  const PURCHASE_INVOICE_VOUCHER_TYPES = new Set([
    'purchase_invoice',
    'purchase_invoice_direct',
    'purchase_invoice_linked',
    'purchase_invoice_service',
  ]);

  const resolvePurchasePersona = (code: string): 'direct' | 'linked' | 'service' => {
    const normalized = String(toEntityRef(code) || '').toLowerCase();
    if (normalized.includes('linked') || normalized.includes('operational')) return 'linked';
    if (normalized.includes('service')) return 'service';
    return 'direct';
  };

  // Route to correct API based on voucher type
const isSalesInvoice = SALES_INVOICE_PERSONA_CODES.has(resolvedType);
  const isSalesOrder = resolvedType === 'sales_order';
  const isSalesReturn = resolvedType === 'sales_return';
  const isDeliveryNote = resolvedType === 'delivery_note';
  const isPurchaseInvoice = PURCHASE_INVOICE_PERSONA_CODES.has(resolvedType);
  const isPurchaseOrder = resolvedType === 'purchase_order';
  const isPurchaseReturn = resolvedType === 'purchase_return';
  const isGoodsReceipt = resolvedType === 'goods_receipt';
  const isSubledgerDocument = isSalesInvoice || isSalesOrder || isSalesReturn || isDeliveryNote ||
    isPurchaseInvoice || isPurchaseOrder || isPurchaseReturn || isGoodsReceipt;

  let savedVoucher;
  
  if (isSubledgerDocument) {
    // Route to subledger-specific API (sales/purchase)
    if (isSalesInvoice) {
      const siPayload = {
        formType,
        voucherType,
        persona,
        source: documentSource,
        customerId: firstEntityRef(data.customerId, data.partyId, data.customer) || '',
        customerAccountId: firstEntityRef(data.customerAccountId, data.receivablePayableAccountId, data.arAccountId),
        receivablePayableAccountId: firstEntityRef(data.customerAccountId, data.receivablePayableAccountId, data.arAccountId),
        salesOrderId: firstEntityRef(data.salesOrderId, data.soId, data.sourceDocumentId),
        invoiceDate: firstDisplayText(data.invoiceDate, data.date) || new Date().toISOString().split('T')[0],
        dueDate: firstDisplayText(data.dueDate),
        currency: headerCurrency || undefined,
        exchangeRate: exchangeRate || 1,
        notes: firstDisplayText(data.notes, data.description),
        lines: (data.lines || [])
          .map((l: any, index: number) => {
            const itemId = firstEntityRef(l.itemId, l.item, l.productId);
            const warehouseId = firstEntityRef(l.warehouseId, l.warehouse, data.warehouseId, data.warehouse);
            return {
            lineId: firstEntityRef(l.lineId, l.id),
            lineNo: l.lineNo || index + 1,
            soLineId: firstEntityRef(l.soLineId, l.salesOrderLineId, l.sourceLineId),
            dnLineId: firstEntityRef(l.dnLineId, l.deliveryNoteLineId),
            itemId,
            invoicedQty: Number(l.invoicedQty ?? l.qty ?? l.quantity ?? l.deliveredQty ?? l.orderedQty) || 0,
            uomId: firstEntityRef(l.uomId, l.uom),
            uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
            unitPriceDoc: Number(l.unitPriceDoc ?? l.unitPrice ?? l.price ?? l.rate) || 0,
            taxCodeId: firstEntityRef(l.taxCodeId, l.taxCode),
            warehouseId,
            description: firstDisplayText(l.description, l.notes),
          };
          })
          .filter((l: any) => !!l.itemId && Number(l.invoicedQty) > 0),
      };
      
      if (cleanPayload.id) {
        const isDirect = persona === 'direct';
        const isFlexible = metadata?.creationMode === 'FLEXIBLE';
        
        if (isDirect && isFlexible) {
          savedVoucher = await salesApi.updateAndPostSI(cleanPayload.id, siPayload);
        } else {
          savedVoucher = await salesApi.updateSI(cleanPayload.id, siPayload);
        }
      } else {
        // If it's a Direct Sales Invoice and we are in FLEXIBLE mode, 
        // use the atomic create-and-post endpoint.
        const isDirect = persona === 'direct';
        const isFlexible = metadata?.creationMode === 'FLEXIBLE';
        
        if (isDirect && isFlexible) {
          savedVoucher = await salesApi.createAndPostSI(siPayload);
        } else {
          savedVoucher = await salesApi.createSI(siPayload);
        }
      }
} else if (isPurchaseInvoice) {
      const purchaseVoucherType = resolveVoucherType(
        firstEntityRef(
          data.voucherType,
          data.voucherConfig?.voucherType,
          data.voucherConfig?.baseType,
          resolvedType
        ) ||
        resolvedType
      );
      const purchaseFormType = firstEntityRef(
        data.formType,
        data.voucherConfig?.formType,
        data.code,
        data.formId,
        data.voucherTypeId,
        resolvedType
      ) || resolvedType;
      const purchaseRawPersona = firstEntityRef(data.persona, data.voucherConfig?.persona, purchaseFormType, resolvedType) || resolvedType;
      const purchasePersona = ['direct', 'linked', 'service'].includes(String(purchaseRawPersona).toLowerCase())
        ? String(purchaseRawPersona).toLowerCase() as 'direct' | 'linked' | 'service'
        : resolvePurchasePersona(purchaseRawPersona);

      const piPayload = {
        formType: purchaseFormType,
        voucherType: purchaseVoucherType,
        persona: purchasePersona,
        source: documentSource,
        purchaseOrderId: firstEntityRef(data.purchaseOrderId, data.poId, data.sourceDocumentId),
        vendorId: firstEntityRef(data.vendorId, data.supplierId, data.partyId, data.vendor) || '',
        vendorAccountId: firstEntityRef(data.vendorAccountId, data.receivablePayableAccountId, data.apAccountId),
        receivablePayableAccountId: firstEntityRef(data.vendorAccountId, data.receivablePayableAccountId, data.apAccountId),
        vendorInvoiceNumber: firstDisplayText(data.vendorInvoiceNumber, data.supplierInvoiceNo, data.invoiceNumber),
        invoiceDate: firstDisplayText(data.invoiceDate, data.date) || new Date().toISOString().split('T')[0],
        dueDate: firstDisplayText(data.dueDate),
        currency: headerCurrency || undefined,
        exchangeRate: exchangeRate || 1,
        notes: firstDisplayText(data.notes, data.description),
        lines: (data.lines || []).map((l: any) => ({
          lineId: firstEntityRef(l.lineId, l.id),
          lineNo: l.lineNo,
          poLineId: firstEntityRef(l.poLineId, l.purchaseOrderLineId, l.sourceLineId),
          grnLineId: firstEntityRef(l.grnLineId, l.goodsReceiptLineId),
          itemId: firstEntityRef(l.itemId, l.item, l.productId),
          invoicedQty: Number(l.invoicedQty ?? l.qty ?? l.quantity) || 0,
          uomId: firstEntityRef(l.uomId, l.uom),
          uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
          unitPriceDoc: Number(l.unitPriceDoc ?? l.unitPrice ?? l.price ?? l.rate) || 0,
          taxCodeId: firstEntityRef(l.taxCodeId, l.taxCode),
          warehouseId: firstEntityRef(l.warehouseId, l.warehouse, data.warehouseId, data.warehouse),
          description: firstDisplayText(l.description, l.notes),
        })).filter((l: any) => !!l.itemId),
      };
      
      if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
        const isDirect = purchasePersona === 'direct';
        const isFlexible = metadata?.creationMode === 'FLEXIBLE';

        if (isDirect && isFlexible) {
          savedVoucher = await purchasesApi.updateAndPostPI(cleanPayload.id, piPayload);
        } else {
          savedVoucher = await purchasesApi.updatePI(cleanPayload.id, piPayload);
        }
      } else {
        const isDirect = purchasePersona === 'direct';
        const isFlexible = metadata?.creationMode === 'FLEXIBLE';

        if (isDirect && isFlexible) {
          savedVoucher = await purchasesApi.createAndPostPI(piPayload);
        } else {
          savedVoucher = await purchasesApi.createPI(piPayload);
        }
      }
    } else if (isPurchaseOrder) {
      const poPayload = {
        vendorId: firstEntityRef(data.vendorId, data.supplierId, data.partyId, data.vendor, data.supplier) || '',
        orderDate: firstDisplayText(data.orderDate, data.date) || new Date().toISOString().split('T')[0],
        expectedDeliveryDate: firstDisplayText(data.expectedDeliveryDate),
        currency: headerCurrency || 'USD',
        exchangeRate: exchangeRate || 1,
        notes: firstDisplayText(data.notes, data.description),
        internalNotes: firstDisplayText(data.internalNotes),
        lines: (data.lines || []).map((l: any, index: number) => ({
          lineId: firstEntityRef(l.lineId, l.id),
          lineNo: l.lineNo || index + 1,
          itemId: firstEntityRef(l.itemId, l.item, l.productId) || '',
          orderedQty: Number(l.orderedQty ?? l.qty ?? l.quantity) || 0,
          uomId: firstEntityRef(l.uomId, l.uom),
          uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
          unitPriceDoc: Number(l.unitPriceDoc ?? l.unitPrice ?? l.price ?? l.rate) || 0,
          taxCodeId: firstEntityRef(l.taxCodeId, l.taxCode),
          warehouseId: firstEntityRef(l.warehouseId, l.warehouse, data.warehouseId, data.warehouse),
          description: firstDisplayText(l.description, l.notes),
        })).filter((l: any) => !!l.itemId && Number(l.orderedQty) > 0),
      };

      savedVoucher = cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')
        ? await purchasesApi.updatePO(cleanPayload.id, poPayload)
        : await purchasesApi.createPO(poPayload);
    } else if (isGoodsReceipt) {
      const grnPayload = {
        purchaseOrderId: firstEntityRef(data.purchaseOrderId, data.poId, data.sourceDocumentId),
        vendorId: firstEntityRef(data.vendorId, data.supplierId, data.partyId, data.vendor, data.supplier),
        receiptDate: firstDisplayText(data.receiptDate, data.date) || new Date().toISOString().split('T')[0],
        warehouseId: firstEntityRef(data.warehouseId, data.warehouse) || '',
        notes: firstDisplayText(data.notes, data.description),
        lines: (data.lines || []).map((l: any, index: number) => ({
          lineId: firstEntityRef(l.lineId, l.id),
          lineNo: l.lineNo || index + 1,
          poLineId: firstEntityRef(l.poLineId, l.purchaseOrderLineId, l.sourceLineId),
          itemId: firstEntityRef(l.itemId, l.item, l.productId),
          receivedQty: Number(l.receivedQty ?? l.qty ?? l.quantity ?? l.orderedQty) || 0,
          uomId: firstEntityRef(l.uomId, l.uom),
          uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
          unitCostDoc: Number(l.unitCostDoc ?? l.unitPriceDoc ?? l.unitCost ?? l.unitPrice ?? l.price ?? l.rate) || 0,
          moveCurrency: firstEntityRef(l.moveCurrency, l.currency) || headerCurrency || undefined,
          fxRateMovToBase: Number(l.fxRateMovToBase) || undefined,
          fxRateCCYToBase: Number(l.fxRateCCYToBase) || undefined,
          description: firstDisplayText(l.description, l.notes),
        })).filter((l: any) => !!l.itemId && Number(l.receivedQty) > 0),
      };

      savedVoucher = cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')
        ? await purchasesApi.updateGRN(cleanPayload.id, grnPayload)
        : await purchasesApi.createGRN(grnPayload);
    } else if (isPurchaseReturn) {
      const prPayload = {
        purchaseInvoiceId: firstEntityRef(data.purchaseInvoiceId, data.invoiceId),
        goodsReceiptId: firstEntityRef(data.goodsReceiptId, data.grnId),
        purchaseOrderId: firstEntityRef(data.purchaseOrderId, data.poId),
        vendorId: firstEntityRef(data.vendorId, data.supplierId, data.partyId, data.vendor, data.supplier),
        returnDate: firstDisplayText(data.returnDate, data.date) || new Date().toISOString().split('T')[0],
        warehouseId: firstEntityRef(data.warehouseId, data.warehouse),
        reason: firstDisplayText(data.reason) || 'Purchase return',
        notes: firstDisplayText(data.notes, data.description),
        currency: headerCurrency || undefined,
        exchangeRate: exchangeRate || 1,
        lines: (data.lines || []).map((l: any, index: number) => ({
          lineId: firstEntityRef(l.lineId, l.id),
          lineNo: l.lineNo || index + 1,
          piLineId: firstEntityRef(l.piLineId, l.purchaseInvoiceLineId),
          grnLineId: firstEntityRef(l.grnLineId, l.goodsReceiptLineId),
          poLineId: firstEntityRef(l.poLineId, l.purchaseOrderLineId, l.sourceLineId),
          itemId: firstEntityRef(l.itemId, l.item, l.productId),
          returnQty: Number(l.returnQty ?? l.qty ?? l.quantity) || 0,
          unitCostDoc: Number(l.unitCostDoc ?? l.unitPriceDoc ?? l.unitCost ?? l.unitPrice ?? l.price ?? l.rate) || 0,
          uomId: firstEntityRef(l.uomId, l.uom),
          uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
          accountId: firstEntityRef(l.accountId, l.account),
          description: firstDisplayText(l.description, l.notes),
        })).filter((l: any) => !!l.itemId && Number(l.returnQty) > 0),
      };

      savedVoucher = cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')
        ? await purchasesApi.updateReturn(cleanPayload.id, prPayload)
        : await purchasesApi.createReturn(prPayload);
    } else if (isSalesOrder) {
      const soPayload = {
        customerId: firstEntityRef(data.customerId, data.partyId, data.customer) || '',
        orderDate: firstDisplayText(data.orderDate, data.date) || new Date().toISOString().split('T')[0],
        expectedDeliveryDate: firstDisplayText(data.expectedDeliveryDate),
        currency: headerCurrency || 'USD',
        exchangeRate: exchangeRate || 1,
        notes: firstDisplayText(data.notes, data.description),
        internalNotes: firstDisplayText(data.internalNotes),
        lines: (data.lines || []).map((l: any, index: number) => ({
          lineId: firstEntityRef(l.lineId, l.id),
          lineNo: l.lineNo || index + 1,
          itemId: firstEntityRef(l.itemId, l.item, l.productId) || '',
          orderedQty: Number(l.orderedQty ?? l.qty ?? l.quantity) || 0,
          uomId: firstEntityRef(l.uomId, l.uom),
          uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
          unitPriceDoc: Number(l.unitPriceDoc ?? l.unitPrice ?? l.price ?? l.rate) || 0,
          taxCodeId: firstEntityRef(l.taxCodeId, l.taxCode),
          warehouseId: firstEntityRef(l.warehouseId, l.warehouse, data.warehouseId, data.warehouse),
          description: firstDisplayText(l.description, l.notes),
        })).filter((l: any) => !!l.itemId && Number(l.orderedQty) > 0),
      };

      savedVoucher = cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')
        ? await salesApi.updateSO(cleanPayload.id, soPayload)
        : await salesApi.createSO(soPayload);
    } else if (isDeliveryNote) {
      const dnPayload = {
        salesOrderId: firstEntityRef(data.salesOrderId, data.soId, data.sourceDocumentId),
        customerId: firstEntityRef(data.customerId, data.partyId, data.customer),
        deliveryDate: firstDisplayText(data.deliveryDate, data.date) || new Date().toISOString().split('T')[0],
        warehouseId: firstEntityRef(data.warehouseId, data.warehouse) || '',
        notes: firstDisplayText(data.notes, data.description),
        lines: (data.lines || []).map((l: any, index: number) => ({
          lineId: firstEntityRef(l.lineId, l.id),
          lineNo: l.lineNo || index + 1,
          soLineId: firstEntityRef(l.soLineId, l.salesOrderLineId, l.sourceLineId),
          itemId: firstEntityRef(l.itemId, l.item, l.productId),
          deliveredQty: Number(l.deliveredQty ?? l.qty ?? l.quantity ?? l.orderedQty) || 0,
          uomId: firstEntityRef(l.uomId, l.uom),
          uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
          description: firstDisplayText(l.description, l.notes),
        })).filter((l: any) => !!l.itemId && Number(l.deliveredQty) > 0),
      };

      savedVoucher = cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')
        ? await salesApi.updateDN(cleanPayload.id, dnPayload)
        : await salesApi.createDN(dnPayload);
    } else if (isSalesReturn) {
      const srPayload = {
        customerId: firstEntityRef(data.customerId, data.partyId, data.customer),
        salesInvoiceId: firstEntityRef(data.salesInvoiceId, data.invoiceId),
        deliveryNoteId: firstEntityRef(data.deliveryNoteId, data.dnId),
        salesOrderId: firstEntityRef(data.salesOrderId, data.soId),
        returnDate: firstDisplayText(data.returnDate, data.date) || new Date().toISOString().split('T')[0],
        warehouseId: firstEntityRef(data.warehouseId, data.warehouse),
        currency: headerCurrency || undefined,
        exchangeRate: exchangeRate || 1,
        reason: firstDisplayText(data.reason) || 'Sales return',
        notes: firstDisplayText(data.notes, data.description),
        lines: (data.lines || []).map((l: any, index: number) => ({
          lineId: firstEntityRef(l.lineId, l.id),
          lineNo: l.lineNo || index + 1,
          siLineId: firstEntityRef(l.siLineId, l.salesInvoiceLineId),
          dnLineId: firstEntityRef(l.dnLineId, l.deliveryNoteLineId),
          soLineId: firstEntityRef(l.soLineId, l.salesOrderLineId, l.sourceLineId),
          itemId: firstEntityRef(l.itemId, l.item, l.productId),
          returnQty: Number(l.returnQty ?? l.qty ?? l.quantity) || 0,
          uomId: firstEntityRef(l.uomId, l.uom),
          uom: firstDisplayText(l.uom, l.uomCode, l.uomName),
          unitPriceDoc: Number(l.unitPriceDoc ?? l.unitPrice ?? l.price ?? l.rate) || 0,
          taxCodeId: firstEntityRef(l.taxCodeId, l.taxCode),
          warehouseId: firstEntityRef(l.warehouseId, l.warehouse, data.warehouseId, data.warehouse),
          description: firstDisplayText(l.description, l.notes),
        })).filter((l: any) => !!l.itemId && Number(l.returnQty) > 0),
      };

      savedVoucher = cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')
        ? await salesApi.updateReturn(cleanPayload.id, srPayload)
        : await salesApi.createReturn(srPayload);
    } else {
      // Fallback: unhandled subledger document types route through legacy accounting-voucher path.
      if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
        await accountingApi.updateVoucher(cleanPayload.id, cleanPayload);
        savedVoucher = await accountingApi.getVoucher(cleanPayload.id);
      } else {
        const res = await accountingApi.createVoucher(cleanPayload);
        savedVoucher = res;
      }
    }
  } else {
    // Accounting types (journal, payment, receipt, etc.)
    if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
      await accountingApi.updateVoucher(cleanPayload.id, cleanPayload);
      // Update endpoint returns ack only; fetch full server state for reliable reopen.
      savedVoucher = await accountingApi.getVoucher(cleanPayload.id);
    } else {
      const res = await accountingApi.createVoucher(cleanPayload);
      savedVoucher = res;
    }
  }
  
  dispatchUpdate();
  return savedVoucher;
};

/**
 * useVoucherActions — The single hook for all voucher action execution.
 * 
 * Returns both unified handlers and legacy-compatible handlers.
 */
export const useVoucherActions = (): VoucherActionHandlers & LegacyVoucherHandlers => {

  // ── Core handlers ────────────────────────────────────────────

  const save = async (windowId: string, data: any): Promise<any> => {
    return await saveVoucherInternal(data);
  };

  const submit = async (windowId: string, data: any): Promise<any> => {
    const saved = await saveVoucherInternal(data);
    if (!saved?.id) throw new Error('Could not retrieve Voucher ID after save.');
    
    try {
      await accountingApi.sendVoucherToApproval(saved.id);
      errorHandler.showSuccess('Voucher submitted for approval');
      dispatchUpdate();
      return saved;
    } catch (error: any) {
      // CRITICAL: Attach the saved voucher to the error so the UI can capture the ID
      // and prevent further duplication on retry.
      error.savedVoucher = saved;
      throw error;
    }
  };

  const approve = async (id: string): Promise<void> => {
    await accountingApi.approveVoucher(id);
    errorHandler.showSuccess('Voucher approved successfully');
    dispatchUpdate();
  };

  const reject = async (id: string, reason?: string): Promise<void> => {
    await accountingApi.rejectVoucher(id, reason);
    errorHandler.showSuccess('Voucher rejected');
    dispatchUpdate();
  };

  const confirmCustody = async (id: string): Promise<void> => {
    await accountingApi.confirmVoucherCustody(id);
    errorHandler.showSuccess('Custody confirmed');
    dispatchUpdate();
  };

  const post = async (id: string): Promise<void> => {
    await accountingApi.postVoucher(id);
    errorHandler.showSuccess('Voucher posted successfully');
    dispatchUpdate();
  };

  const cancel = async (id: string): Promise<void> => {
    await accountingApi.cancelVoucher(id);
    errorHandler.showSuccess('Voucher cancelled successfully');
    dispatchUpdate();
  };

  const reverse = async (id: string): Promise<void> => {
    await accountingApi.reverseVoucher(id);
    errorHandler.showSuccess('Reversal voucher created successfully');
    dispatchUpdate();
  };

  const reverseAndReplace = async (id: string, request: CorrectionRequest): Promise<void> => {
    await accountingApi.reverseAndReplaceVoucher(id, request);
    errorHandler.showSuccess('Voucher reversed and replacement created');
    dispatchUpdate();
  };

  const remove = async (id: string): Promise<void> => {
    await accountingApi.deleteVoucher(id);
    errorHandler.showSuccess('Voucher deleted permanently');
    dispatchUpdate();
  };

  const print = (id: string): void => {
    dispatchPrint(id);
  };

  const refreshList = (): void => {
    dispatchUpdate();
  };

  // ── Dynamic dispatcher ───────────────────────────────────────

  const executeAction = async (type: VoucherActionType, id: string, extra?: any): Promise<void> => {
    try {
      switch (type) {
        case 'APPROVE':
          await approve(id);
          break;
        case 'REJECT':
          await reject(id, extra?.reason);
          break;
        case 'CONFIRM_CUSTODY':
          await confirmCustody(id);
          break;
        case 'POST':
          await post(id);
          break;
        case 'CANCEL':
          await cancel(id);
          break;
        case 'REVERSE':
          await reverse(id);
          break;
        case 'REVERSE_AND_REPLACE':
          await reverseAndReplace(id, extra);
          break;
        case 'DELETE':
          await remove(id);
          break;
        case 'PRINT':
          print(id);
          break;
        default:
          console.warn(`[useVoucherActions] Unhandled action type: ${type}`);
      }
    } catch (error: any) {
      errorHandler.showError(error);
      throw error;
    }
  };

  // ── Legacy-compatible handlers (for WindowsDesktop) ──────────

  const handleSaveVoucher = async (windowId: string, data: any): Promise<any> => {
    const result = await save(windowId, data);
    errorHandler.showSuccess('SAVE');
    return result;
  };

  const handleSubmitVoucher = async (windowId: string, data: any): Promise<any> => {
    return await submit(windowId, data);
  };

  const handleApproveVoucher = async (windowId: string, id: string): Promise<void> => {
    await approve(id);
  };

  const handleRejectVoucher = async (windowId: string, id: string, reason?: string): Promise<void> => {
    await reject(id, reason);
  };

  const handleConfirmVoucher = async (windowId: string, id: string): Promise<void> => {
    await confirmCustody(id);
  };

  return {
    // Unified handlers
    save,
    submit,
    approve,
    reject,
    confirmCustody,
    post,
    cancel,
    reverse,
    reverseAndReplace,
    remove,
    print,
    executeAction,
    refreshList,
    // Legacy handlers
    handleSaveVoucher,
    handleSubmitVoucher,
    handleApproveVoucher,
    handleRejectVoucher,
    handleConfirmVoucher,
  };
};
