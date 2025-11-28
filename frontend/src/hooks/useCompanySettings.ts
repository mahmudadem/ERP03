
import { useContext } from 'react';
import { CompanySettingsContext } from '../context/CompanySettingsContext';

export const useCompanySettings = () => {
  const context = useContext(CompanySettingsContext);
  if (context === undefined) {
    throw new Error('useCompanySettings must be used within a CompanySettingsProvider');
  }
  return context;
};
