import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus } from 'lucide-react'; // Added Plus for consistency if needed
import { useCompanies } from './hooks/useCompanies';
import { CompanyCard } from './CompanyCard';
import { NewCompanyCard } from './NewCompanyCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useAuth } from '../../hooks/useAuth';
import { errorHandler } from '../../services/errorHandler';

const CompanySelectorPage: React.FC = () => {
  const { companies, loading, error, refresh } = useCompanies();
  const navigate = useNavigate();
  const { switchCompany } = useCompanyAccess();
  const { setUiMode } = useUserPreferences();
  const { logout } = useAuth();

  const handleEnter = async (companyId: string) => {
    try {
      await switchCompany(companyId);
      // Force classic mode so the main router outlet renders instead of window manager
      setUiMode('classic');
      // Hard reload to ensure all contexts pick up the new active company
      window.location.href = '/#/';
    } catch (err: any) {
      errorHandler.showError(err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (err: any) {
      console.error('Logout failed:', err);
      // Force navigation anyway
      navigate('/auth');
    }
  };

  const renderContent = () => {
    if (loading && companies.length === 0) {
      return (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (error) {
      return (
        <Card className="p-6 space-y-4 text-center max-w-md mx-auto">
          <div className="text-red-500 font-medium">Unable to load companies</div>
          <p className="text-sm text-gray-500">{error}</p>
          <Button variant="secondary" onClick={refresh}>Try Again</Button>
        </Card>
      );
    }

    if (companies.length === 0) {
      return (
        <Card className="p-12 text-center space-y-4 max-w-lg mx-auto bg-gray-50 border-dashed border-2 border-gray-200">
          <div className="mx-auto bg-white p-3 rounded-full w-fit shadow-sm">
             <Plus size={32} className="text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Welcome to ERP System</h2>
          <p className="text-gray-600">You don't have any companies yet. Create your first one to get started.</p>
          <Button onClick={() => navigate('/company-wizard')} className="mt-4">
            Create New Company
          </Button>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <CompanyCard key={company.id} company={company} onEnter={handleEnter} />
        ))}
        {/* Helper card to create new company easy access */}
        <NewCompanyCard /> 
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      {/* Header - Always Visible */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Your Companies</h1>
          <p className="text-gray-500 mt-1">Select a workspace to continue</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
             <Button variant="ghost" onClick={refresh} className="text-gray-500 hover:text-gray-900">
               Refresh
             </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleLogout} 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
};

export default CompanySelectorPage;
