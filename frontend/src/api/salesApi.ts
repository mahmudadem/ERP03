import client from './client';

export type SOStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_DELIVERED'
  | 'FULLY_DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';
export type DNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type SIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type SRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface SalesSettingsDTO {
  companyId: string;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  defaultRevenueAccountId: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  salesVoucherTypeId?: string;
  defaultWarehouseId?: string;
  soNumberPrefix: string;
  soNumberNextSeq: number;
  dnNumberPrefix: string;
  dnNumberNextSeq: number;
  siNumberPrefix: string;
  siNumberNextSeq: number;
  srNumberPrefix: string;
  srNumberNextSeq: number;
}

export interface SalesOrderLineDTO {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
  trackInventory: boolean;
  orderedQty: number;
  uom: string;
  deliveredQty: number;
  invoicedQty: number;
  returnedQty: number;
  unitPriceDoc: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  lineTotalBase: number;
  taxCodeId?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
  description?: string;
}

export interface SalesOrderDTO {
  id: string;
  companyId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesOrderLineDTO[];
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  status: SOStatus;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  closedAt?: string;
}

export interface DeliveryNoteLineDTO {
  lineId: string;
  lineNo: number;
  soLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  deliveredQty: number;
  uom: string;
  unitCostBase: number;
  lineCostBase: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface DeliveryNoteDTO {
  id: string;
  companyId: string;
  dnNumber: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  deliveryDate: string;
  warehouseId: string;
  lines: DeliveryNoteLineDTO[];
  status: DNStatus;
  notes?: string;
  cogsVoucherId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface SalesInvoiceLineDTO {
  lineId: string;
  lineNo: number;
  soLineId?: string;
  dnLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  trackInventory: boolean;
  invoicedQty: number;
  uom: string;
  unitPriceDoc: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  lineTotalBase: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
  revenueAccountId: string;
  cogsAccountId?: string;
  inventoryAccountId?: string;
  unitCostBase?: number;
  lineCostBase?: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface SalesInvoiceDTO {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerInvoiceNumber?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesInvoiceLineDTO[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  paymentTermsDays: number;
  paymentStatus: PaymentStatus;
  paidAmountBase: number;
  outstandingAmountBase: number;
  status: SIStatus;
  voucherId?: string | null;
  cogsVoucherId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface SalesReturnLineDTO {
  lineId: string;
  lineNo: number;
  siLineId?: string;
  dnLineId?: string;
  soLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  returnQty: number;
  uom: string;
  unitPriceDoc?: number;
  unitPriceBase?: number;
  unitCostBase: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAccountId?: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface SalesReturnDTO {
  id: string;
  companyId: string;
  returnNumber: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  returnContext: ReturnContext;
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: SalesReturnLineDTO[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  reason: string;
  notes?: string;
  status: SRStatus;
  revenueVoucherId?: string | null;
  cogsVoucherId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface InitializeSalesPayload {
  defaultARAccountId?: string;
  defaultRevenueAccountId: string;
  allowDirectInvoicing?: boolean;
  requireSOForStockItems?: boolean;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  salesVoucherTypeId?: string;
  defaultWarehouseId?: string;
  soNumberPrefix?: string;
  soNumberNextSeq?: number;
  dnNumberPrefix?: string;
  dnNumberNextSeq?: number;
  siNumberPrefix?: string;
  siNumberNextSeq?: number;
  srNumberPrefix?: string;
  srNumberNextSeq?: number;
}

export interface SalesOrderLineInputDTO {
  lineId?: string;
  lineNo?: number;
  itemId: string;
  orderedQty: number;
  uom?: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface CreateSalesOrderPayload {
  customerId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesOrderLineInputDTO[];
  notes?: string;
  internalNotes?: string;
}

export interface UpdateSalesOrderPayload {
  customerId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesOrderLineInputDTO[];
  notes?: string;
  internalNotes?: string;
}

export interface ListSalesOrdersOptions {
  status?: SOStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface DeliveryNoteLineInputDTO {
  lineId?: string;
  lineNo?: number;
  soLineId?: string;
  itemId?: string;
  deliveredQty: number;
  uom?: string;
  description?: string;
}

export interface CreateDeliveryNotePayload {
  salesOrderId?: string;
  customerId?: string;
  deliveryDate: string;
  warehouseId: string;
  lines?: DeliveryNoteLineInputDTO[];
  notes?: string;
}

export interface ListDeliveryNotesOptions {
  salesOrderId?: string;
  status?: DNStatus;
  limit?: number;
}

export interface SalesInvoiceLineInputDTO {
  lineId?: string;
  lineNo?: number;
  soLineId?: string;
  dnLineId?: string;
  itemId?: string;
  invoicedQty: number;
  uom?: string;
  unitPriceDoc?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface CreateSalesInvoicePayload {
  salesOrderId?: string;
  customerId: string;
  customerInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInputDTO[];
  notes?: string;
}

export interface UpdateSalesInvoicePayload {
  customerId?: string;
  customerInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInputDTO[];
  notes?: string;
}

export interface ListSalesInvoicesOptions {
  customerId?: string;
  salesOrderId?: string;
  status?: SIStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
}

export interface SalesReturnLineInputDTO {
  lineId?: string;
  lineNo?: number;
  siLineId?: string;
  dnLineId?: string;
  soLineId?: string;
  itemId?: string;
  returnQty?: number;
  uom?: string;
  description?: string;
}

export interface CreateSalesReturnPayload {
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  returnDate: string;
  warehouseId?: string;
  reason: string;
  notes?: string;
  lines?: SalesReturnLineInputDTO[];
}

export interface ListSalesReturnsOptions {
  customerId?: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  status?: SRStatus;
}

export interface UpdateSalesInvoicePaymentStatusPayload {
  paidAmountBase: number;
}

export const salesApi = {
  initializeSales: (payload: InitializeSalesPayload): Promise<SalesSettingsDTO> =>
    client.post('/tenant/sales/initialize', payload),

  getSettings: (): Promise<SalesSettingsDTO | null> =>
    client.get('/tenant/sales/settings'),

  updateSettings: (payload: Partial<SalesSettingsDTO>): Promise<SalesSettingsDTO> =>
    client.put('/tenant/sales/settings', payload),

  createSO: (payload: CreateSalesOrderPayload): Promise<SalesOrderDTO> =>
    client.post('/tenant/sales/orders', payload),

  updateSO: (id: string, payload: UpdateSalesOrderPayload): Promise<SalesOrderDTO> =>
    client.put(`/tenant/sales/orders/${id}`, payload),

  getSO: (id: string): Promise<SalesOrderDTO> =>
    client.get(`/tenant/sales/orders/${id}`),

  listSOs: (opts?: ListSalesOrdersOptions): Promise<SalesOrderDTO[]> =>
    client.get('/tenant/sales/orders', { params: opts }),

  confirmSO: (id: string): Promise<SalesOrderDTO> =>
    client.post(`/tenant/sales/orders/${id}/confirm`, {}),

  cancelSO: (id: string): Promise<SalesOrderDTO> =>
    client.post(`/tenant/sales/orders/${id}/cancel`, {}),

  closeSO: (id: string): Promise<SalesOrderDTO> =>
    client.post(`/tenant/sales/orders/${id}/close`, {}),

  createDN: (payload: CreateDeliveryNotePayload): Promise<DeliveryNoteDTO> =>
    client.post('/tenant/sales/delivery-notes', payload),

  listDNs: (opts?: ListDeliveryNotesOptions): Promise<DeliveryNoteDTO[]> =>
    client.get('/tenant/sales/delivery-notes', { params: opts }),

  getDN: (id: string): Promise<DeliveryNoteDTO> =>
    client.get(`/tenant/sales/delivery-notes/${id}`),

  postDN: (id: string): Promise<DeliveryNoteDTO> =>
    client.post(`/tenant/sales/delivery-notes/${id}/post`, {}),

  createSI: (payload: CreateSalesInvoicePayload): Promise<SalesInvoiceDTO> =>
    client.post('/tenant/sales/invoices', payload),

  updateSI: (id: string, payload: UpdateSalesInvoicePayload): Promise<SalesInvoiceDTO> =>
    client.put(`/tenant/sales/invoices/${id}`, payload),

  listSIs: (opts?: ListSalesInvoicesOptions): Promise<SalesInvoiceDTO[]> =>
    client.get('/tenant/sales/invoices', { params: opts }),

  getSI: (id: string): Promise<SalesInvoiceDTO> =>
    client.get(`/tenant/sales/invoices/${id}`),

  postSI: (id: string): Promise<SalesInvoiceDTO> =>
    client.post(`/tenant/sales/invoices/${id}/post`, {}),

  updatePaymentStatus: (id: string, payload: UpdateSalesInvoicePaymentStatusPayload): Promise<SalesInvoiceDTO> =>
    client.post(`/tenant/sales/invoices/${id}/payment-status`, payload),

  createReturn: (payload: CreateSalesReturnPayload): Promise<SalesReturnDTO> =>
    client.post('/tenant/sales/returns', payload),

  listReturns: (opts?: ListSalesReturnsOptions): Promise<SalesReturnDTO[]> =>
    client.get('/tenant/sales/returns', { params: opts }),

  getReturn: (id: string): Promise<SalesReturnDTO> =>
    client.get(`/tenant/sales/returns/${id}`),

  postReturn: (id: string): Promise<SalesReturnDTO> =>
    client.post(`/tenant/sales/returns/${id}/post`, {}),
};
