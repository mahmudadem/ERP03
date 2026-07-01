import type { TFunction } from 'i18next';

export interface VoucherDisplayNameSource {
  name?: string | null;
  code?: string | null;
  formType?: string | null;
  voucherType?: string | null;
  baseType?: string | null;
  isDefault?: boolean;
  isSystemGenerated?: boolean;
  isLocked?: boolean;
}

const TRANSLATION_KEY_BY_CODE: Record<string, string> = {
  journal_entry: 'journalEntry',
  payment: 'payment',
  receipt: 'receipt',
  opening_balance: 'openingBalance',
  fx_revaluation: 'fxRevaluation',
  delivery_note: 'deliveryNote',
  sales_return: 'salesReturn',
  sales_invoice: 'salesInvoice',
  sales_invoice_direct: 'salesInvoiceDirect',
  sales_invoice_linked: 'salesInvoiceLinked',
  sales_invoice_service: 'salesInvoiceService',
  purchase_order: 'purchaseOrder',
  purchase_invoice: 'purchaseInvoice',
  purchase_invoice_direct: 'purchaseInvoiceDirect',
  purchase_invoice_linked: 'purchaseInvoiceLinked',
  purchase_invoice_service: 'purchaseInvoiceService',
  goods_receipt: 'goodsReceipt',
  purchase_return: 'purchaseReturn',
  native_accounting_vouchers: 'nativeVouchers',
  native_sales_invoice: 'nativeSalesInvoice',
  native_sales_order: 'nativeSalesOrder',
  native_purchase_invoice: 'nativePurchaseInvoice',
  native_purchase_order: 'nativePurchaseOrder',
};

const CODE_BY_SHIPPED_NAME: Record<string, string> = {
  'journal entry': 'journal_entry',
  'payment voucher': 'payment',
  'receipt voucher': 'receipt',
  'opening balance': 'opening_balance',
  'fx revaluation': 'fx_revaluation',
  'delivery note': 'delivery_note',
  'sales return': 'sales_return',
  'sales invoice': 'sales_invoice',
  'sales invoice (direct)': 'sales_invoice_direct',
  'sales invoice (linked)': 'sales_invoice_linked',
  'sales invoice (service)': 'sales_invoice_service',
  'purchase order': 'purchase_order',
  'purchase invoice': 'purchase_invoice',
  'purchase invoice (direct)': 'purchase_invoice_direct',
  'purchase invoice (linked)': 'purchase_invoice_linked',
  'purchase invoice (service)': 'purchase_invoice_service',
  'goods receipt': 'goods_receipt',
  'purchase return': 'purchase_return',
  'native vouchers': 'native_accounting_vouchers',
  'native sales invoice': 'native_sales_invoice',
  'native sales order': 'native_sales_order',
  'native purchase invoice': 'native_purchase_invoice',
  'native purchase order': 'native_purchase_order',
};

const normalize = (value?: string | null): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const resolveCode = (source: VoucherDisplayNameSource): string => {
  const candidates = [source.formType, source.code, source.baseType, source.voucherType];
  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    if (TRANSLATION_KEY_BY_CODE[normalized]) return normalized;
  }

  return CODE_BY_SHIPPED_NAME[String(source.name || '').trim().toLowerCase()] || '';
};

const isShippedDefault = (source: VoucherDisplayNameSource): boolean => {
  if (source.isSystemGenerated === false) return false;
  if (source.isDefault === false && source.isLocked === false) return false;
  if (source.isSystemGenerated) return true;
  if (source.isDefault && source.isLocked) return true;
  return Boolean(CODE_BY_SHIPPED_NAME[String(source.name || '').trim().toLowerCase()]);
};

/**
 * Localizes only ERP03's shipped voucher/form names.
 *
 * Stable codes select the translation. Tenant-authored names are returned
 * unchanged, so changing the UI language never overwrites a user's custom name.
 */
export const resolveVoucherDisplayName = (
  t: TFunction,
  source: VoucherDisplayNameSource,
): string => {
  const fallback = String(source.name || source.code || source.formType || '').trim();
  if (!isShippedDefault(source)) return fallback;

  const code = resolveCode(source);
  const key = TRANSLATION_KEY_BY_CODE[code];
  return key
    ? t(`defaultVoucherNames.${key}`, { defaultValue: fallback })
    : fallback;
};

