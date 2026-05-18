import client from './client';

export type WorkflowMode = 'SIMPLE' | 'OPERATIONAL';

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
export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type DocumentSource = 'native' | 'default_form' | 'custom_form';

export interface GovernanceRuleDTO {
  id: string;
  scope: 'company' | 'branch' | 'form';
  action: 'allow' | 'block';
  persona: 'direct' | 'linked' | 'service';
  branchId?: string;
  formType?: string;
}

export interface SalesPaymentMethodConfigDTO {
  method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER';
  settlementAccountId: string;
  label?: string;
  isEnabled?: boolean;
}

export interface SalesSettingsDTO {
  companyId: string;
  workflowMode: WorkflowMode;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  defaultRevenueAccountId?: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  paymentMethodConfigs: SalesPaymentMethodConfigDTO[];
  governanceRules: GovernanceRuleDTO[];
  defaultSalesInvoicePersona: 'direct' | 'linked' | 'service';
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
  uomId?: string;
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
  uomId?: string;
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

export interface InvoiceableLinkedSalesLineDTO {
  sourceType: 'DELIVERY_NOTE' | 'SALES_ORDER';
  deliveryNoteId?: string;
  deliveryNoteNumber?: string;
  deliveryDate?: string;
  soLineId?: string;
  dnLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  trackInventory: boolean;
  remainingQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface InvoiceableLinkedSalesSourceDTO {
  salesOrderId: string;
  customerId: string;
  customerName: string;
  currency: string;
  exchangeRate: number;
  lines: InvoiceableLinkedSalesLineDTO[];
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
  uomId?: string;
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
  source?: DocumentSource | string;
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
  uomId?: string;
  uom: string;
  unitPriceDoc?: number;
  unitPriceBase?: number;
  unitCostBase: number;
  lineTotalDoc?: number;
  lineTotalBase?: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
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
  workflowMode?: WorkflowMode;
  defaultARAccountId?: string;
  defaultRevenueAccountId?: string;
  allowDirectInvoicing?: boolean;
  requireSOForStockItems?: boolean;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  paymentMethodConfigs?: SalesPaymentMethodConfigDTO[];
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
  uomId?: string;
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
  uomId?: string;
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

export interface UpdateDeliveryNotePayload {
  customerId?: string;
  deliveryDate?: string;
  warehouseId?: string;
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
  uomId?: string;
  uom?: string;
  unitPriceDoc?: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountAmountDoc?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface SalesInvoiceChargeInputDTO {
  chargeId?: string;
  code?: string;
  name: string;
  amountDoc: number;
  taxCodeId?: string;
  revenueAccountId?: string;
  description?: string;
}

export interface CreateSalesInvoicePayload {
  formType?: string;
  voucherType?: string;
  persona?: 'direct' | 'linked' | 'service';
  source?: DocumentSource;
  salesOrderId?: string;
  customerId: string;
  customerAccountId?: string;
  receivablePayableAccountId?: string;
  customerInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInputDTO[];
  charges?: SalesInvoiceChargeInputDTO[];
  notes?: string;
  settlementInput?: SettlementInputPayload;
}

export interface UpdateSalesInvoicePayload {
  formType?: string;
  voucherType?: string;
  persona?: 'direct' | 'linked' | 'service';
  source?: DocumentSource;
  customerId?: string;
  customerAccountId?: string;
  receivablePayableAccountId?: string;
  customerInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInputDTO[];
  charges?: SalesInvoiceChargeInputDTO[];
  notes?: string;
  settlementInput?: SettlementInputPayload;
}

export interface SettlementInputPayload {
  settlementMode: 'DEFERRED' | 'CASH_FULL' | 'MULTI';
  receivablePayableAccountId?: string;
  settlements: SettlementRowPayload[];
}

export interface SettlementRowPayload {
  settlementAccountId?: string;
  amountBase: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER';
  reference?: string;
  notes?: string;
  paymentDate?: string;
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
  uomId?: string;
  uom?: string;
  unitPriceDoc?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface CreateSalesReturnPayload {
  returnContext?: ReturnContext;
  customerId?: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  returnDate: string;
  warehouseId?: string;
  currency?: string;
  exchangeRate?: number;
  reason: string;
  notes?: string;
  lines?: SalesReturnLineInputDTO[];
}

export interface UpdateSalesReturnPayload {
  returnDate?: string;
  warehouseId?: string;
  reason?: string;
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

export interface RecordSalesInvoicePaymentPayload {
  paymentAmountBase: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER';
  settlementAccountId?: string;
  receivablePayableAccountId?: string;
  arAccountId?: string;
  reference?: string;
  notes?: string;
  paymentDate?: string;
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

  getInvoiceableLinkedSource: (salesOrderId: string): Promise<InvoiceableLinkedSalesSourceDTO> =>
    client.get(`/tenant/sales/orders/${salesOrderId}/invoiceable-linked-source`),

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

  updateDN: (id: string, payload: UpdateDeliveryNotePayload): Promise<DeliveryNoteDTO> =>
    client.put(`/tenant/sales/delivery-notes/${id}`, payload),

  postDN: (id: string): Promise<DeliveryNoteDTO> =>
    client.post(`/tenant/sales/delivery-notes/${id}/post`, {}),

  createSI: (payload: CreateSalesInvoicePayload): Promise<SalesInvoiceDTO> =>
    client.post('/tenant/sales/invoices', payload),

  updateSI: (id: string, payload: UpdateSalesInvoicePayload): Promise<SalesInvoiceDTO> =>
    client.put(`/tenant/sales/invoices/${id}`, payload),

  createAndPostSI: (payload: CreateSalesInvoicePayload): Promise<SalesInvoiceDTO> =>
    client.post('/tenant/sales/invoices/create-and-post', payload),

  updateAndPostSI: (id: string, payload: UpdateSalesInvoicePayload): Promise<SalesInvoiceDTO> =>
    client.put(`/tenant/sales/invoices/${id}/update-and-post`, payload),

  listSIs: (opts?: ListSalesInvoicesOptions): Promise<SalesInvoiceDTO[]> =>
    client.get('/tenant/sales/invoices', { params: opts }),

  getSI: (id: string): Promise<SalesInvoiceDTO> =>
    client.get(`/tenant/sales/invoices/${id}`),

  postSI: (id: string, settlementInput?: SettlementInputPayload): Promise<SalesInvoiceDTO> =>
    client.post(`/tenant/sales/invoices/${id}/post`, { settlementInput }),

  updatePaymentStatus: (id: string, payload: UpdateSalesInvoicePaymentStatusPayload): Promise<SalesInvoiceDTO> =>
    client.post(`/tenant/sales/invoices/${id}/payment-status`, payload),

  recordPayment: (id: string, payload: RecordSalesInvoicePaymentPayload): Promise<{ invoice: SalesInvoiceDTO; payment: Record<string, unknown>; voucherId?: string }> =>
    client.post(`/tenant/sales/invoices/${id}/record-payment`, payload),

  getPaymentHistory: (id: string): Promise<Record<string, unknown>[]> =>
    client.get(`/tenant/sales/invoices/${id}/payments`),

  createReturn: (payload: CreateSalesReturnPayload): Promise<SalesReturnDTO> =>
    client.post('/tenant/sales/returns', payload),

  listReturns: (opts?: ListSalesReturnsOptions): Promise<SalesReturnDTO[]> =>
    client.get('/tenant/sales/returns', { params: opts }),

  getReturn: (id: string): Promise<SalesReturnDTO> =>
    client.get(`/tenant/sales/returns/${id}`),

  updateReturn: (id: string, payload: UpdateSalesReturnPayload): Promise<SalesReturnDTO> =>
    client.put(`/tenant/sales/returns/${id}`, payload),

  postReturn: (id: string): Promise<SalesReturnDTO> =>
    client.post(`/tenant/sales/returns/${id}/post`, {}),
};
