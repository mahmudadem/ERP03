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
export type ReturnSettlementMode = 'CREDIT_NOTE' | 'REFUND';
export type ReturnReasonCode = 'DEFECTIVE' | 'WRONG_ITEM' | 'CHANGED_MIND' | 'OTHER';
export type RestockingFeeType = 'PERCENT' | 'AMOUNT';
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

export interface SalesMessagingAccountDTO {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'TELEGRAM';
  provider: 'META_WHATSAPP_CLOUD' | 'SMTP' | 'TELEGRAM_BOT';
  label: string;
  isDefault: boolean;
  isActive: boolean;
  phoneNumberE164?: string;
  phoneNumberId?: string;
  fromAddress?: string;
  fromDisplayName?: string;
  botUsername?: string;
  apiVersion?: string;
  hasCredential?: boolean;
  credential?: string;
}

export interface SalesSettingsDTO {
  companyId: string;
  workflowMode: WorkflowMode;
  showOperationalDocsInSimple?: boolean;
  allowCreditOverride?: boolean;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  arParentAccountId?: string;
  partyAccountCodeFormat?: string;
  defaultRevenueAccountId?: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  defaultRefundAccountId?: string;
  restockingFeeAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  paymentMethodConfigs: SalesPaymentMethodConfigDTO[];
  messagingAccounts: SalesMessagingAccountDTO[];
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
  quoteNumberPrefix: string;
  quoteNumberNextSeq: number;
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
  appliedPromotionId?: string;
  appliedPromotionName?: string;
  appliedDiscountPct?: number;
}

export interface SalesOrderDTO {
  id: string;
  companyId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
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
  promisedDate?: string;
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
  promisedDate?: string;
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
  voucherFormId?: string;
  formType?: string;
  voucherType?: string;
  persona?: 'direct' | 'linked' | 'service';
  source?: DocumentSource | string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesInvoiceLineDTO[];
  attachments?: SalesInvoiceAttachmentDTO[];
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

export interface SalesInvoiceAttachmentDTO {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  uploadedAt: string;
  uploadedBy: string;
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
  netSettlementAmountDoc: number;
  netSettlementAmountBase: number;
  settlementMode: ReturnSettlementMode;
  reasonCode: ReturnReasonCode;
  reason: string;
  restockingFeeType?: RestockingFeeType;
  restockingFeeValue: number;
  restockingFeeAmountDoc: number;
  restockingFeeAmountBase: number;
  notes?: string;
  status: SRStatus;
  revenueVoucherId?: string | null;
  cogsVoucherId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
  refundSettlementAccountId?: string;
}

export interface InitializeSalesPayload {
  workflowMode?: WorkflowMode;
  defaultARAccountId?: string;
  arParentAccountId?: string;
  partyAccountCodeFormat?: string;
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
  messagingAccounts?: SalesMessagingAccountDTO[];
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
  quoteNumberPrefix?: string;
  quoteNumberNextSeq?: number;
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
  appliedPromotionId?: string;
  appliedPromotionName?: string;
  appliedDiscountPct?: number;
}

export interface CreateSalesOrderPayload {
  customerId: string;
  salespersonId?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  promisedDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesOrderLineInputDTO[];
  notes?: string;
  internalNotes?: string;
  skipPromotions?: boolean;
}

export interface UpdateSalesOrderPayload {
  customerId?: string;
  salespersonId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  promisedDate?: string;
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
  promisedDate?: string;
  warehouseId: string;
  lines?: DeliveryNoteLineInputDTO[];
  notes?: string;
}

export interface UpdateDeliveryNotePayload {
  customerId?: string;
  deliveryDate?: string;
  promisedDate?: string;
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
  priceIsInclusive?: boolean;
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
  voucherFormId?: string;
  formType?: string;
  voucherType?: string;
  persona?: 'direct' | 'linked' | 'service';
  source?: DocumentSource;
  salesOrderId?: string;
  customerId: string;
  salespersonId?: string;
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
  /** When provided alongside a BLOCK-policy credit limit breach, the invoice
   *  creation proceeds and an audit override record is persisted. */
  creditOverrideReason?: string;
}

export interface UpdateSalesInvoicePayload {
  voucherFormId?: string;
  formType?: string;
  voucherType?: string;
  persona?: 'direct' | 'linked' | 'service';
  source?: DocumentSource;
  customerId?: string;
  salespersonId?: string;
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
  settlementMode?: ReturnSettlementMode;
  reasonCode?: ReturnReasonCode;
  reason: string;
  restockingFeeType?: RestockingFeeType;
  restockingFeeValue?: number;
  notes?: string;
  lines?: SalesReturnLineInputDTO[];
  refundSettlementAccountId?: string;
}

export interface UpdateSalesReturnPayload {
  returnDate?: string;
  warehouseId?: string;
  settlementMode?: ReturnSettlementMode;
  reasonCode?: ReturnReasonCode;
  reason?: string;
  restockingFeeType?: RestockingFeeType;
  restockingFeeValue?: number;
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

export interface SendSalesInvoiceWhatsAppPayload {
  messagingAccountId?: string;
  toPhoneNumber?: string;
  messageText?: string;
  documentUrl?: string;
}

export interface SendSalesInvoiceWhatsAppResult {
  provider: string;
  messageId: string;
  senderAccountId?: string;
  senderLabel?: string;
  invoiceId: string;
  invoiceNumber: string;
  recipientPhoneNumber: string;
}

export interface SendSalesInvoiceTelegramPayload {
  messagingAccountId?: string;
  toChatId?: string;
  messageText?: string;
  documentUrl?: string;
}

export interface SendSalesInvoiceTelegramResult {
  provider: string;
  messageId: string;
  senderAccountId?: string;
  senderLabel?: string;
  invoiceId: string;
  invoiceNumber: string;
  recipientChatId: string;
}

export interface SalesInvoiceAttachmentDownloadLinkResult {
  url: string;
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

  confirmSO: (id: string, body?: { override?: { reason: string } }): Promise<SalesOrderDTO> =>
    client.post(`/tenant/sales/orders/${id}/confirm`, body ?? {}),

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

  postDN: (id: string, periodLockOverrideReason?: string): Promise<DeliveryNoteDTO> =>
    client.post(`/tenant/sales/delivery-notes/${id}/post`, { periodLockOverrideReason }),

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

  postSI: (id: string, settlementInput?: SettlementInputPayload, periodLockOverrideReason?: string): Promise<SalesInvoiceDTO> =>
    client.post(`/tenant/sales/invoices/${id}/post`, { settlementInput, periodLockOverrideReason }),

  updatePaymentStatus: (id: string, payload: UpdateSalesInvoicePaymentStatusPayload): Promise<SalesInvoiceDTO> =>
    client.post(`/tenant/sales/invoices/${id}/payment-status`, payload),

  recordPayment: (id: string, payload: RecordSalesInvoicePaymentPayload): Promise<{ invoice: SalesInvoiceDTO; payment: Record<string, unknown>; voucherId?: string }> =>
    client.post(`/tenant/sales/invoices/${id}/record-payment`, payload),

  getPaymentHistory: (id: string): Promise<Record<string, unknown>[]> =>
    client.get(`/tenant/sales/invoices/${id}/payments`),

  sendInvoiceWhatsApp: (id: string, payload: SendSalesInvoiceWhatsAppPayload): Promise<SendSalesInvoiceWhatsAppResult> =>
    client.post(`/tenant/sales/invoices/${id}/send-whatsapp`, payload),

  sendInvoiceTelegram: (id: string, payload: SendSalesInvoiceTelegramPayload): Promise<SendSalesInvoiceTelegramResult> =>
    client.post(`/tenant/sales/invoices/${id}/send-telegram`, payload),

  listInvoiceAttachments: (id: string): Promise<SalesInvoiceAttachmentDTO[]> =>
    client.get(`/tenant/sales/invoices/${id}/attachments`).then((r: any) => r?.data?.data ?? r?.data ?? r),

  uploadInvoiceAttachment: (id: string, file: File): Promise<SalesInvoiceAttachmentDTO> => {
    const form = new FormData();
    form.append('file', file);
    return client.post(`/tenant/sales/invoices/${id}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },

  removeInvoiceAttachment: (id: string, attachmentId: string): Promise<void> =>
    client.delete(`/tenant/sales/invoices/${id}/attachments/${attachmentId}`).then(() => undefined),

  getInvoiceAttachmentDownloadLink: (id: string, attachmentId: string): Promise<SalesInvoiceAttachmentDownloadLinkResult> =>
    client.get(`/tenant/sales/invoices/${id}/attachments/${attachmentId}/link`).then((r: any) => r?.data?.data ?? r?.data ?? r),

  createReturn: (payload: CreateSalesReturnPayload): Promise<SalesReturnDTO> =>
    client.post('/tenant/sales/returns', payload),

  listReturns: (opts?: ListSalesReturnsOptions): Promise<SalesReturnDTO[]> =>
    client.get('/tenant/sales/returns', { params: opts }),

  getReturn: (id: string): Promise<SalesReturnDTO> =>
    client.get(`/tenant/sales/returns/${id}`),

  updateReturn: (id: string, payload: UpdateSalesReturnPayload): Promise<SalesReturnDTO> =>
    client.put(`/tenant/sales/returns/${id}`, payload),

  postReturn: (id: string, periodLockOverrideReason?: string): Promise<SalesReturnDTO> =>
    client.post(`/tenant/sales/returns/${id}/post`, { periodLockOverrideReason }),
};

// Recurring Invoice types
export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type RecurringInvoiceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface RecurringInvoiceLineDTO {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unitPriceDoc: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  description?: string;
}

export interface RecurringInvoiceTemplateDTO {
  id: string;
  companyId: string;
  name: string;
  sourceInvoiceId?: string;
  customerId: string;
  customerName: string;
  currency: string;
  exchangeRate: number;
  lines: RecurringInvoiceLineDTO[];
  notes?: string;
  paymentTermsDays: number;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesGenerated: number;
  nextGenerationDate: string;
  status: RecurringInvoiceStatus;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreateRecurringInvoicePayload {
  name: string;
  sourceInvoiceId?: string;
  customerId: string;
  customerName: string;
  currency: string;
  exchangeRate?: number;
  lines: Omit<RecurringInvoiceLineDTO, 'taxCode'>[];
  notes?: string;
  paymentTermsDays?: number;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
}

export interface CloneInvoiceToTemplatePayload {
  name: string;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate?: string;
  endDate?: string;
  maxOccurrences?: number;
}

export const recurringInvoiceApi = {
  list: (opts?: { status?: string; customerId?: string }): Promise<RecurringInvoiceTemplateDTO[]> =>
    client.get('/tenant/sales/recurring-invoices', { params: opts }).then((r: any) => r?.data?.data ?? r?.data ?? r),

  getById: (id: string): Promise<RecurringInvoiceTemplateDTO> =>
    client.get(`/tenant/sales/recurring-invoices/${id}`).then((r: any) => r?.data?.data ?? r?.data ?? r),

  create: (payload: CreateRecurringInvoicePayload): Promise<RecurringInvoiceTemplateDTO> =>
    client.post('/tenant/sales/recurring-invoices', payload).then((r: any) => r?.data?.data ?? r?.data ?? r),

  update: (id: string, payload: Partial<CreateRecurringInvoicePayload>): Promise<RecurringInvoiceTemplateDTO> =>
    client.put(`/tenant/sales/recurring-invoices/${id}`, payload).then((r: any) => r?.data?.data ?? r?.data ?? r),

  pause: (id: string): Promise<RecurringInvoiceTemplateDTO> =>
    client.post(`/tenant/sales/recurring-invoices/${id}/pause`, {}).then((r: any) => r?.data?.data ?? r?.data ?? r),

  resume: (id: string): Promise<RecurringInvoiceTemplateDTO> =>
    client.post(`/tenant/sales/recurring-invoices/${id}/resume`, {}).then((r: any) => r?.data?.data ?? r?.data ?? r),

  cancel: (id: string): Promise<RecurringInvoiceTemplateDTO> =>
    client.post(`/tenant/sales/recurring-invoices/${id}/cancel`, {}).then((r: any) => r?.data?.data ?? r?.data ?? r),

  remove: (id: string): Promise<void> =>
    client.delete(`/tenant/sales/recurring-invoices/${id}`).then(() => undefined),

  generate: (asOfDate?: string): Promise<SalesInvoiceDTO[]> =>
    client.post('/tenant/sales/recurring-invoices/generate', { asOfDate }).then((r: any) => r?.data?.data ?? r?.data ?? r),

  cloneToTemplate: (invoiceId: string, payload: CloneInvoiceToTemplatePayload): Promise<RecurringInvoiceTemplateDTO> =>
    client.post(`/tenant/sales/invoices/${invoiceId}/clone-to-template`, payload).then((r: any) => r?.data?.data ?? r?.data ?? r),
};
