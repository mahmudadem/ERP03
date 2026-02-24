import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { accountingApi, CostCenterDTO } from '../api/accountingApi';

interface CostCentersContextValue {
  costCenters: CostCenterDTO[];
  refresh: () => Promise<void>;
  loading: boolean;
}

const CostCentersContext = createContext<CostCentersContextValue>({
  costCenters: [],
  refresh: async () => {},
  loading: false
});

export const CostCentersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [costCenters, setCostCenters] = useState<CostCenterDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const loadedRef = useRef(false);

  const load = useCallback(async (force = false) => {
    // Only skip fetch if we already successfully loaded AND we actually have items, unless forced.
    if (!force && loadedRef.current && costCenters.length > 0) {
      return;
    }
    
    setLoading(true);
    try {
      const raw = await accountingApi.listCostCenters();
      // Safely normalise: the interceptor may unwrap to array directly,
      // or it could still be wrapped in { data: [...] }
      let list: CostCenterDTO[];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && Array.isArray((raw as any).data)) {
        list = (raw as any).data;
      } else if (raw && typeof raw === 'object') {
        // Last resort – maybe it's an object with numeric keys
        list = Object.values(raw) as CostCenterDTO[];
      } else {
        list = [];
      }
      console.log('[CostCentersContext] Fetched:', list);
      setCostCenters(list);
      loadedRef.current = true;
    } catch (err: any) {
      console.warn('[CostCentersContext] Failed to load cost centers:', err?.message || err);
      // Don't clear existing data on refresh failure
      if (!loadedRef.current) {
        setCostCenters([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      load();
    }
  }, [load]);

  return (
    <CostCentersContext.Provider value={{ costCenters, refresh: load, loading }}>
      {children}
    </CostCentersContext.Provider>
  );
};

export const useCostCenters = () => useContext(CostCentersContext);
