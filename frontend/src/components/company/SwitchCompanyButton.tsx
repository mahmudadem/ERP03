import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useCompanyAccess } from '../../context/CompanyAccessContext';

interface UserCompany {
  id: string;
  name: string;
}

export const SwitchCompanyButton: React.FC = () => {
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();
  const [companies, setCompanies] = useState<UserCompany[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const mod = await import('../../modules/company-selector/api');
        const resp = await mod.companySelectorApi.getUserCompanies();
        const list = Array.isArray((resp as any)?.data) ? (resp as any).data : resp;
        setCompanies(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load companies', err);
      }
    };
    load();
  }, []);

  if (companies.length <= 1) return null;

  const current = companies.find((c) => c.id === companyId);
  const label = current ? current.name : 'Switch Company';

  return (
    <Button variant="ghost" size="sm" onClick={() => navigate('/company-selector')}>
      <span className="mr-2">🏢</span>
      <span className="truncate max-w-[140px]">{label}</span>
    </Button>
  );
};
