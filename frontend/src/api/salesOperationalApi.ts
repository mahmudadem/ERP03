import client from './client';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export interface QuoteLineDTO {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  quotedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountAmountDoc?: number;
  taxCodeId?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  grossLineTotalDoc: number;
  discountAmountBase?: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  lineTotalBase: number;
  description?: string;
}

export interface QuoteDTO {
  id: string;
  companyId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  status: QuoteStatus;
  version: number;
  originQuoteId?: string;
  quoteDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: QuoteLineDTO[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  notes?: string;
  convertedToType?: 'SALES_ORDER' | 'SALES_INVOICE';
  convertedToId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditOverrideDTO {
  id: string;
  companyId: string;
  customerId: string;
  overrideLimit?: number;
  reason?: string;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface AgedBacklogRowDTO {
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  promisedDate: string;
  daysOverdue: number;
  grandTotalBase: number;
  status: string;
}

export type PromotionType = 'BUY_X_GET_Y' | 'THRESHOLD_DISCOUNT';
export type PromotionScope = 'ALL' | 'ITEMS' | 'CATEGORIES';

export interface BuyXGetYConfig {
  buyQty: number;
  getQty: number;
  getItemId?: string;
}

export interface ThresholdDiscountConfig {
  thresholdBasis: 'QTY' | 'AMOUNT';
  thresholdValue: number;
  discountPct: number;
}

export interface PromotionRuleDTO {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  type: PromotionType;
  status: 'ACTIVE' | 'INACTIVE';
  priority: number;
  validFrom?: string;
  validTo?: string;
  scope: PromotionScope;
  itemIds: string[];
  categoryIds: string[];
  buyXGetY?: BuyXGetYConfig;
  thresholdDiscount?: ThresholdDiscountConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── unwrap helper ────────────────────────────────────────────────────────────

const unwrap = <T>(payload: any): T => (payload?.data ?? payload) as T;

// ─── API Object ──────────────────────────────────────────────────────────────

export const salesOperationalApi = {
  // ── Quotes ──────────────────────────────────────────────────────────────────

  listQuotes: (opts?: {
    status?: string;
    customerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<QuoteDTO[]> =>
    client.get('/tenant/sales/quotes', { params: opts }).then(unwrap<QuoteDTO[]>),

  getQuote: (id: string): Promise<QuoteDTO> =>
    client.get(`/tenant/sales/quotes/${id}`).then(unwrap<QuoteDTO>),

  createQuote: (body: Record<string, any>): Promise<QuoteDTO> =>
    client.post('/tenant/sales/quotes', body).then(unwrap<QuoteDTO>),

  updateQuote: (id: string, body: Record<string, any>): Promise<QuoteDTO> =>
    client.put(`/tenant/sales/quotes/${id}`, body).then(unwrap<QuoteDTO>),

  deleteQuote: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/sales/quotes/${id}`).then(unwrap<{ success: boolean }>),

  sendQuote: (id: string): Promise<QuoteDTO> =>
    client.post(`/tenant/sales/quotes/${id}/send`, {}).then(unwrap<QuoteDTO>),

  acceptQuote: (id: string): Promise<QuoteDTO> =>
    client.post(`/tenant/sales/quotes/${id}/accept`, {}).then(unwrap<QuoteDTO>),

  rejectQuote: (id: string): Promise<QuoteDTO> =>
    client.post(`/tenant/sales/quotes/${id}/reject`, {}).then(unwrap<QuoteDTO>),

  reviseQuote: (id: string): Promise<QuoteDTO> =>
    client.post(`/tenant/sales/quotes/${id}/revise`, {}).then(unwrap<QuoteDTO>),

  convertQuoteToOrder: (id: string): Promise<{ quote: QuoteDTO; salesOrderId: string }> =>
    client
      .post(`/tenant/sales/quotes/${id}/convert-to-order`, {})
      .then(unwrap<{ quote: QuoteDTO; salesOrderId: string }>),

  convertQuoteToInvoice: (id: string): Promise<{ quote: QuoteDTO; salesInvoiceId: string }> =>
    client
      .post(`/tenant/sales/quotes/${id}/convert-to-invoice`, {})
      .then(unwrap<{ quote: QuoteDTO; salesInvoiceId: string }>),

  // ── Credit Overrides ─────────────────────────────────────────────────────────

  listCreditOverrides: (opts?: {
    customerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CreditOverrideDTO[]> =>
    client
      .get('/tenant/sales/credit-overrides', { params: opts })
      .then(unwrap<CreditOverrideDTO[]>),

  // ── Aged Backlog ─────────────────────────────────────────────────────────────

  getAgedBacklog: (params?: {
    asOfDate?: string;
    customerId?: string;
  }): Promise<AgedBacklogRowDTO[]> =>
    client
      .get('/tenant/sales/aged-backlog', { params })
      .then(unwrap<AgedBacklogRowDTO[]>),

  // ── Promotions ───────────────────────────────────────────────────────────────

  listPromotions: (opts?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PromotionRuleDTO[]> =>
    client
      .get('/tenant/sales/promotions', { params: opts })
      .then(unwrap<PromotionRuleDTO[]>),

  getPromotion: (id: string): Promise<PromotionRuleDTO> =>
    client.get(`/tenant/sales/promotions/${id}`).then(unwrap<PromotionRuleDTO>),

  createPromotion: (body: Record<string, any>): Promise<PromotionRuleDTO> =>
    client.post('/tenant/sales/promotions', body).then(unwrap<PromotionRuleDTO>),

  updatePromotion: (id: string, body: Record<string, any>): Promise<PromotionRuleDTO> =>
    client.put(`/tenant/sales/promotions/${id}`, body).then(unwrap<PromotionRuleDTO>),

  deletePromotion: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/sales/promotions/${id}`).then(unwrap<{ success: boolean }>),

  evaluatePromotions: (body: Record<string, any>): Promise<{ discountAmount: number; appliedRules: string[] }> =>
    client
      .post('/tenant/sales/promotions/evaluate', body)
      .then(unwrap<{ discountAmount: number; appliedRules: string[] }>),
};
