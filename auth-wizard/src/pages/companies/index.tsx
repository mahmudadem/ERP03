import React from 'react';
import { Plus, Building2, ExternalLink, MoreVertical } from 'lucide-react';
import { cn } from '../../../utils';

interface Company {
  id: string;
  name: string;
  country: string;
  modulesCount: number;
  status: 'active' | 'setup';
  logo?: string;
}

// Mock initial data - could be empty []
const INITIAL_COMPANIES: Company[] = [];

interface CompaniesListProps {
  onCreateClick: () => void;
  onCompanyClick: (companyId: string) => void;
  companies: Company[];
}

const CompaniesList: React.FC<CompaniesListProps> = ({ onCreateClick, onCompanyClick, companies = INITIAL_COMPANIES }) => {
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
            </div>
            <span className="font-bold text-xl text-slate-900">ERP03</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-medium">JD</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Companies</h1>
            <p className="text-slate-500 mt-1">Manage your organizations and workspaces.</p>
          </div>
          <button
            onClick={onCreateClick}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Company
          </button>
        </div>

        {companies.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-24 text-center">
             <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                <Building2 className="h-10 w-10 text-slate-400" />
             </div>
             <h3 className="mt-4 text-lg font-semibold text-slate-900">No companies yet</h3>
             <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">Get started by creating your first company workspace to access ERP modules.</p>
             <button
                onClick={onCreateClick}
                className="mt-6 inline-flex items-center justify-center rounded-md text-primary hover:bg-primary/5 px-4 py-2 text-sm font-medium transition-colors"
              >
                Create your first company &rarr;
              </button>
          </div>
        ) : (
          /* Companies Grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <div 
                key={company.id}
                onClick={() => onCompanyClick(company.id)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 border flex items-center justify-center overflow-hidden">
                      {company.logo ? (
                        <img src={company.logo} alt={company.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-slate-400">{company.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-primary transition-colors">{company.name}</h3>
                      <p className="text-xs text-slate-500">{company.country}</p>
                    </div>
                  </div>
                  <button className="text-slate-400 hover:text-slate-600">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm">
                   <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2 py-1 rounded">
                      <span className="font-medium">{company.modulesCount}</span> Modules
                   </div>
                   <div className="flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
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

export default CompaniesList;