/**
 * CompaniesListPage.tsx
 * 
 * Purpose: Shows user's companies and allows creating new ones.
 * Uses new UI design with logic from original CompanySelectorPage.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, ExternalLink, MoreVertical, Loader2, RefreshCw } from 'lucide-react';
import { useCompanies } from '../../company-selector/hooks/useCompanies';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useAuth } from '../../../context/AuthContext';

const CompaniesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companies, loading, error, refresh } = useCompanies();
  const { switchCompany } = useCompanyAccess();
  const { setUiMode } = useUserPreferences();

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

  const handleCreateClick = () => {
    navigate('/company-wizard');
  };

  if (loading && companies.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary-500/10 p-2 rounded-lg">
                <Building2 className="h-6 w-6 text-primary-500" />
            </div>
            <span className="font-bold text-xl text-slate-900">ERP03</span>
          </div>
          <div className="flex items-center gap-4">
             <button 
               onClick={refresh}
               className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
               title="Refresh"
             >
               <RefreshCw className="h-5 w-5" />
             </button>
             <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-medium">
               {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Companies</h1>
            <p className="text-slate-500 mt-1">Choose a company to enter or create a new one.</p>
          </div>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Company
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={refresh} className="text-red-600 hover:text-red-800 font-medium text-sm">
              Retry
            </button>
          </div>
        )}

        {companies.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-24 text-center">
             <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                <Building2 className="h-10 w-10 text-slate-400" />
             </div>
             <h3 className="mt-4 text-lg font-semibold text-slate-900">No companies yet</h3>
             <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
               Get started by creating your first company workspace to access ERP modules.
             </p>
             <button
                onClick={handleCreateClick}
                className="mt-6 inline-flex items-center justify-center rounded-md text-primary-500 hover:bg-primary-500/5 px-4 py-2 text-sm font-medium transition-colors"
              >
               Create your first company →
             </button>
          </div>
        ) : (
          /* Companies Grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <div 
                key={company.id}
                onClick={() => handleEnter(company.id)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-500/50 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 border flex items-center justify-center overflow-hidden">
                      <span className="text-lg font-bold text-slate-400">{company.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-primary-500 transition-colors">
                        {company.name}
                      </h3>
                      <p className="text-xs text-slate-500">{company.model || 'Business'}</p>
                    </div>
                  </div>
                  <button 
                    className="text-slate-400 hover:text-slate-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm">
                   <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2 py-1 rounded">
                      <span className="font-medium capitalize">{company.role || 'Member'}</span>
                   </div>
                   <div className="flex items-center gap-1 text-primary-500 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Dashboard <ExternalLink className="h-3 w-3" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CompaniesListPage;
