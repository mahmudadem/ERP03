/**
 * useVouchersList.ts
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { accountingApi } from '../api/accountingApi';
import { VoucherListItem, VoucherListFilters } from '../types/accounting/VoucherListTypes';

const DEFAULT_FILTERS: VoucherListFilters = {
  page: 1,
  pageSize: 20,
  sort: 'date_desc'
};

export const useVouchersList = () => {
  const [vouchers, setVouchers] = useState<VoucherListItem[]>([]);
  const [filters, setFiltersState] = useState<VoucherListFilters>(DEFAULT_FILTERS);
  
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Ref to prevent circular updates if we add debouncing logic inside the effect
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchVouchers = useCallback(async (currentFilters: VoucherListFilters) => {
    setIsLoading(true);
    setError(undefined);

    // Cancel previous request if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await accountingApi.listVouchers(currentFilters);
      setVouchers(response.items);
      setPagination(response.pagination);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch vouchers:', err);
      // Fallback for mocked backend if it returns array instead of paginated object
      if (Array.isArray(err)) { 
         setError('Invalid API response format');
      } else {
         setError(err.message || 'Failed to load vouchers.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVouchers(filters);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [filters, fetchVouchers]);

  const setFilters = (partial: Partial<VoucherListFilters>) => {
    setFiltersState(prev => {
      const newState = { ...prev, ...partial };
      // If any filter other than page/pageSize changes, reset to page 1
      const isPaginationChange = 
        Object.keys(partial).length === 1 && 
        (partial.page !== undefined || partial.pageSize !== undefined);
      
      if (!isPaginationChange) {
        newState.page = 1;
      }
      return newState;
    });
  };

  const refresh = () => {
    fetchVouchers(filters);
  };

  return {
    vouchers,
    filters,
    setFilters,
    pagination,
    isLoading,
    error,
    refresh
  };
};