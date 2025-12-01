
/**
 * accountingApi.ts
 */
import client from './client';
import { VoucherListFilters, VoucherListResponse, VoucherListItem } from '../types/accounting/VoucherListTypes';

// Re-export types for convenience
export type { VoucherListItem };

// Types matching Backend DTOs for single item (detail view might differ slightly from list view)
export interface VoucherDetailDTO extends VoucherListItem {
  lines?: any[];
}

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export const accountingApi = {
  
  listVouchers: (filters: VoucherListFilters): Promise<VoucherListResponse> => {
    // Construct Query String
    const params = new URLSearchParams();
    
    if (filters.type && filters.type !== 'ALL') params.append('type', filters.type);
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.search) params.append('search', filters.search);
    if (filters.sort) params.append('sort', filters.sort);
    
    params.append('page', filters.page.toString());
    params.append('pageSize', filters.pageSize.toString());

    return client.get(`/accounting/vouchers?${params.toString()}`);
  },

  getVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.get(`/accounting/vouchers/${id}`);
  },

  createVoucher: (payload: any): Promise<VoucherDetailDTO> => {
    return client.post('/accounting/vouchers', payload);
  },

  updateVoucher: (id: string, payload: any): Promise<{success: boolean}> => {
    return client.put(`/accounting/vouchers/${id}`, payload);
  },

  // --- WORKFLOW ACTIONS ---

  sendVoucherToApproval: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/accounting/vouchers/${id}/approve`);
  },

  approveVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/accounting/vouchers/${id}/approve`);
  },

  lockVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/accounting/vouchers/${id}/lock`);
  },

  cancelVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/accounting/vouchers/${id}/cancel`);
  },

  // --- REPORTS ---
  getTrialBalance: (): Promise<TrialBalanceLine[]> => {
    return client.get('/accounting/reports/trial-balance');
  }
};

