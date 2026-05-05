export type SalesWarehousePolicy =
  | 'NOT_REQUIRED'
  | 'HEADER_REQUIRED'
  | 'LINE_REQUIRED'
  | 'LINE_OR_SOURCE';

export type SalesSourcePolicy = 'NONE' | 'OPTIONAL' | 'REQUIRED';

export interface SalesDocumentProfile {
  code: string;
  label: string;
  requiresCustomer: boolean;
  requiresDate: boolean;
  requiresLineItem: boolean;
  requiresQuantity: boolean;
  requiresAmount: boolean;
  allowDescriptionOnlyLine: boolean;
  warehousePolicy: SalesWarehousePolicy;
  sourcePolicy: SalesSourcePolicy;
}

export interface NormalizedSalesHeader {
  customerId: string;
  documentDate: string;
  invoiceDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  totalAmount: number;
  salesOrderId: string;
  deliveryNoteId: string;
  salesInvoiceId: string;
  sourceDocumentId: string;
}

export interface NormalizedSalesLine {
  raw: Record<string, any>;
  index: number;
  itemId: string;
  serviceId: string;
  description: string;
  quantity: number;
  quantityFieldId: string;
  unitPriceDoc: number;
  amountDoc: number;
  discountDoc: number;
  costPrice: number;
  warehouseId: string;
  salesOrderId: string;
  deliveryNoteId: string;
  salesInvoiceId: string;
  sourceLineId: string;
  isActive: boolean;
}

export interface NormalizedSalesDocument {
  raw: any;
  profile: SalesDocumentProfile;
  header: NormalizedSalesHeader;
  lines: NormalizedSalesLine[];
  activeLines: NormalizedSalesLine[];
  totals: {
    amountDoc: number;
  };
}

export type PurchaseWarehousePolicy =
  | 'NOT_REQUIRED'
  | 'HEADER_REQUIRED'
  | 'LINE_REQUIRED'
  | 'LINE_OR_SOURCE';

export type PurchaseSourcePolicy = 'NONE' | 'OPTIONAL' | 'REQUIRED';

export interface PurchaseDocumentProfile {
  code: string;
  label: string;
  requiresVendor: boolean;
  requiresDate: boolean;
  requiresLineItem: boolean;
  requiresQuantity: boolean;
  requiresAmount: boolean;
  allowDescriptionOnlyLine: boolean;
  warehousePolicy: PurchaseWarehousePolicy;
  sourcePolicy: PurchaseSourcePolicy;
}

export interface NormalizedPurchaseHeader {
  vendorId: string;
  documentDate: string;
  invoiceDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  totalAmount: number;
  purchaseOrderId: string;
  goodsReceiptId: string;
  purchaseInvoiceId: string;
  sourceDocumentId: string;
}

export interface NormalizedPurchaseLine {
  raw: Record<string, any>;
  index: number;
  itemId: string;
  serviceId: string;
  description: string;
  quantity: number;
  quantityFieldId: string;
  unitPriceDoc: number;
  unitCostDoc: number;
  amountDoc: number;
  warehouseId: string;
  purchaseOrderId: string;
  goodsReceiptId: string;
  purchaseInvoiceId: string;
  sourceLineId: string;
  lastPurchasePrice: number;
  isActive: boolean;
}

export interface NormalizedPurchaseDocument {
  raw: any;
  profile: PurchaseDocumentProfile;
  header: NormalizedPurchaseHeader;
  lines: NormalizedPurchaseLine[];
  activeLines: NormalizedPurchaseLine[];
  totals: {
    amountDoc: number;
  };
}
