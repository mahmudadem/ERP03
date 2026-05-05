import type { SalesDocumentProfile } from '../types';

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const profile = (config: SalesDocumentProfile): SalesDocumentProfile => config;

export const SALES_DOCUMENT_PROFILES = {
  directInvoice: profile({
    code: 'sales_invoice_direct',
    label: 'Direct Sales Invoice',
    requiresCustomer: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'HEADER_REQUIRED',
    sourcePolicy: 'NONE',
  }),
  linkedInvoice: profile({
    code: 'sales_invoice_linked',
    label: 'Linked Sales Invoice',
    requiresCustomer: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'LINE_OR_SOURCE',
    sourcePolicy: 'REQUIRED',
  }),
  serviceInvoice: profile({
    code: 'sales_invoice_service',
    label: 'Service Sales Invoice',
    requiresCustomer: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: true,
    warehousePolicy: 'NOT_REQUIRED',
    sourcePolicy: 'NONE',
  }),
  salesOrder: profile({
    code: 'sales_order',
    label: 'Sales Order',
    requiresCustomer: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'NOT_REQUIRED',
    sourcePolicy: 'NONE',
  }),
  deliveryNote: profile({
    code: 'delivery_note',
    label: 'Delivery Note',
    requiresCustomer: false,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: false,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'HEADER_REQUIRED',
    sourcePolicy: 'OPTIONAL',
  }),
  salesReturn: profile({
    code: 'sales_return',
    label: 'Sales Return',
    requiresCustomer: true,
    requiresDate: true,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'HEADER_REQUIRED',
    sourcePolicy: 'OPTIONAL',
  }),
  genericSales: profile({
    code: 'sales_generic',
    label: 'Sales Document',
    requiresCustomer: true,
    requiresDate: false,
    requiresLineItem: true,
    requiresQuantity: true,
    requiresAmount: true,
    allowDescriptionOnlyLine: false,
    warehousePolicy: 'NOT_REQUIRED',
    sourcePolicy: 'NONE',
  }),
} as const;

export function getSalesDocumentProfile(definition: any): SalesDocumentProfile {
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

  if (joined.includes('sales_invoice_linked') || joined.includes('linked') || persona === 'operational') {
    return SALES_DOCUMENT_PROFILES.linkedInvoice;
  }

  if (joined.includes('sales_invoice_service') || joined.includes('service')) {
    return SALES_DOCUMENT_PROFILES.serviceInvoice;
  }

  if (joined.includes('sales_invoice_direct') || joined.includes('direct') || persona === 'simple') {
    return SALES_DOCUMENT_PROFILES.directInvoice;
  }

  if (joined.includes('delivery_note') || joined.includes('deliverynote')) {
    return SALES_DOCUMENT_PROFILES.deliveryNote;
  }

  if (joined.includes('sales_return') || joined.includes('salesreturn')) {
    return SALES_DOCUMENT_PROFILES.salesReturn;
  }

  if (joined.includes('sales_order') || joined.includes('salesorder')) {
    return SALES_DOCUMENT_PROFILES.salesOrder;
  }

  if (joined.includes('sales_invoice') || joined.includes('salesinvoice')) {
    return SALES_DOCUMENT_PROFILES.directInvoice;
  }

  return SALES_DOCUMENT_PROFILES.genericSales;
}
