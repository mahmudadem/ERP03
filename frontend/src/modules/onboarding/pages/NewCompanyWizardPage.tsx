import React from 'react';
import { useNavigate } from 'react-router-dom';
import CompanyWizard from '../components/company-wizard';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';

/**
 * Page wrapper for the new company wizard.
 */
export const NewCompanyWizardPage: React.FC = () => {
    const navigate = useNavigate();
    const { switchCompany } = useCompanyAccess();
    const { setUiMode } = useUserPreferences();

    const handleCancel = () => {
        navigate('/company-selector');
    };

    const handleComplete = async (createdCompanyId?: string) => {
         if (createdCompanyId) {
             try {
                await switchCompany(createdCompanyId);
                setUiMode('classic');
                window.location.href = '/#/';
             } catch (err) {
                 console.error("Failed to switch to new company", err);
                 navigate('/company-selector');
             }
         } else {
             navigate('/company-selector');
         }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
             {/* Modal-like Container matching App.tsx from auth-wizard */}
             <div className="w-full max-w-5xl h-[90vh] flex flex-col bg-white shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <CompanyWizard onCancel={handleCancel} onComplete={handleComplete} />
             </div>
        </div>
    );
};

export default NewCompanyWizardPage;
