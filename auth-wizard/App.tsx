import React, { useState } from 'react';
import LandingPage from './src/pages/landing/index';
import ChoosePlan from './src/pages/choose-plan/index';
import CompaniesList from './src/pages/companies/index';
import CompanyDashboard from './src/pages/company-dashboard/index';
import CompanyWizard from './components/company-wizard/index';

// Application Flow States
type AppView = 'LANDING' | 'PLAN_SELECTION' | 'COMPANIES_LIST' | 'CREATE_COMPANY_WIZARD' | 'COMPANY_DASHBOARD';

// Mock Data Type
interface Company {
  id: string;
  name: string;
  country: string;
  modulesCount: number;
  status: 'active' | 'setup';
  logo?: string;
}

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('LANDING'); // Set Landing as initial
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  // Flow Handlers

  // 1. Login/Signup Success -> Go to Plan Selection (or Companies List if simulating existing user)
  const handleLoginSuccess = () => {
      // For this demo, let's assume a new user goes to Plan Selection
      setCurrentView('PLAN_SELECTION');
  };

  // 2. Plan Selected -> Go to Companies List
  const handlePlanSelected = (planId: string) => {
    console.log(`Plan selected: ${planId}`);
    setSelectedPlan(planId);
    setCurrentView('COMPANIES_LIST');
  };

  // 3. Click "Create Company" -> Go to Wizard
  const handleStartWizard = () => {
    setCurrentView('CREATE_COMPANY_WIZARD');
  };

  // 4. Wizard Completed -> Add Mock Company -> Go to Dashboard
  const handleWizardComplete = () => {
    // Mock creating a company
    const newCompany: Company = {
      id: `comp_${Date.now()}`,
      name: "New Company Inc", // In real app, this comes from wizard data
      country: "United States",
      modulesCount: 4, // based on mock bundle
      status: 'active'
    };
    
    setCompanies([...companies, newCompany]);
    setActiveCompanyId(newCompany.id);
    setCurrentView('COMPANY_DASHBOARD');
  };

  // 5. Cancel Wizard -> Back to Companies List
  const handleWizardCancel = () => {
    setCurrentView('COMPANIES_LIST');
  };

  // 6. Select a company from list -> Go to Dashboard
  const handleCompanySelect = (companyId: string) => {
    setActiveCompanyId(companyId);
    setCurrentView('COMPANY_DASHBOARD');
  };

  // 7. Back from Dashboard -> Companies List
  const handleBackToCompanies = () => {
    setActiveCompanyId(null);
    setCurrentView('COMPANIES_LIST');
  };

  // Render Router
  switch (currentView) {
    case 'LANDING':
        return <LandingPage onLoginSuccess={handleLoginSuccess} />;

    case 'PLAN_SELECTION':
      return <ChoosePlan onPlanSelected={handlePlanSelected} />;
      
    case 'COMPANIES_LIST':
      return (
        <CompaniesList 
          companies={companies}
          onCreateClick={handleStartWizard}
          onCompanyClick={handleCompanySelect}
        />
      );

    case 'CREATE_COMPANY_WIZARD':
      return (
        <div className="relative min-h-screen">
           {/* Background: Companies List */}
           <CompaniesList 
             companies={companies}
             onCreateClick={() => {}} // No-op while modal is open
             onCompanyClick={() => {}} // No-op while modal is open
           />
           
           {/* Floating Modal Overlay */}
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             {/* 
                Responsive Modal Container 
                - max-w-5xl: Controls width
                - max-h-[90vh]: Ensures it fits in viewport
                - h-full: Tries to take available space up to max-h
                - flex-col: Allows children (Wizard) to scale
             */}
             <div className="w-full max-w-5xl h-full max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <CompanyWizard 
                  onCancel={handleWizardCancel} 
                  onComplete={handleWizardComplete} 
                />
             </div>
           </div>
        </div>
      );

    case 'COMPANY_DASHBOARD':
      const activeCompany = companies.find(c => c.id === activeCompanyId);
      return (
        <CompanyDashboard 
          companyId={activeCompanyId || ''} 
          companyName={activeCompany?.name || 'My Company'}
          onBack={handleBackToCompanies}
        />
      );

    default:
      return <div>Unknown State</div>;
  }
}