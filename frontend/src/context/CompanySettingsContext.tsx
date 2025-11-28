
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { companyApi, CompanySettings } from '../api/companyApi';

interface CompanySettingsContextType {
  settings: CompanySettings | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSettings: (partial: Partial<CompanySettings>) => Promise<void>;
}

export const CompanySettingsContext = createContext<CompanySettingsContextType | undefined>(undefined);

export const CompanySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await companyApi.getSettings();
      setSettings(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load company settings', err);
      // Fallback for demo if API fails
      setSettings({ companyId: 'cmp_123', strictApprovalMode: true });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = async (partial: Partial<CompanySettings>) => {
    await companyApi.updateSettings(partial);
    await refresh();
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CompanySettingsContext.Provider value={{ settings, isLoading, error, refresh, updateSettings }}>
      {children}
    </CompanySettingsContext.Provider>
  );
};
