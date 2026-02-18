import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { accountingApi } from '../api/accountingApi';
import { VoucherListItem, VoucherListResponse } from '../types/accounting/VoucherListTypes';
import { useCompanyAccess } from '../context/CompanyAccessContext';

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

// Default: 2000-01-01 to Today
export const getDefaultDateRange = (fiscalYearStart?: string): DateRange => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const toStr = `${year}-${month}-${day}`;
  
  // Use fiscal year start if provided, otherwise default to 2000-01-01
  let fromStr = '2000-01-01';
  if (fiscalYearStart) {
    try {
      const fyDate = new Date(fiscalYearStart);
      if (!isNaN(fyDate.getTime())) {
        fromStr = fiscalYearStart.split('T')[0];
      }
    } catch {
      // Keep default
    }
  }
  
  return {
    from: fromStr,
    to: toStr,
  };
};

export const useVouchersWithCache = (companyId: string) => {
  const queryClient = useQueryClient();
  const { company } = useCompanyAccess();
  
  // Initialize with fiscalYearStart if available, otherwise default
  const [dateRange, setDateRange] = useState<DateRange>(() => 
    getDefaultDateRange(company?.fiscalYearStart)
  );
  
  // Sync default date range if company data loads later
  useEffect(() => {
    if (company?.fiscalYearStart) {
      setDateRange(prev => {
        if (prev.from === '2000-01-01') {
           return getDefaultDateRange(company.fiscalYearStart);
        }
        return prev;
      });
    }
  }, [company?.fiscalYearStart]);

  // Filters (Server-Side)
  const [filters, setFilters] = useState<VoucherFilters>({});
  
  // View State (Pagination)
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100); // Fixed batch size

  // Sync view to Page 1 when search criteria changes
  useEffect(() => {
    setPage(1);
  }, [filters, dateRange]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['vouchers', companyId, dateRange, filters], // Includes filters -> distinct cache per search
    queryFn: async ({ pageParam = 1 }) => {
      const from = dateRange.from ? dateRange.from.split('T')[0] : '2000-01-01';
      const to = dateRange.to ? dateRange.to.split('T')[0] : '2099-12-31';

      // Perform SERVER-SIDE filtering:
      // We pass the filter criteria to the API so we only get relevant matches.
      return accountingApi.listVouchers({
        from,
        to,
        page: pageParam as number,
        pageSize: 100,
        ...filters 
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any, allPages) => {
      // 1. Try Typed Pagination Metadata (if backend supports it)
      if (lastPage?.pagination) {
         const { page, totalPages } = lastPage.pagination;
         return page < totalPages ? page + 1 : undefined;
      }

      // 2. Fallback for array-based response
      // Normalize items from potential response shapes
      const items = Array.isArray(lastPage) ? lastPage : (lastPage?.items || lastPage?.data || []);
      
      // If we received a full batch (100 is the hardcoded limit), assume there is more
      if (Array.isArray(items) && items.length === 100) {
           return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!companyId,
    // Stale time allows navigating "Back" without immediate refetch, preserving instant feel
    staleTime: 60 * 1000, 
  });
  
  // Accumulate all loaded pages (these are matches from the specific server search)
  const allLoadedVouchers: VoucherListItem[] = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page: any) => {
        if (page?.items) return page.items;
        if (Array.isArray(page)) return page;
        return page?.data || [];
    });
  }, [data]);

  // Paginated View (Slice 1 Page) to save resources
  // This ensures the DOM only renders 100 items at a time
  const visibleVouchers = useMemo(() => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      // Note: allLoadedVouchers contains Pages 1..N
      // If we seek Page N, it is at index (N-1)*100
      return allLoadedVouchers.slice(start, end);
  }, [allLoadedVouchers, page, pageSize]);

  // Metadata for Paginator
  const loadedPages = data?.pages.length || 1;
  
  const { totalItems, totalPages } = useMemo(() => {
      // 1. Try to get Real Server Totals
      const firstPage = data?.pages?.[0] as any;
      let serverTotal = undefined;
      
      if (firstPage?.pagination?.totalItems !== undefined) {
          serverTotal = firstPage.pagination.totalItems;
      }
      
      // 2. Derive Paginator limits for Sequential Fetching
      // We limit 'totalPages' to 'loaded + 1' to force sequential "Load More" behavior.
      // Even if serverTotal says 50 pages, we only enable the next immediate page.
      const sequentialLimit = loadedPages + (hasNextPage ? 1 : 0);
      
      return {
          totalItems: serverTotal !== undefined ? serverTotal : allLoadedVouchers.length,
          totalPages: sequentialLimit 
      };
  }, [data, allLoadedVouchers.length, loadedPages, hasNextPage]);

  // Handle Page Navigation
  const handleSetPage = (newPage: number) => {
      // If user wants next page and we haven't loaded it -> Fetch
      if (newPage > loadedPages && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
      }
      // Update View immediately (will show loading if fetch needed, or sliced cache if present)
      setPage(newPage);
  };
  
  // Safety: If Page exceeds Loaded (e.g. after fetch error), sync back
  useEffect(() => {
      if (!isLoading && !isFetchingNextPage && page > loadedPages) {
          setPage(loadedPages);
      }
  }, [page, loadedPages, isLoading, isFetchingNextPage]);

  // Invalidate cache when vouchers are created/updated/deleted
  const invalidateVouchers = () => {
    queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] });
    setPage(1); // Reset UI page state
  };

  return {
    vouchers: visibleVouchers, // Only 100 items max (Sliced View)
    allVouchers: allLoadedVouchers, // Access to full loaded set if needed
    isLoading: isLoading || isFetchingNextPage, // Show loading when fetching more
    error,
    dateRange,
    setDateRange,
    filters,
    setFilters,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    setPage: handleSetPage,
    refetch,
    invalidateVouchers,
    isFetchingNextPage
  };
};
