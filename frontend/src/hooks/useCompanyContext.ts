
import { useState } from 'react';

// Mock company context for MVP
export const useCompanyContext = () => {
  const [company] = useState({
    id: 'cmp_123',
    name: 'TechFlow Solutions',
    baseCurrency: 'USD',
    fiscalYearStart: new Date('2024-01-01'),
  });

  return {
    company,
    activeCompanyModules: [] as string[],
    isAuthenticated: true, // Mock auth status
  };
};
