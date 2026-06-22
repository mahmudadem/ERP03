/**
 * posApi.ts — Frontend API client for the POS module.
 *
 * All endpoints sit under `/tenant/pos/...`. The backend module mount
 * (PosModule) auto-registers behind `companyModuleGuard('pos')`.
 */
import client from './client';

export type PosPaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
export type PosCashRounding = 'none' | 'nearest_05' | 'nearest_1';
export type PosRegisterStatus = 'ACTIVE' | 'INACTIVE';
export type PosShiftStatus = 'OPEN' | 'CLOSED' | 'RECONCILED' | 'FORCE_CLOSED' | 'CANCELLED';
export type PosHeldCartStatus = 'HELD' | 'RECALLED' | 'CANCELLED';
export type PosShiftPaymentTotals = Record<PosPaymentMethodCode, number>;

export interface PosPaymentMethodDTO {
  code: PosPaymentMethodCode;
  settlementAccountId: string;
  label?: string;
  requiresReference: boolean;
  allowsChange: boolean;
  isEnabled: boolean;
}

export interface PosSettingsDTO {
  companyId: string;
  requireOpenShift: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  receiptPrefix: string;
  receiptNextSeq: number;
  cashRounding: PosCashRounding;
  allowPosDirectSales: boolean;
  paymentMethods: PosPaymentMethodDTO[];
}

export interface PosRegisterDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  branchId?: string;
  warehouseId: string;
  defaultPriceListId?: string;
  allowedCashierUserIds: string[];
  hardwareProfileId?: string;
  cashDrawerAccountId: string;
  settlementAccountIds?: Partial<Record<PosPaymentMethodCode, string>>;
  status: PosRegisterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PosShiftDTO {
  id: string;
  companyId: string;
  registerId: string;
  cashierUserId: string;
  status: PosShiftStatus;
  openedAt: string;
  openingFloat: number;
  closedAt?: string;
  expectedCash?: number;
  countedCash?: number;
  expectedPaymentTotals?: PosShiftPaymentTotals;
  countedPaymentTotals?: PosShiftPaymentTotals;
  overShortPaymentTotals?: PosShiftPaymentTotals;
  overShortAmount?: number;
  overShortVoucherId?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PosHeldCartLineDTO {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  lineDiscount?: number;
  lineTotal?: number;
  taxCodeId?: string;
  priceOverride?: boolean;
  taxOverride?: boolean;
  managerOverrideId?: string;
  note?: string;
}

export interface PosHeldCartDTO {
  id: string;
  companyId: string;
  registerId: string;
  shiftId: string;
  cashierUserId: string;
  customerId?: string;
  note?: string;
  status: PosHeldCartStatus;
  lines: PosHeldCartLineDTO[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  recalledAt?: string;
  recalledBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
}

// The global response interceptor (setupErrorInterceptor) already unwraps the
// `{ success, data }` envelope and resolves to the bare payload, so `r` is
// usually ALREADY the DTO. The three-level fallback mirrors every other api
// module (accountingApi, salesApi, …): it peels a residual envelope when the
// interceptor is bypassed, otherwise falls through to `r`. The previous
// two-level form (`r.data.data ?? r.data`) dropped to `r.data` (undefined),
// which made every POS read resolve to undefined.
const ok = <T>(p: Promise<any>): Promise<T> =>
  p.then((r: any) => (r?.data?.data ?? r?.data ?? r) as T);

export const posApi = {
  initializePos: async (): Promise<PosSettingsDTO> =>
    ok(client.post('/tenant/pos/initialize', {})),

  getSettings: async (): Promise<PosSettingsDTO | null> =>
    ok(client.get('/tenant/pos/settings')),

  updateSettings: async (payload: Partial<PosSettingsDTO>): Promise<PosSettingsDTO> =>
    ok(client.put('/tenant/pos/settings', payload)),

  listRegisters: async (): Promise<PosRegisterDTO[]> =>
    ok(client.get('/tenant/pos/registers')),

  getRegister: async (id: string): Promise<PosRegisterDTO> =>
    ok(client.get(`/tenant/pos/registers/${encodeURIComponent(id)}`)),

  createRegister: async (payload: Partial<PosRegisterDTO>): Promise<PosRegisterDTO> =>
    ok(client.post('/tenant/pos/registers', payload)),

  updateRegister: async (id: string, payload: Partial<PosRegisterDTO>): Promise<PosRegisterDTO> =>
    ok(client.put(`/tenant/pos/registers/${encodeURIComponent(id)}`, payload)),

  // ===== Shifts =====
  openShift: async (payload: { registerId: string; cashierUserId?: string; openingFloat: number }): Promise<PosShiftDTO> =>
    ok(client.post('/tenant/pos/shifts/open', payload)),

  closeShift: async (id: string, payload: { countedCash: number; countedPaymentTotals?: Partial<PosShiftPaymentTotals> }): Promise<any> =>
    ok(client.post(`/tenant/pos/shifts/${encodeURIComponent(id)}/close`, payload)),

  forceCloseShift: async (id: string, payload: { countedCash: number; countedPaymentTotals?: Partial<PosShiftPaymentTotals> }): Promise<any> =>
    ok(client.post(`/tenant/pos/shifts/${encodeURIComponent(id)}/force-close`, payload)),

  createCashMovement: async (id: string, payload: { type: 'PAYIN' | 'PAYOUT' | 'DROP'; amount: number; reason?: string }): Promise<any> =>
    ok(client.post(`/tenant/pos/shifts/${encodeURIComponent(id)}/cash-movements`, payload)),

  listShifts: async (filters?: { registerId?: string; status?: string; limit?: number }): Promise<PosShiftDTO[]> =>
    ok(client.get('/tenant/pos/shifts', { params: filters || {} })),

  getShift: async (id: string): Promise<PosShiftDTO> =>
    ok(client.get(`/tenant/pos/shifts/${encodeURIComponent(id)}`)),

  getXReport: async (id: string): Promise<{ shift: PosShiftDTO; totals: any; generatedAt: string }> =>
    ok(client.get(`/tenant/pos/shifts/${encodeURIComponent(id)}/x-report`)),

  // ===== Sale / Receipts =====
  getBootstrap: async (params: { registerId?: string; cashierUserId?: string }): Promise<any> =>
    ok(client.get('/tenant/pos/bootstrap', { params })),

  searchProducts: async (q: string, limit = 25): Promise<{ items: any[] }> =>
    ok(client.get('/tenant/pos/products/search', { params: { q, limit } })),

  /** Calculation-only quote (tax-inclusive) for the cashier screen. Does not persist. */
  previewSale: async (lines: Array<{ itemId: string; qty: number; unitPrice: number }>):
    Promise<{ subtotal: number; taxTotal: number; grandTotal: number; lines: any[] }> =>
    ok(client.post('/tenant/pos/sales/preview', { lines })),

  completeSale: async (payload: {
    registerId: string;
    shiftId: string;
    customerId?: string;
    cashierRoleId?: string;
    lines: Array<{
      itemId: string;
      itemCode?: string;
      itemName?: string;
      uom?: string;
      qty: number;
      unitPrice: number;
      discountType?: 'PERCENT' | 'AMOUNT';
      discountValue?: number;
      taxCodeId?: string;
      priceOverride?: boolean;
      taxOverride?: boolean;
      status?: 'ACTIVE' | 'VOIDED';
      voidedBy?: string;
      voidedAt?: string;
      voidReason?: string;
      managerOverrideId?: string;
    }>;
    payments: Array<{ method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM'; amount: number; reference?: string }>;
  }): Promise<any> =>
    ok(client.post('/tenant/pos/sales', payload)),

  holdCart: async (payload: {
    registerId: string;
    shiftId: string;
    cashierUserId?: string;
    customerId?: string;
    note?: string;
    lines: PosHeldCartLineDTO[];
    subtotal?: number;
    discountTotal?: number;
    taxTotal?: number;
    grandTotal?: number;
  }): Promise<PosHeldCartDTO> =>
    ok(client.post('/tenant/pos/held-carts', payload)),

  listHeldCarts: async (params?: {
    registerId?: string;
    shiftId?: string;
    cashierUserId?: string;
    status?: PosHeldCartStatus;
    limit?: number;
  }): Promise<PosHeldCartDTO[]> =>
    ok(client.get('/tenant/pos/held-carts', { params: params || {} })),

  getHeldCart: async (id: string): Promise<PosHeldCartDTO> =>
    ok(client.get(`/tenant/pos/held-carts/${encodeURIComponent(id)}`)),

  recallHeldCart: async (id: string): Promise<PosHeldCartDTO> =>
    ok(client.post(`/tenant/pos/held-carts/${encodeURIComponent(id)}/recall`, {})),

  cancelHeldCart: async (id: string, payload?: { reason?: string }): Promise<PosHeldCartDTO> =>
    ok(client.post(`/tenant/pos/held-carts/${encodeURIComponent(id)}/cancel`, payload || {})),

  listReceipts: async (params?: { shiftId?: string; registerId?: string; customerId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/receipts', { params: params || {} })),

  getReceipt: async (id: string): Promise<{ receipt: any; payments: any[] }> =>
    ok(client.get(`/tenant/pos/receipts/${encodeURIComponent(id)}`)),

  voidReceipt: async (id: string, payload: {
    registerId: string;
    shiftId?: string;
    cashierRoleId?: string;
    managerOverrideId?: string;
    refundMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
    reason?: string;
  }): Promise<any> =>
    ok(client.post(`/tenant/pos/receipts/${encodeURIComponent(id)}/void`, payload)),

  // ===== Returns =====
  completeReturn: async (payload: {
    originalReceiptId: string;
    registerId: string;
    shiftId?: string;
    cashierRoleId?: string;
    managerOverrideId?: string;
    lines: Array<{ itemId: string; qty: number }>;
    refundMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
  }): Promise<any> =>
    ok(client.post('/tenant/pos/returns', payload)),

  completeExchange: async (payload: {
    originalReceiptId: string;
    registerId: string;
    shiftId: string;
    customerId?: string;
    cashierRoleId?: string;
    managerOverrideId?: string;
    returnLines: Array<{ itemId: string; qty: number }>;
    saleLines: Array<{
      itemId: string;
      itemCode?: string;
      itemName?: string;
      uom?: string;
      qty: number;
      unitPrice: number;
      discountType?: 'PERCENT' | 'AMOUNT';
      discountValue?: number;
      taxCodeId?: string;
      priceOverride?: boolean;
      taxOverride?: boolean;
      managerOverrideId?: string;
    }>;
    salePayments: Array<{ method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM'; amount: number; reference?: string }>;
    refundMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
    reason?: string;
  }): Promise<any> =>
    ok(client.post('/tenant/pos/exchanges', payload)),

  listReturns: async (params?: { shiftId?: string; originalReceiptId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/returns', { params: params || {} })),

  // ===== Reports =====
  getZReport: async (shiftId: string): Promise<any> =>
    ok(client.get(`/tenant/pos/shifts/${encodeURIComponent(shiftId)}/z-report`)),

  getDailySummary: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/daily-summary', { params: params || {} })),

  getPaymentMethodSummary: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/payment-methods', { params: params || {} })),

  getCashierSales: async (params?: { dateFrom?: string; dateTo?: string }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/cashier-sales', { params: params || {} })),

  getCashOverShort: async (params?: { dateFrom?: string; dateTo?: string }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/cash-over-short', { params: params || {} })),

  getReceiptHistoryReport: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string; customerId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/receipt-history', { params: params || {} })),

  getTopSellingItemsReport: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/top-selling-items', { params: params || {} })),

  getOverrideAuditReport: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/override-audit', { params: params || {} })),

  getReprintAuditReport: async (params?: { dateFrom?: string; dateTo?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/reprint-audit', { params: params || {} })),
};

export default posApi;
