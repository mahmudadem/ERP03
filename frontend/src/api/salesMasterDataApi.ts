import client from './client';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface PriceListLineDTO {
  itemId: string;
  minQty: number;
  unitPrice: number;
  discountPct?: number;
  comment?: string;
}

export interface PriceListDTO {
  id: string;
  companyId: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  validFrom: string | null;
  validTo: string | null;
  isDefault: boolean;
  lines: PriceListLineDTO[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerGroupDTO {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  defaultPriceListId: string | null;
  defaultPaymentTermsDays: number | null;
  defaultCreditLimit: number | null;
  taxExempt: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalespersonDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  email?: string;
  defaultCommissionPct: number;
  commissionPayableAccountId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionEntryDTO {
  id: string;
  companyId: string;
  salespersonId: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  baseAmount: number;
  commissionPct: number;
  commissionAmountBase: number;
  currency: string;
  status: 'ACCRUED' | 'PAID' | 'CANCELLED';
  accruedAt: string;
  paidAt: string | null;
  paymentReference: string | null;
  notes: string | null;
}

export interface CommissionTotalsDTO {
  salespersonId: string;
  accrued: number;
  paid: number;
  cancelled: number;
  currency?: string;
}

export interface EffectivePriceDTO {
  itemId: string;
  customerId: string;
  qty: number;
  unitPrice: number;
  discountPct?: number;
  currency: string;
  priceListId?: string;
  priceListName?: string;
}

// ─── unwrap helper (same pattern as other api files) ─────────────────────────

const unwrap = <T>(payload: any): T => (payload?.data ?? payload) as T;

// ─── API Object ──────────────────────────────────────────────────────────────

export const salesMasterDataApi = {
  // Price Lists
  listPriceLists: (opts?: { status?: string; limit?: number; offset?: number }): Promise<PriceListDTO[]> =>
    client.get('/tenant/sales/price-lists', { params: opts }).then(unwrap<PriceListDTO[]>),

  getPriceList: (id: string): Promise<PriceListDTO> =>
    client.get(`/tenant/sales/price-lists/${id}`).then(unwrap<PriceListDTO>),

  createPriceList: (body: Partial<PriceListDTO>): Promise<PriceListDTO> =>
    client.post('/tenant/sales/price-lists', body).then(unwrap<PriceListDTO>),

  updatePriceList: (id: string, body: Partial<PriceListDTO>): Promise<PriceListDTO> =>
    client.put(`/tenant/sales/price-lists/${id}`, body).then(unwrap<PriceListDTO>),

  deletePriceList: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/sales/price-lists/${id}`).then(unwrap<{ success: boolean }>),

  getEffectivePrice: (params: { customerId: string; itemId: string; qty: number; asOfDate?: string }): Promise<EffectivePriceDTO> =>
    client.get('/tenant/sales/price-lists/effective-price', { params }).then(unwrap<EffectivePriceDTO>),

  // Customer Groups
  listCustomerGroups: (opts?: { status?: string; limit?: number; offset?: number }): Promise<CustomerGroupDTO[]> =>
    client.get('/tenant/sales/customer-groups', { params: opts }).then(unwrap<CustomerGroupDTO[]>),

  getCustomerGroup: (id: string): Promise<CustomerGroupDTO> =>
    client.get(`/tenant/sales/customer-groups/${id}`).then(unwrap<CustomerGroupDTO>),

  createCustomerGroup: (body: Partial<CustomerGroupDTO>): Promise<CustomerGroupDTO> =>
    client.post('/tenant/sales/customer-groups', body).then(unwrap<CustomerGroupDTO>),

  updateCustomerGroup: (id: string, body: Partial<CustomerGroupDTO>): Promise<CustomerGroupDTO> =>
    client.put(`/tenant/sales/customer-groups/${id}`, body).then(unwrap<CustomerGroupDTO>),

  deleteCustomerGroup: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/sales/customer-groups/${id}`).then(unwrap<{ success: boolean }>),

  assignCustomerToGroup: (body: { customerId: string; customerGroupId: string }): Promise<{ success: boolean }> =>
    client.post('/tenant/sales/customer-groups/assign', body).then(unwrap<{ success: boolean }>),

  // Salespersons
  listSalespersons: (opts?: { status?: string; limit?: number; offset?: number }): Promise<SalespersonDTO[]> =>
    client.get('/tenant/sales/salespersons', { params: opts }).then(unwrap<SalespersonDTO[]>),

  getSalesperson: (id: string): Promise<SalespersonDTO> =>
    client.get(`/tenant/sales/salespersons/${id}`).then(unwrap<SalespersonDTO>),

  createSalesperson: (body: Partial<SalespersonDTO>): Promise<SalespersonDTO> =>
    client.post('/tenant/sales/salespersons', body).then(unwrap<SalespersonDTO>),

  updateSalesperson: (id: string, body: Partial<SalespersonDTO>): Promise<SalespersonDTO> =>
    client.put(`/tenant/sales/salespersons/${id}`, body).then(unwrap<SalespersonDTO>),

  deleteSalesperson: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/sales/salespersons/${id}`).then(unwrap<{ success: boolean }>),

  // Commissions
  listCommissions: (opts?: {
    salespersonId?: string;
    status?: string;
    sourceId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<CommissionEntryDTO[]> =>
    client.get('/tenant/sales/commissions', { params: opts }).then(unwrap<CommissionEntryDTO[]>),

  getCommission: (id: string): Promise<CommissionEntryDTO> =>
    client.get(`/tenant/sales/commissions/${id}`).then(unwrap<CommissionEntryDTO>),

  getSalespersonCommissionTotals: (salespersonId: string): Promise<CommissionTotalsDTO> =>
    client.get(`/tenant/sales/commissions/totals/${salespersonId}`).then(unwrap<CommissionTotalsDTO>),

  markCommissionPaid: (id: string, body?: { paymentReference?: string; notes?: string }): Promise<CommissionEntryDTO> =>
    client.post(`/tenant/sales/commissions/${id}/mark-paid`, body ?? {}).then(unwrap<CommissionEntryDTO>),

  cancelCommission: (id: string): Promise<CommissionEntryDTO> =>
    client.post(`/tenant/sales/commissions/${id}/cancel`, {}).then(unwrap<CommissionEntryDTO>),
};
