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
  const allVouchers: VoucherListItem[] = useMemo(() => {
    const raw = Array.isArray(vouchersResponse) 
      ? vouchersResponse 
      : (vouchersResponse as any)?.data || [];
    
    // DIAGNOSTIC LOG: See verbatim data from API
    if (raw.length > 0) {
      console.log('RAW_API_LOG: First voucher sample:', raw[0]);
      const reversals = raw.filter((v: any) => v.type === 'REVERSAL' || v.voucherNo?.startsWith('RV-'));
      if (reversals.length > 0) {
        console.log('RAW_API_LOG: Reversal sample:', reversals[0]);
      }
    }
    
    return raw;
  }, [vouchersResponse]);

  // Filter client-side (INSTANT, NO API CALL)
  const filteredVouchers = useMemo(() => {
    // 1. Define match criteria
    const matchesFilters = (v: VoucherListItem) => {
      // If formId is filtered, it must match. 
      // LEGACY SUPPORT: If voucher has no formId, we allow it to pass this check and rely on 'type' match.
      if (filters.formId && v.formId && v.formId !== filters.formId) return false;
      
      if (filters.type) {
        if (v.type?.toLowerCase() !== filters.type?.toLowerCase()) return false;
      }
      
      if (filters.status && v.status !== filters.status) return false;
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          v.voucherNo?.toLowerCase().includes(searchLower) ||
          v.reference?.toLowerCase().includes(searchLower) ||
          v.id.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      return true;
    };

    // 2. Identify "Primary Matches"
    const primaryMatchIds = new Set(allVouchers.filter(matchesFilters).map(v => v.id));

    // 3. Expand result set to include related hierarchy items
    // We want: 
    // - Every primary match
    // - The parent of any primary match (if the match is a reversal)
    // - Any reversal of a primary match (the "history")
    const resultIds = new Set<string>();

    allVouchers.forEach(v => {
      if (primaryMatchIds.has(v.id)) {
        resultIds.add(v.id);
        // If this is a reversal, we MUST include its parent for the table to render it nested
        if (v.reversalOfVoucherId) {
          resultIds.add(v.reversalOfVoucherId);
        }
      }
    });

    // Second pass to catch "children of primary matches"
    allVouchers.forEach(v => {
      if (v.reversalOfVoucherId && primaryMatchIds.has(v.reversalOfVoucherId)) {
        resultIds.add(v.id);
      }
    });

    return allVouchers.filter(v => resultIds.has(v.id));
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
