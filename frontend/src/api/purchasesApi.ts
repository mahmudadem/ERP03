import client from './client';
import { PartyAccountsBackfillResult, WorkflowMode } from './salesApi';

export type POStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';
export type GRNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT';
export type DocumentSource = 'native' | 'default_form' | 'custom_form';

export interface PurchaseSettingsDTO {
  companyId: string;
  workflowMode: WorkflowMode;
  allowDirectInvoicing: boolean;
  requirePOForStockItems: boolean;
  defaultAPAccountId?: string;
  apParentAccountId?: string;
  partyAccountCodeFormat?: string;
  defaultPurchaseExpenseAccountId?: string;
  defaultGRNIAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  purchaseVoucherTypeId?: string;
  defaultWarehouseId?: string;
  poNumberPrefix: string;
  poNumberNextSeq: number;
  grnNumberPrefix: string;
  grnNumberNextSeq: number;
  piNumberPrefix: string;
  piNumberNextSeq: number;
  prNumberPrefix: string;
  prNumberNextSeq: number;
  exchangeGainLossAccountId?: string;
  governanceRules: PurchaseGovernanceRuleDTO[];
  defaultPurchaseInvoicePersona: 'direct' | 'linked' | 'service';
}

export interface PurchaseGovernanceRuleDTO {
  id: string;
  scope: 'company' | 'branch' | 'form';
  action: 'allow' | 'block';
  persona: 'direct' | 'linked' | 'service';
  branchId?: string;
  formType?: string;
}

export interface PurchaseOrderLineDTO {
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
  receivedQty: number;
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

export interface PurchaseOrderDTO {
  id: string;
  companyId: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseOrderLineDTO[];
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  status: POStatus;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  closedAt?: string;
}

export interface GoodsReceiptLineDTO {
  lineId: string;
  lineNo: number;
  poLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  receivedQty: number;
  uomId?: string;
  uom: string;
  unitCostDoc: number;
  unitCostBase: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface GoodsReceiptDTO {
  id: string;
  companyId: string;
  grnNumber: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  receiptDate: string;
  warehouseId: string;
  lines: GoodsReceiptLineDTO[];
  status: GRNStatus;
  voucherId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface PurchaseInvoiceLineDTO {
  lineId: string;
  lineNo: number;
  poLineId?: string;
  grnLineId?: string;
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
  accountId: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface PurchaseInvoiceDTO {
  id: string;
  companyId: string;
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  formType: string;
  voucherType: string;
  persona: string;
  source?: DocumentSource | string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseInvoiceLineDTO[];
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
  status: PIStatus;
  voucherId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface PurchaseReturnLineDTO {
  lineId: string;
  lineNo: number;
  piLineId?: string;
  grnLineId?: string;
  poLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  returnQty: number;
  uomId?: string;
  uom: string;
  unitCostDoc: number;
  unitCostBase: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  accountId?: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface PurchaseReturnDTO {
  id: string;
  companyId: string;
  returnNumber: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  returnContext: ReturnContext;
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseReturnLineDTO[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  reason: string;
  notes?: string;
  status: PRStatus;
  voucherId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface InitializePurchasesPayload {
  workflowMode?: WorkflowMode;
  defaultAPAccountId?: string;
  apParentAccountId?: string;
  partyAccountCodeFormat?: string;
  allowDirectInvoicing?: boolean;
  requirePOForStockItems?: boolean;
  defaultPurchaseExpenseAccountId?: string;
  defaultGRNIAccountId?: string;
  allowOverDelivery?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  purchaseVoucherTypeId?: string;
  defaultWarehouseId?: string;
  poNumberPrefix?: string;
  poNumberNextSeq?: number;
  grnNumberPrefix?: string;
  grnNumberNextSeq?: number;
  piNumberPrefix?: string;
  piNumberNextSeq?: number;
  prNumberPrefix?: string;
  prNumberNextSeq?: number;
  exchangeGainLossAccountId?: string;
}

export interface PurchaseOrderLineInputDTO {
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

export interface CreatePurchaseOrderPayload {
  vendorId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseOrderLineInputDTO[];
  notes?: string;
  internalNotes?: string;
}

export interface UpdatePurchaseOrderPayload {
  vendorId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseOrderLineInputDTO[];
  notes?: string;
  internalNotes?: string;
}

export interface ListPurchaseOrdersOptions {
  status?: POStatus;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface GoodsReceiptLineInputDTO {
  lineId?: string;
  lineNo?: number;
  poLineId?: string;
  itemId?: string;
  receivedQty: number;
  uomId?: string;
  uom?: string;
  unitCostDoc?: number;
  moveCurrency?: string;
  fxRateMovToBase?: number;
  fxRateCCYToBase?: number;
  description?: string;
}

export interface CreateGRNPayload {
  purchaseOrderId?: string;
  vendorId?: string;
  receiptDate: string;
  warehouseId: string;
  lines?: GoodsReceiptLineInputDTO[];
  notes?: string;
}

export interface UpdateGRNPayload {
  vendorId?: string;
  receiptDate?: string;
  warehouseId?: string;
  lines?: GoodsReceiptLineInputDTO[];
  notes?: string;
}

export interface ListGRNsOptions {
  purchaseOrderId?: string;
  status?: GRNStatus;
  limit?: number;
}

export interface PurchaseInvoiceLineInputDTO {
  lineId?: string;
  lineNo?: number;
  poLineId?: string;
  grnLineId?: string;
  itemId?: string;
  invoicedQty: number;
  uomId?: string;
  uom?: string;
  unitPriceDoc?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface CreatePurchaseInvoicePayload {
  formType?: string;
  voucherType?: string;
  persona?: string;
  source?: DocumentSource;
  purchaseOrderId?: string;
  vendorId: string;
  vendorAccountId?: string;
  receivablePayableAccountId?: string;
  vendorInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseInvoiceLineInputDTO[];
  notes?: string;
  settlementInput?: SettlementInputPayload;
}

export interface UpdatePurchaseInvoicePayload {
  formType?: string;
  voucherType?: string;
  persona?: string;
  source?: DocumentSource;
  vendorId?: string;
  vendorAccountId?: string;
  receivablePayableAccountId?: string;
  vendorInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseInvoiceLineInputDTO[];
  notes?: string;
  settlementInput?: SettlementInputPayload;
}

export interface SettlementInputPayload {
  settlementMode: 'DEFERRED' | 'CASH_FULL' | 'MULTI';
  receivablePayableAccountId?: string;
  settlements: SettlementRowPayload[];
}

export interface SettlementRowPayload {
  settlementAccountId: string;
  amountBase: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER';
  reference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface ListPurchaseInvoicesOptions {
  vendorId?: string;
  purchaseOrderId?: string;
  status?: PIStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
}

export interface PurchaseReturnLineInputDTO {
  lineId?: string;
  lineNo?: number;
  piLineId?: string;
  grnLineId?: string;
  poLineId?: string;
  itemId?: string;
  returnQty?: number;
  unitCostDoc?: number;
  uomId?: string;
  uom?: string;
  accountId?: string;
  description?: string;
}

export interface CreatePurchaseReturnPayload {
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  vendorId?: string;
  returnDate: string;
  warehouseId?: string;
  reason: string;
  notes?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseReturnLineInputDTO[];
}

export interface ListPurchaseReturnsOptions {
  vendorId?: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  status?: PRStatus;
}

export interface UpdateInvoicePaymentStatusPayload {
  paymentAmountBase: number;
}

export interface RecordPurchaseInvoicePaymentPayload {
  paymentAmountBase: number;
}

export type VendorStatementLineType = 'BILL' | 'PAYMENT' | 'DEBIT_NOTE' | 'REFUND' | 'ADJUSTMENT';

export interface VendorStatementLineDTO {
  ledgerEntryId?: string;
  date: string;
  type: VendorStatementLineType;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  voucherId?: string;
  voucherNo?: string;
  voucherType?: string;
  voucherFormId?: string;
  voucherPart?: string;
  description?: string;
  sourceModule?: string;
  sourceType?: string;
  sourceId?: string;
  sourceLabel?: string;
}

export interface OpenBillSummaryDTO {
  invoiceId: string;
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  invoiceDate: string;
  dueDate: string | undefined;
  grandTotalBase: number;
  outstandingAmountBase: number;
}

export interface VendorStatementCommitmentDTO {
  sourceType: 'PURCHASE_ORDER';
  sourceId: string;
  documentNumber: string;
  date: string;
  expectedDate?: string;
  status: string;
  amountBase: number;
  openAmountBase: number;
  description?: string;
}

export interface VendorStatementDTO {
  vendorId: string;
  vendorName: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: VendorStatementLineDTO[];
  totalBilled: number;
  totalPaid: number;
  totalDebited: number;
  totalAdjusted: number;
  openBills: OpenBillSummaryDTO[];
  openCommitments?: VendorStatementCommitmentDTO[];
}

export const purchasesApi = {
  initializePurchases: (payload: InitializePurchasesPayload): Promise<PurchaseSettingsDTO> =>
    client.post('/tenant/purchase/initialize', payload),

  getSettings: (): Promise<PurchaseSettingsDTO | null> =>
    client.get('/tenant/purchase/settings'),

  updateSettings: (payload: Partial<PurchaseSettingsDTO>): Promise<PurchaseSettingsDTO> =>
    client.put('/tenant/purchase/settings', payload),

  backfillPartyAccounts: (): Promise<PartyAccountsBackfillResult> =>
    client.post('/tenant/purchase/settings/backfill-party-accounts', {}).then((r: any) => r?.data?.data ?? r?.data ?? r),

  createPO: (payload: CreatePurchaseOrderPayload): Promise<PurchaseOrderDTO> =>
    client.post('/tenant/purchase/orders', payload),

  updatePO: (id: string, payload: UpdatePurchaseOrderPayload): Promise<PurchaseOrderDTO> =>
    client.put(`/tenant/purchase/orders/${id}`, payload),

  getPO: (id: string): Promise<PurchaseOrderDTO> =>
    client.get(`/tenant/purchase/orders/${id}`),

  listPOs: (opts?: ListPurchaseOrdersOptions): Promise<PurchaseOrderDTO[]> =>
    client.get('/tenant/purchase/orders', { params: opts }),

  confirmPO: (id: string): Promise<PurchaseOrderDTO> =>
    client.post(`/tenant/purchase/orders/${id}/confirm`, {}),

  cancelPO: (id: string): Promise<PurchaseOrderDTO> =>
    client.post(`/tenant/purchase/orders/${id}/cancel`, {}),

  closePO: (id: string): Promise<PurchaseOrderDTO> =>
    client.post(`/tenant/purchase/orders/${id}/close`, {}),

  createGRN: (payload: CreateGRNPayload): Promise<GoodsReceiptDTO> =>
    client.post('/tenant/purchase/goods-receipts', payload),

  listGRNs: (opts?: ListGRNsOptions): Promise<GoodsReceiptDTO[]> =>
    client.get('/tenant/purchase/goods-receipts', { params: opts }),

  getGRN: (id: string): Promise<GoodsReceiptDTO> =>
    client.get(`/tenant/purchase/goods-receipts/${id}`),

  updateGRN: (id: string, payload: UpdateGRNPayload): Promise<GoodsReceiptDTO> =>
    client.put(`/tenant/purchase/goods-receipts/${id}`, payload),

  postGRN: (id: string): Promise<GoodsReceiptDTO> =>
    client.post(`/tenant/purchase/goods-receipts/${id}/post`, {}),

  unpostGRN: (id: string): Promise<GoodsReceiptDTO> =>
    client.post(`/tenant/purchase/goods-receipts/${id}/unpost`, {}),

  createPI: (payload: CreatePurchaseInvoicePayload): Promise<PurchaseInvoiceDTO> =>
    client.post('/tenant/purchase/invoices', payload),

  createAndPostPI: (payload: CreatePurchaseInvoicePayload): Promise<PurchaseInvoiceDTO> =>
    client.post('/tenant/purchase/invoices/create-and-post', payload),

  updatePI: (id: string, payload: UpdatePurchaseInvoicePayload): Promise<PurchaseInvoiceDTO> =>
    client.put(`/tenant/purchase/invoices/${id}`, payload),

  updateAndPostPI: (id: string, payload: UpdatePurchaseInvoicePayload): Promise<PurchaseInvoiceDTO> =>
    client.put(`/tenant/purchase/invoices/${id}/update-and-post`, payload),

  listPIs: (opts?: ListPurchaseInvoicesOptions): Promise<PurchaseInvoiceDTO[]> =>
    client.get('/tenant/purchase/invoices', { params: opts }),

  getPI: (id: string): Promise<PurchaseInvoiceDTO> =>
    client.get(`/tenant/purchase/invoices/${id}`),

  postPI: (id: string, settlementInput?: SettlementInputPayload): Promise<PurchaseInvoiceDTO> =>
    client.post(`/tenant/purchase/invoices/${id}/post`, { settlementInput }),

  unpostPI: (id: string): Promise<PurchaseInvoiceDTO> =>
    client.post(`/tenant/purchase/invoices/${id}/unpost`, {}),

  updatePaymentStatus: (invoiceId: string, payload: UpdateInvoicePaymentStatusPayload): Promise<PurchaseInvoiceDTO> =>
    client.post(`/tenant/purchase/invoices/${invoiceId}/payment-update`, payload),

  recordPayment: (invoiceId: string, payload: RecordPurchaseInvoicePaymentPayload): Promise<{ invoice: PurchaseInvoiceDTO; payment: Record<string, unknown>; voucherId?: string }> =>
    client.post(`/tenant/purchase/invoices/${invoiceId}/record-payment`, payload),

  getPaymentHistory: (invoiceId: string): Promise<Record<string, unknown>[]> =>
    client.get(`/tenant/purchase/invoices/${invoiceId}/payments`),

  getVendorStatement: (params: { vendorId: string; fromDate: string; toDate: string; includeOpenCommitments?: boolean }): Promise<VendorStatementDTO> =>
    client.get('/tenant/purchase/reports/vendor-statement', { params }),

  createReturn: (payload: CreatePurchaseReturnPayload): Promise<PurchaseReturnDTO> =>
    client.post('/tenant/purchase/returns', payload),

  listReturns: (opts?: ListPurchaseReturnsOptions): Promise<PurchaseReturnDTO[]> =>
    client.get('/tenant/purchase/returns', { params: opts }),

  getReturn: (id: string): Promise<PurchaseReturnDTO> =>
    client.get(`/tenant/purchase/returns/${id}`),

  updateReturn: (id: string, payload: Partial<CreatePurchaseReturnPayload>): Promise<PurchaseReturnDTO> =>
    client.put(`/tenant/purchase/returns/${id}`, payload),

  postReturn: (id: string): Promise<PurchaseReturnDTO> =>
    client.post(`/tenant/purchase/returns/${id}/post`, {}),

  unpostReturn: (id: string): Promise<PurchaseReturnDTO> =>
    client.post(`/tenant/purchase/returns/${id}/unpost`, {}),
};
