import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanies } from './hooks/useCompanies';
import { CompanyCard } from './CompanyCard';
import { NewCompanyCard } from './NewCompanyCard';
import { companySelectorApi } from './api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { useUserPreferences } from '../../hooks/useUserPreferences';

const CompanySelectorPage: React.FC = () => {
  const { companies, loading, error, refresh } = useCompanies();
  const navigate = useNavigate();
  const { switchCompany, companyId, loading: companyAccessLoading } = useCompanyAccess();
  const { setUiMode } = useUserPreferences();

  // If a company is already active, redirect out of the selector
  React.useEffect(() => {
    if (!companyAccessLoading && companyId) {
      navigate('/');
    }
  }, [companyAccessLoading, companyId, navigate]);

  const handleEnter = async (companyId: string) => {
    try {
      await switchCompany(companyId);
      // Force classic mode so the main router outlet renders instead of window manager
      setUiMode('classic');
      // Hard reload to ensure all contexts pick up the new active company
      window.location.href = '/#/';
    } catch (err: any) {
      window.alert(err?.message || 'Failed to switch company');
    }
  };

  if (loading && companies.length === 0) {
    return <Card className="p-6 text-gray-500">Loading your companies...</Card>;
  }

  if (error) {
    return (
      <Card className="p-6 space-y-3">
        <p className="text-red-600 text-sm">{error}</p>
        <Button variant="secondary" onClick={refresh}>Retry</Button>
      </Card>
    );
  }

  if (companies.length === 0) {
    return (
      <Card className="p-6 space-y-3">
        <h1 className="text-xl font-bold text-gray-800">No companies yet</h1>
        <p className="text-sm text-gray-600">Create your first company to get started.</p>
        <Button onClick={() => navigate('/company-wizard')}>Create your first company</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Companies</h1>
          <p className="text-sm text-gray-600">Choose a company to enter or create a new one.</p>
        </div>
        <Button variant="secondary" onClick={refresh}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((company) => (
          <CompanyCard key={company.id} company={company} onEnter={handleEnter} />
        ))}
        <NewCompanyCard />
      </div>
    </div>
  );
};

export default CompanySelectorPage;
