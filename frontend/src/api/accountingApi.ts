
/**
 * accountingApi.ts
 */
import { httpClient } from './httpClient';
import { VoucherListFilters, VoucherListResponse, VoucherListItem } from '../types/accounting/VoucherListTypes';

// Re-export types for convenience
export type { VoucherListItem };

// Types matching Backend DTOs for single item (detail view might differ slightly from list view)
export interface VoucherDetailDTO extends VoucherListItem {
  lines?: any[];
}

export const accountingApi = {
  
  listVouchers: async (filters: VoucherListFilters): Promise<VoucherListResponse> => {
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

    return httpClient<VoucherListResponse>(`/accounting/vouchers?${params.toString()}`);
  },

  getVoucher: async (id: string) => {
    return httpClient<VoucherDetailDTO>(`/accounting/vouchers/${id}`);
  },

  createVoucher: async (payload: any) => {
    return httpClient<VoucherDetailDTO>('/accounting/vouchers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateVoucher: async (id: string, payload: any) => {
    return httpClient<{success: boolean}>(`/accounting/vouchers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // --- WORKFLOW ACTIONS ---

  sendVoucherToApproval: async (id: string) => {
    return httpClient<VoucherDetailDTO>(`/accounting/vouchers/${id}/send-to-approval`, {
      method: 'POST'
    });
  },

  approveVoucher: async (id: string) => {
    return httpClient<VoucherDetailDTO>(`/accounting/vouchers/${id}/approve`, {
      method: 'POST'
    });
  },

  lockVoucher: async (id: string) => {
    return httpClient<VoucherDetailDTO>(`/accounting/vouchers/${id}/lock`, {
      method: 'POST'
    });
  },

  cancelVoucher: async (id: string) => {
    return httpClient<VoucherDetailDTO>(`/accounting/vouchers/${id}/cancel`, {
      method: 'POST'
    });
  }
};
