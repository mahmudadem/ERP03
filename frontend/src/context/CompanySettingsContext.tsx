
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
    
    // OPTIMISTIC UPDATE: Apply changes to local state immediately
    // This ensures UI buttons (e.g. VoucherWindow) update instantly without waiting for network
    setSettings(prev => prev ? { ...prev, ...partial } : null);
    
    try {
      await companyApi.updateSettings(companyId, partial);
    } catch (err) {
      // Revert or re-fetch on error
      console.error('Failed to update settings, reverting...', err);
      // We rely on refresh() to restore truth if available, or error handling
    } finally {
      // Always fetch fresh truth from server to ensure consistency
      await refresh();
      
      // BROADCAST: Notify other tabs that settings have changed
      try {
        const bc = new BroadcastChannel('erp_company_settings_sync');
        bc.postMessage({ type: 'SETTINGS_UPDATED', companyId });
        bc.close(); // Clean up immediate channel
      } catch (e) {
        console.warn('[CompanySettingsContext] Broadcast failed', e);
      }
    }
  };

  useEffect(() => {
    // LISTEN: For settings updates from other tabs
    const bc = new BroadcastChannel('erp_company_settings_sync');
    bc.onmessage = (event) => {
      if (event.data?.type === 'SETTINGS_UPDATED' && event.data?.companyId === companyId) {
        console.debug('[CompanySettingsContext] Received sync signal, refreshing...');
        refresh();
      }
    };

    return () => bc.close();
  }, [companyId, refresh]);

  useEffect(() => {
    console.debug('[CompanySettingsContext] useEffect calling refresh', { authLoading, userUid: user?.uid, companyId });
    refresh();
  }, [refresh, authLoading, user, companyId]);

  return (
    <CompanySettingsContext.Provider value={{ settings, isLoading, error, refresh, updateSettings }}>
      {children}
    </CompanySettingsContext.Provider>
  );
};
