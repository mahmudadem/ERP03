/**
 * posApi.ts — Frontend API client for the POS module.
 *
 * All endpoints sit under `/tenant/pos/...`. The backend module mount
 * (PosModule) auto-registers behind `companyModuleGuard('pos')`.
 */
import client from './client';
import type { PolicyConfigDTO, PolicyRule } from './controlsPoliciesApi';

export type PosPaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
export type PosCashRounding = 'none' | 'nearest_05' | 'nearest_1';
export type PosNegativeStockPolicy = 'BLOCK' | 'ALLOW';
export type PosRegisterStatus = 'ACTIVE' | 'INACTIVE';
export type PosShiftStatus = 'OPEN' | 'CLOSED' | 'RECONCILED' | 'FORCE_CLOSED' | 'CANCELLED';
export type PosHeldCartStatus = 'HELD' | 'RECALLED' | 'CANCELLED';
export type PosManagerOverrideAction = 'VOID_LINE' | 'PRICE_OVERRIDE' | 'DISCOUNT_OVERRIDE' | 'TAX_OVERRIDE' | 'RETURN' | 'REPRINT' | 'CREDIT_SALE';
export type PosShiftPaymentTotals = Record<PosPaymentMethodCode, number>;
export type PosLayoutScopeType = 'COMPANY' | 'BRANCH' | 'REGISTER' | 'USER';
export type PosProductShortcutNodeType = 'GROUP' | 'ITEM';
export type PosControlButtonZone = 'TOP_BAR' | 'RIGHT_PANEL' | 'CART_FOOTER' | 'BOTTOM_BAR' | 'MORE_MENU';
export type PosCommandCode =
  | 'CUSTOMER_LOOKUP'
  | 'PRINT_RECEIPT'
  | 'REPRINT_LAST_RECEIPT'
  | 'HOLD_SALE'
  | 'RECALL_SALE'
  | 'CLEAR_CART'
  | 'VOID_LINE'
  | 'VOID_TICKET'
  | 'APPLY_DISCOUNT'
  | 'PRICE_CHECK'
  | 'CASH_PAYMENT'
  | 'CARD_PAYMENT'
  | 'SPLIT_PAYMENT'
  | 'OPEN_CASH_DRAWER'
  | 'RETURN_REFUND'
  | 'END_SHIFT';

export interface PosCashierRolePolicyDTO {
  roleId: string;
  requireApprovalForDirectSales?: boolean;
  managerOverrideActions?: PosManagerOverrideAction[];
  maxLineDiscountPercent?: number;
  maxLineDiscountAmount?: number;
  allowPriceOverride?: boolean;
  allowTaxOverride?: boolean;
}

export interface PosPolicyDTO {
  companyId: string;
  allowPosDirectSales: boolean;
  cashierRolePolicies: PosCashierRolePolicyDTO[];
}

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
  defaultRevenueAccountId?: string;
  receiptPrefix: string;
  receiptNextSeq: number;
  cashRounding: PosCashRounding;
  allowPosDirectSales: boolean;
  allowCreditSales: boolean;
  creditSaleManagerOverride: boolean;
  negativeStockPolicy: PosNegativeStockPolicy;
  paymentMethods: PosPaymentMethodDTO[];
}

export type SellingBelowCostMode = 'BLOCK' | 'REQUIRE_APPROVAL' | 'ALLOW';

/** Shared company-wide selling policy (below-cost / minimum-margin). Same store as Sales. */
export interface SellingPolicyDTO {
  companyId: string;
  belowCostMode: SellingBelowCostMode;
  minMarginPercent?: number;
  allowManagerOverride: boolean;
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
  keyboardShortcuts?: Record<string, string>;
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

export interface PosManagerOverrideDTO {
  managerOverrideId: string;
  approvedAt: string;
  action: PosManagerOverrideAction;
  managerUserId: string;
  managerName?: string;
  reason: string;
}

export interface PosLayoutDTO {
  id: string;
  companyId: string;
  name: string;
  scopeType: PosLayoutScopeType;
  scopeId?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PosProductShortcutNodeDTO {
  id: string;
  companyId: string;
  layoutId: string;
  parentId?: string | null;
  nodeType: PosProductShortcutNodeType;
  label: string;
  secondaryLabel?: string | null;
  itemId?: string | null;
  variantId?: string | null;
  unitId?: string | null;
  predefinedQty?: number | null;
  sortOrder: number;
  isActive: boolean;
  color?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  item?: any | null;
  children?: PosProductShortcutNodeDTO[];
}

export interface PosControlButtonDTO {
  id: string;
  companyId: string;
  layoutId: string;
  zone: PosControlButtonZone;
  commandCode: PosCommandCode;
  label: string;
  secondaryLabel?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
  requiredPermission?: string | null;
}

export interface PosCommandDefinitionDTO {
  code: PosCommandCode;
  defaultLabel: string;
  defaultIcon?: string;
  requiredPermission?: string;
  requiresActiveRegister?: boolean;
  requiresActiveShift?: boolean;
  requiresActiveCart?: boolean;
  executionMode: 'FRONTEND_UI' | 'BACKEND_COMMAND';
}

export interface PosRuntimeLayoutDTO {
  productShortcutLayout: Pick<PosLayoutDTO, 'id' | 'name' | 'scopeType' | 'scopeId'> | null;
  productShortcutTree: PosProductShortcutNodeDTO[];
  controlButtonLayout: Pick<PosLayoutDTO, 'id' | 'name' | 'scopeType' | 'scopeId'> | null;
  controlButtonsByZone: Record<PosControlButtonZone, PosControlButtonDTO[]>;
}

export interface PosReceiptPrintPayloadDTO {
  receipt: any;
  payments: any[];
  printTemplate?: {
    id?: string;
    name: string;
    documentType: 'POS_RECEIPT';
    isDefault: boolean;
    source: 'SAVED_TEMPLATE' | 'GENERATED_DEFAULT';
    layout: any;
  };
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

  getPolicy: async (): Promise<PosPolicyDTO> =>
    ok(client.get('/tenant/pos/policy')),

  updatePolicy: async (payload: Partial<PosPolicyDTO>): Promise<PosPolicyDTO> =>
    ok(client.put('/tenant/pos/policy', payload)),

  // Typed Controls (Task 267-E): POS-only doorway to the engine-owned typed
  // PolicyConfig. Backend returns ONLY module:'pos' rules and force-stamps the
  // 'pos' tag on PUT. Unscoped TENANT/company-wide rules never appear here.
  getPolicies: async (): Promise<PolicyConfigDTO> =>
    ok(client.get('/tenant/pos/policies')),

  updatePolicies: async (payload: { rules: PolicyRule[] }): Promise<PolicyConfigDTO> =>
    ok(client.put('/tenant/pos/policies', payload)),

  // Shared company-wide selling policy (below-cost / margin). POS reads/writes the
  // same store as Sales; this is POS's own independent doorway to it.
  getSellingPolicy: async (): Promise<SellingPolicyDTO> =>
    ok(client.get('/tenant/pos/selling-policy')),

  updateSellingPolicy: async (payload: Partial<SellingPolicyDTO>): Promise<SellingPolicyDTO> =>
    ok(client.put('/tenant/pos/selling-policy', payload)),

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

  getRuntimeLayout: async (params: { branchId?: string; registerId?: string }): Promise<PosRuntimeLayoutDTO> =>
    ok(client.get('/tenant/pos/layout/runtime', { params })),

  listCommands: async (): Promise<PosCommandDefinitionDTO[]> =>
    ok(client.get('/tenant/pos/commands')),

  executeCommand: async (payload: { commandCode: PosCommandCode; context: Record<string, unknown> }): Promise<any> =>
    ok(client.post('/tenant/pos/commands/execute', payload)),

  listProductShortcutLayouts: async (): Promise<PosLayoutDTO[]> =>
    ok(client.get('/tenant/pos/product-shortcut-layouts')),

  createProductShortcutLayout: async (payload: Partial<PosLayoutDTO>): Promise<PosLayoutDTO> =>
    ok(client.post('/tenant/pos/product-shortcut-layouts', payload)),

  updateProductShortcutLayout: async (id: string, payload: Partial<PosLayoutDTO>): Promise<PosLayoutDTO> =>
    ok(client.patch(`/tenant/pos/product-shortcut-layouts/${encodeURIComponent(id)}`, payload)),

  deleteProductShortcutLayout: async (id: string): Promise<void> =>
    ok(client.delete(`/tenant/pos/product-shortcut-layouts/${encodeURIComponent(id)}`)),

  listProductShortcutNodes: async (layoutId: string): Promise<PosProductShortcutNodeDTO[]> =>
    ok(client.get(`/tenant/pos/product-shortcut-layouts/${encodeURIComponent(layoutId)}/nodes`)),

  createProductShortcutNode: async (layoutId: string, payload: Partial<PosProductShortcutNodeDTO>): Promise<PosProductShortcutNodeDTO> =>
    ok(client.post(`/tenant/pos/product-shortcut-layouts/${encodeURIComponent(layoutId)}/nodes`, payload)),

  updateProductShortcutNode: async (id: string, payload: Partial<PosProductShortcutNodeDTO>): Promise<PosProductShortcutNodeDTO> =>
    ok(client.patch(`/tenant/pos/product-shortcut-nodes/${encodeURIComponent(id)}`, payload)),

  deleteProductShortcutNode: async (id: string): Promise<void> =>
    ok(client.delete(`/tenant/pos/product-shortcut-nodes/${encodeURIComponent(id)}`)),

  listControlButtonLayouts: async (): Promise<PosLayoutDTO[]> =>
    ok(client.get('/tenant/pos/control-button-layouts')),

  createControlButtonLayout: async (payload: Partial<PosLayoutDTO>): Promise<PosLayoutDTO> =>
    ok(client.post('/tenant/pos/control-button-layouts', payload)),

  updateControlButtonLayout: async (id: string, payload: Partial<PosLayoutDTO>): Promise<PosLayoutDTO> =>
    ok(client.patch(`/tenant/pos/control-button-layouts/${encodeURIComponent(id)}`, payload)),

  deleteControlButtonLayout: async (id: string): Promise<void> =>
    ok(client.delete(`/tenant/pos/control-button-layouts/${encodeURIComponent(id)}`)),

  listControlButtons: async (layoutId: string): Promise<PosControlButtonDTO[]> =>
    ok(client.get(`/tenant/pos/control-button-layouts/${encodeURIComponent(layoutId)}/buttons`)),

  createControlButton: async (layoutId: string, payload: Partial<PosControlButtonDTO>): Promise<PosControlButtonDTO> =>
    ok(client.post(`/tenant/pos/control-button-layouts/${encodeURIComponent(layoutId)}/buttons`, payload)),

  updateControlButton: async (id: string, payload: Partial<PosControlButtonDTO>): Promise<PosControlButtonDTO> =>
    ok(client.patch(`/tenant/pos/control-buttons/${encodeURIComponent(id)}`, payload)),

  deleteControlButton: async (id: string): Promise<void> =>
    ok(client.delete(`/tenant/pos/control-buttons/${encodeURIComponent(id)}`)),

  searchProducts: async (q: string, limit = 25): Promise<{ items: any[] }> =>
    ok(client.get('/tenant/pos/products/search', { params: { q, limit } })),

  /** Calculation-only quote (tax-inclusive) for the cashier screen. Does not persist. */
  previewSale: async (lines: Array<{ itemId: string; qty: number; unitPrice: number; discountType?: 'PERCENT' | 'AMOUNT'; discountValue?: number; taxCodeId?: string; manualTaxAmount?: number }>):
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
      lineDiscount?: number;
      taxCodeId?: string;
      manualTaxAmount?: number;
      priceOverride?: boolean;
      taxOverride?: boolean;
      status?: 'ACTIVE' | 'VOIDED';
      voidedBy?: string;
      voidedAt?: string;
      voidReason?: string;
      managerOverrideId?: string;
    }>;
    payments: Array<{ method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM'; amount: number; reference?: string }>;
    notes?: string;
    isCreditSale?: boolean;
    managerOverrideId?: string;
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

  getReceipt: async (id: string): Promise<PosReceiptPrintPayloadDTO> =>
    ok(client.get(`/tenant/pos/receipts/${encodeURIComponent(id)}`)),

  printReceipt: async (id: string): Promise<PosReceiptPrintPayloadDTO> =>
    ok(client.get(`/tenant/pos/receipts/${encodeURIComponent(id)}/print`)),

  reprintReceipt: async (id: string, params?: { managerOverrideId?: string; reason?: string }): Promise<PosReceiptPrintPayloadDTO> =>
    ok(client.get(`/tenant/pos/receipts/${encodeURIComponent(id)}/reprint`, { params: params || {} })),

  createManagerOverride: async (payload: {
    action: PosManagerOverrideAction;
    managerUserId: string;
    managerName?: string;
    reason: string;
    context?: Record<string, unknown>;
  }): Promise<PosManagerOverrideDTO> =>
    ok(client.post('/tenant/pos/manager-overrides', payload)),

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

  getCancelledReceiptsReport: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/cancelled-receipts', { params: params || {} })),

  getTopSellingItemsReport: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/top-selling-items', { params: params || {} })),

  getOverrideAuditReport: async (params?: { dateFrom?: string; dateTo?: string; registerId?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/override-audit', { params: params || {} })),

  getReprintAuditReport: async (params?: { dateFrom?: string; dateTo?: string; limit?: number }): Promise<any[]> =>
    ok(client.get('/tenant/pos/reports/reprint-audit', { params: params || {} })),
};

export default posApi;
