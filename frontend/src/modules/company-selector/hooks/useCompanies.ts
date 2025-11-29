import { useEffect, useState, useCallback } from 'react';
import { companySelectorApi, UserCompany } from '../api';

export const useCompanies = () => {
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await companySelectorApi.getUserCompanies();
      setCompanies(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load companies');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { companies, loading, error, refresh };
};
