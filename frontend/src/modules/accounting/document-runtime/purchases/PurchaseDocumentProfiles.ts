import type { PurchaseDocumentProfile } from '../types';

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const profile = (config: PurchaseDocumentProfile): PurchaseDocumentProfile => config;

export const PURCHASE_DOCUMENT_PROFILES = {
  directInvoice: profile({
    code: 'purchase_invoice_direct',
    label: 'Direct Purchase Invoice',
    requiresVendor: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'HEADER_REQUIRED',
    sourcePolicy: 'NONE',
  }),
  linkedInvoice: profile({
    code: 'purchase_invoice_linked',
    label: 'Linked Purchase Invoice',
    requiresVendor: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'LINE_OR_SOURCE',
    sourcePolicy: 'REQUIRED',
  }),
  serviceInvoice: profile({
    code: 'purchase_invoice_service',
    label: 'Service Purchase Invoice',
    requiresVendor: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: true,
    warehousePolicy: 'NOT_REQUIRED',
    sourcePolicy: 'NONE',
  }),
  purchaseOrder: profile({
    code: 'purchase_order',
    label: 'Purchase Order',
    requiresVendor: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'NOT_REQUIRED',
    sourcePolicy: 'NONE',
  }),
  goodsReceipt: profile({
    code: 'goods_receipt',
    label: 'Goods Receipt',
    requiresVendor: false,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: false,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'HEADER_REQUIRED',
    sourcePolicy: 'OPTIONAL',
  }),
  purchaseReturn: profile({
    code: 'purchase_return',
    label: 'Purchase Return',
    requiresVendor: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: false,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'HEADER_REQUIRED',
    sourcePolicy: 'OPTIONAL',
  }),
  genericPurchase: profile({
    code: 'purchase_generic',
    label: 'Purchase Document',
    requiresVendor: true,
    requiresDate: false,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'NOT_REQUIRED',
    sourcePolicy: 'NONE',
  }),
} as const;

export function getPurchaseDocumentProfile(definition: any): PurchaseDocumentProfile {
  const tokens = [
    definition?.code,
    definition?.formType,
    definition?.baseType,
    definition?.type,
    definition?.module,
    definition?.voucherType,
    definition?.voucherTypeId,
    definition?.persona,
    definition?.metadata?.persona,
    definition?.metadata?.voucherType,
  ].map(normalizeToken);

  const joined = tokens.filter(Boolean).join(' ');
  const persona = normalizeToken(definition?.persona || definition?.metadata?.persona);

  if (joined.includes('purchase_invoice_linked') || joined.includes('linked') || persona === 'operational') {
    return PURCHASE_DOCUMENT_PROFILES.linkedInvoice;
  }

  if (joined.includes('purchase_invoice_service') || joined.includes('service')) {
    return PURCHASE_DOCUMENT_PROFILES.serviceInvoice;
  }

  if (joined.includes('purchase_invoice_direct') || joined.includes('direct') || persona === 'simple') {
    return PURCHASE_DOCUMENT_PROFILES.directInvoice;
  }

  if (joined.includes('goods_receipt') || joined.includes('goodsreceipt') || joined.includes('grn')) {
    return PURCHASE_DOCUMENT_PROFILES.goodsReceipt;
  }

  if (joined.includes('purchase_return') || joined.includes('purchasereturn')) {
    return PURCHASE_DOCUMENT_PROFILES.purchaseReturn;
  }

  if (joined.includes('purchase_order') || joined.includes('purchaseorder')) {
    return PURCHASE_DOCUMENT_PROFILES.purchaseOrder;
  }

  if (joined.includes('purchase_invoice') || joined.includes('purchaseinvoice')) {
    return PURCHASE_DOCUMENT_PROFILES.directInvoice;
  }

  return PURCHASE_DOCUMENT_PROFILES.genericPurchase;
}
