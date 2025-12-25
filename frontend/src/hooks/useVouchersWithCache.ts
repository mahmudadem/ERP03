import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { accountingApi } from '../api/accountingApi';
import { VoucherListItem } from '../types/accounting/VoucherListTypes';

export interface DateRange {
  from: string; // ISO date string
  to: string;
}

export interface VoucherFilters {
  formId?: string;
  type?: string;
  status?: string;
  search?: string;
}

// Default: last 12 months (expanded for debugging)
export const getDefaultDateRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 12); // Changed from 3 to 12 months
  
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
};

export const useVouchersWithCache = (companyId: string) => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [filters, setFilters] = useState<VoucherFilters>({});

  const {
    data: vouchersResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['vouchers-debug', companyId], // Changed key to force fresh fetch
    queryFn: async () => {
      // Fetch vouchers with date range filtering
      return accountingApi.listVouchers({
        // from: dateRange.from,  // COMMENTED OUT
        // to: dateRange.to,      // COMMENTED OUT
        page: 1,
        pageSize: 10000,
      });
    },
    enabled: !!companyId,
    staleTime: 0, // Force fresh fetch every time
    gcTime: 0, // Don't cache (React Query v5)
  });
  
  // Response IS the array directly, not wrapped in { items: [...] }
  const allVouchers: VoucherListItem[] = Array.isArray(vouchersResponse) 
    ? vouchersResponse 
    : (vouchersResponse as any)?.data || [];

  // Filter client-side (INSTANT, NO API CALL)
  const filteredVouchers = useMemo(() => {
    
    let result = allVouchers;

    if (filters.formId) {
      
      
      result = result.filter((v) => v.formId === filters.formId);
      
      
    }

    if (filters.type) {
      
      // Case-insensitive comparison
      result = result.filter((v) => v.type?.toLowerCase() === filters.type?.toLowerCase());
      
    }

    if (filters.status) {
      result = result.filter((v) => v.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (v: VoucherListItem) =>
          v.voucherNo?.toLowerCase().includes(searchLower) ||
          v.reference?.toLowerCase().includes(searchLower)
      );
    }

    
    return result;
  }, [allVouchers, filters]);

  // Invalidate cache when vouchers are created/updated/deleted
  const invalidateVouchers = () => {
    
    queryClient.invalidateQueries({ queryKey: ['vouchers-debug', companyId] });
  };

  return {
    vouchers: filteredVouchers,
    allVouchers, // Raw unfiltered data
    isLoading,
    error,
    dateRange,
    setDateRange,
    filters,
    setFilters,
    refetch,
    invalidateVouchers,
  };
};
