
import { createContext, useState, useEffect, useCallback } from 'react';
import { companyApi, CompanySettings } from '../api/companyApi';
import { useAuth } from './AuthContext';
import { useCompanyAccess } from './CompanyAccessContext';

interface CompanySettingsContextType {
  settings: CompanySettings | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSettings: (partial: Partial<CompanySettings>) => Promise<void>;
}

export const CompanySettingsContext = createContext<CompanySettingsContextType | undefined>(undefined);

export const CompanySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { companyId } = useCompanyAccess();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authLoading || !user || !companyId) return;
    setIsLoading(true);
    try {
      const data = await companyApi.getSettings(companyId);
      setSettings(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load company settings', err);
      setError('Failed to load company settings');
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, companyId]);

  const updateSettings = async (partial: Partial<CompanySettings>) => {
    if (!companyId) return;
    await companyApi.updateSettings(companyId, partial);
    await refresh();
  };

  useEffect(() => {
    refresh();
  }, [refresh, authLoading, user, companyId]);

  return (
    <CompanySettingsContext.Provider value={{ settings, isLoading, error, refresh, updateSettings }}>
      {children}
    </CompanySettingsContext.Provider>
  );
};
