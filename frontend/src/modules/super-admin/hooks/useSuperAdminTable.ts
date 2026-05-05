import { useState, useMemo } from 'react';
import { SortDirection } from '../components/SuperAdminPage';

export interface SortConfig<T> {
  field: keyof T | string;
  direction: SortDirection;
}

export interface UseSuperAdminTableOptions<T> {
  data: T[];
  initialSort?: SortConfig<T>;
  searchFields?: (keyof T | string)[];
}

export function useSuperAdminTable<T>({
  data,
  initialSort = { field: '', direction: null },
  searchFields = [],
}: UseSuperAdminTableOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(initialSort);

  const handleSort = (field: keyof T | string) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        if (prev.direction === 'asc') return { field, direction: 'desc' };
        if (prev.direction === 'desc') return { field: '', direction: null };
      }
      return { field, direction: 'asc' };
    });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Search filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        return searchFields.some((field) => {
          const value = getNestedValue(item, field as string);
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }

    // Sorting
    if (sortConfig.field && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.field as string);
        const bValue = getNestedValue(b, sortConfig.field as string);

        if (aValue === bValue) return 0;
        
        const comparison = aValue > bValue ? 1 : -1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchQuery, sortConfig, searchFields]);

  return {
    data: filteredAndSortedData,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  };
}

function getNestedValue(obj: any, path: string) {
  if (!path) return '';
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}
