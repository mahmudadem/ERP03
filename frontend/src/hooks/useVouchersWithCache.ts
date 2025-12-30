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
    queryKey: ['vouchers', companyId], 
    queryFn: async () => {
      return accountingApi.listVouchers({
        page: 1,
        pageSize: 1000, // Reduced from 10000 for better performance
      });
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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
    
    queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] });
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
