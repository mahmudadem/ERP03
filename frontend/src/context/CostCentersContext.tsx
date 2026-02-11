import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const load = async () => {
    setLoading(true);
    try {
      const data = await accountingApi.listCostCenters();
      setCostCenters(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <CostCentersContext.Provider value={{ costCenters, refresh: load, loading }}>
      {children}
    </CostCentersContext.Provider>
  );
};

export const useCostCenters = () => useContext(CostCentersContext);
