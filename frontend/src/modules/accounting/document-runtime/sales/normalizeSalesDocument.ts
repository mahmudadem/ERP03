import type {
  NormalizedSalesDocument,
  NormalizedSalesHeader,
  NormalizedSalesLine,
} from '../types';
import { getSalesDocumentProfile } from './SalesDocumentProfiles';

const isPresent = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

const normalizeKey = (key: string): string =>
  key.replace(/[^a-z0-9]/gi, '').toLowerCase();

const buildKeyMap = (source: any): Map<string, any> => {
  const map = new Map<string, any>();
  if (!source || typeof source !== 'object') return map;

  Object.entries(source).forEach(([key, value]) => {
    map.set(normalizeKey(key), value);
  });

  return map;
};

const readOwnValue = (source: any, aliases: string[]): any => {
  if (!source || typeof source !== 'object') return undefined;

  for (const alias of aliases) {
    if (isPresent(source[alias])) {
      return source[alias];
    }
  }

  const normalized = buildKeyMap(source);
  for (const alias of aliases) {
    const value = normalized.get(normalizeKey(alias));
    if (isPresent(value)) {
      return value;
    }
  }

  return undefined;
};

const readValue = (source: any, aliases: string[]): any => {
  const direct = readOwnValue(source, aliases);
  if (isPresent(direct)) return direct;

  const metadata = source?.metadata || source?.meta;
  const metadataValue = readOwnValue(metadata, aliases);
  if (isPresent(metadataValue)) return metadataValue;

  return undefined;
};

const toStringValue = (value: any): string => {
  if (!isPresent(value)) return '';
  if (typeof value === 'object') {
    const identity = value.id ?? value.value ?? value.code ?? value.key ?? value.name ?? value.label;
    return isPresent(identity) ? String(identity) : '';
  }
  return String(value);
};

const readString = (source: any, aliases: string[]): string =>
  toStringValue(readValue(source, aliases)).trim();

const readNumberWithField = (
  source: any,
  aliases: string[]
): { value: number; fieldId: string } => {
  for (const alias of aliases) {
    const value = readValue(source, [alias]);
    if (!isPresent(value)) continue;

    const raw = typeof value === 'object'
      ? value.amount ?? value.value ?? value.number ?? value.total
      : value;
    const parsed = Number(String(raw).replace(/,/g, ''));

    if (Number.isFinite(parsed)) {
      return { value: parsed, fieldId: alias };
    }
  }

  return { value: 0, fieldId: '' };
};

const readNumber = (source: any, aliases: string[]): number =>
  readNumberWithField(source, aliases).value;

const getLines = (formData: any): any[] => {
  if (Array.isArray(formData?.lines)) return formData.lines;
  if (Array.isArray(formData?.detailLines)) return formData.detailLines;
  if (Array.isArray(formData?.items)) return formData.items;
  return [];
};

const normalizeHeader = (formData: any): NormalizedSalesHeader => {
  const salesOrderId = readString(formData, ['salesOrderId', 'soId', 'sourceSalesOrderId']);
  const deliveryNoteId = readString(formData, ['deliveryNoteId', 'dnId', 'sourceDeliveryNoteId']);
  const salesInvoiceId = readString(formData, ['salesInvoiceId', 'invoiceId', 'sourceSalesInvoiceId']);

  return {
    customerId: readString(formData, ['customerId', 'partyId', 'customer', 'customerName', 'accountId', 'account']),
    documentDate: readString(formData, ['documentDate', 'date', 'invoiceDate', 'orderDate', 'deliveryDate', 'returnDate']),
    invoiceDate: readString(formData, ['invoiceDate', 'date', 'documentDate']),
    warehouseId: readString(formData, ['warehouseId', 'warehouse', 'headerWarehouseId']),
    currency: readString(formData, ['currency', 'currencyCode']),
    exchangeRate: readNumber(formData, ['exchangeRate', 'rate', 'parity']),
    totalAmount: readNumber(formData, ['totalAmount', 'grandTotal', 'amount', 'total']),
    salesOrderId,
    deliveryNoteId,
    salesInvoiceId,
    sourceDocumentId: salesOrderId || deliveryNoteId || salesInvoiceId,
  };
};

const normalizeLine = (raw: Record<string, any>, index: number, allowDescriptionOnlyLine: boolean): NormalizedSalesLine => {
  const quantityResult = readNumberWithField(raw, [
    'quantity',
    'qty',
    'orderedQty',
    'deliveredQty',
    'invoicedQty',
    'returnQty',
    'receivedQty',
  ]);
  const quantity = quantityResult.value;
  const unitPriceDoc = readNumber(raw, [
    'unitPriceDoc',
    'unitPrice',
    'price',
    'rate',
    'salesPrice',
    'sellingPrice',
  ]);
  const discountDoc = readNumber(raw, ['discountDoc', 'discount', 'lineDiscount', 'discountAmount']);
  const directAmount = readNumber(raw, [
    'amount',
    'total',
    'lineTotal',
    'lineTotalDoc',
    'rowTotal',
    'totalDoc',
    'netAmountDoc',
    'grossAmountDoc',
  ]);
  const computedAmount = Math.max(0, quantity * unitPriceDoc - discountDoc);
  const description = readString(raw, ['description', 'notes', 'lineDescription', 'serviceDescription']);
  const serviceId = readString(raw, ['serviceId', 'service', 'serviceCode']);
  const itemId = readString(raw, ['itemId', 'item', 'productId', 'product', 'sku', 'inventoryItemId']);
  const salesOrderId = readString(raw, ['salesOrderId', 'soId', 'sourceSalesOrderId']);
  const deliveryNoteId = readString(raw, ['deliveryNoteId', 'dnId', 'sourceDeliveryNoteId']);
  const salesInvoiceId = readString(raw, ['salesInvoiceId', 'invoiceId', 'sourceSalesInvoiceId']);
  const sourceLineId = readString(raw, [
    'sourceLineId',
    'soLineId',
    'salesOrderLineId',
    'dnLineId',
    'deliveryNoteLineId',
    'salesInvoiceLineId',
  ]);
  const effectiveItemId = itemId || serviceId || (allowDescriptionOnlyLine ? description : '');
  const amountDoc = directAmount > 0 ? directAmount : computedAmount;
  const warehouseId = readString(raw, ['warehouseId', 'warehouse', 'lineWarehouseId']);

  return {
    raw,
    index,
    itemId: effectiveItemId,
    serviceId,
    description,
    quantity,
    quantityFieldId: quantityResult.fieldId,
    unitPriceDoc,
    amountDoc,
    discountDoc,
    costPrice: readNumber(raw, ['costPrice', 'cost', 'lastCost', 'averageCost']),
    warehouseId,
    salesOrderId,
    deliveryNoteId,
    salesInvoiceId,
    sourceLineId,
    isActive: Boolean(
      effectiveItemId ||
      description ||
      quantity > 0 ||
      unitPriceDoc > 0 ||
      amountDoc > 0 ||
      warehouseId ||
      salesOrderId ||
      deliveryNoteId ||
      salesInvoiceId ||
      sourceLineId
    ),
  };
};

export function normalizeSalesDocument(definition: any, formData: any): NormalizedSalesDocument {
  const profile = getSalesDocumentProfile(definition);
  const lines = getLines(formData).map((line, index) =>
    normalizeLine(line || {}, index, profile.allowDescriptionOnlyLine)
  );
  const activeLines = lines.filter((line) => line.isActive);

  return {
    raw: formData,
    profile,
    header: normalizeHeader(formData || {}),
    lines,
    activeLines,
    totals: {
      amountDoc: activeLines.reduce((sum, line) => sum + line.amountDoc, 0),
    },
  };
}
