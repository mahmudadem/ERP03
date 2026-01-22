
import React from 'react';
import { WizardStepProps } from './types';
import { Building2, Globe, Box, Mail, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { onboardingApi } from '../../api/onboardingApi';

export const StepReview: React.FC<WizardStepProps> = ({ data, updateData, onNext, onBack, bundles = [] }) => {
  
  const selectedBundle = bundles.find(b => b.id === data.selectedBundleId);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [progressSteps, setProgressSteps] = React.useState<Array<{ label: string; status: 'pending' | 'loading' | 'done' | 'error' }>>([
    { label: 'Creating company', status: 'pending' },
    { label: 'Installing modules', status: 'pending' },
    { label: 'Setting up permissions', status: 'pending' },
    { label: 'Finalizing', status: 'pending' },
  ]);

  const handleCreate = async () => {
    // Guard: prevent double submission
    if (isSubmitting) {
      return;
    }

    if (!data.companyName || !data.selectedBundleId) {
      setError("Missing required information");
      return;
    }

    setIsSubmitting(true);
    setShowModal(true);
    setError(null);

    try {
      // Step 1: Creating company
      setProgressSteps(prev => prev.map((step, i) => i === 0 ? { ...step, status: 'loading' } : step));
      
      const logoData = data.logoPreviewUrl || undefined;

      const result = await onboardingApi.createCompany({
        companyName: data.companyName,
        description: data.description || '',
        country: data.country || 'United States',
        email: data.email || '',
        bundleId: data.selectedBundleId,
        logoData,
        currency: data.currency,
        language: data.language,
        timezone: data.timezone,
        dateFormat: data.dateFormat
      });

      // Step 1 done
      setProgressSteps(prev => prev.map((step, i) => i === 0 ? { ...step, status: 'done' } : step));
      
      // Step 2: Installing modules (simulated - happens on backend)
      setProgressSteps(prev => prev.map((step, i) => i === 1 ? { ...step, status: 'loading' } : step));
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgressSteps(prev => prev.map((step, i) => i === 1 ? { ...step, status: 'done' } : step));
      
      // Step 3: Setting up permissions (simulated)
      setProgressSteps(prev => prev.map((step, i) => i === 2 ? { ...step, status: 'loading' } : step));
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgressSteps(prev => prev.map((step, i) => i === 2 ? { ...step, status: 'done' } : step));
      
      // Step 4: Finalizing
      setProgressSteps(prev => prev.map((step, i) => i === 3 ? { ...step, status: 'loading' } : step));
      await new Promise(resolve => setTimeout(resolve, 300));
      setProgressSteps(prev => prev.map((step, i) => i === 3 ? { ...step, status: 'done' } : step));
      
      // Success - store company ID and proceed
      updateData({ createdCompanyId: result.companyId });
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 800));
      setShowModal(false);
      onNext();
      
    } catch (err: any) {
      console.error("Failed to create company", err);
      
      // Stop all loading states - mark current loading step as error
      setProgressSteps(prev => prev.map(step => {
        if (step.status === 'loading') {
          return { ...step, status: 'error' as const };
        }
        return step;
      }));
      
      // Extract error message
      const errorMessage = err?.response?.data?.error?.message || err?.message || "Failed to create company. Please try again.";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setShowModal(false);
      setError(null);
      setProgressSteps(steps => steps.map(s => ({ ...s, status: 'pending' })));
    }
  };

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in slide-in-from-right-4 duration-300">
      
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 md:pr-2">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 md:p-6 mb-4 md:mb-6">
          <h3 className="font-semibold text-base md:text-lg text-slate-900 mb-4 flex items-center gap-2">
            Company Summary
          </h3>
          
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 md:gap-y-6">
            <div className="md:col-span-2 flex items-start gap-4 pb-4 md:pb-6 border-b border-slate-200">
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                {data.logoPreviewUrl ? (
                  <img src={data.logoPreviewUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-6 w-6 md:h-8 md:w-8 text-slate-300" />
                )}
              </div>
              <div className="min-w-0">
                <dt className="text-xs md:text-sm font-medium text-slate-500">Company Name</dt>
                <dd className="text-base md:text-lg font-semibold text-slate-900 mt-0.5 truncate">{data.companyName}</dd>
                {data.description && (
                  <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-lg line-clamp-2">{data.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
               <div className="mt-1 h-6 w-6 md:h-8 md:w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                 <Globe className="h-3 w-3 md:h-4 md:w-4" />
               </div>
               <div className="min-w-0">
                 <dt className="text-xs md:text-sm font-medium text-slate-500">Location</dt>
                 <dd className="text-sm md:text-base font-medium text-slate-900 truncate">{data.country}</dd>
               </div>
            </div>

            <div className="flex items-start gap-3">
               <div className="mt-1 h-6 w-6 md:h-8 md:w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                 <Mail className="h-3 w-3 md:h-4 md:w-4" />
               </div>
               <div className="min-w-0">
                 <dt className="text-xs md:text-sm font-medium text-slate-500">Admin Email</dt>
                 <dd className="text-sm md:text-base font-medium text-slate-900 truncate">{data.email}</dd>
               </div>
            </div>

            <div className="flex items-start gap-3 md:col-span-2">
               <div className="mt-1 h-6 w-6 md:h-8 md:w-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                 <Box className="h-3 w-3 md:h-4 md:w-4" />
               </div>
               <div className="w-full">
                 <dt className="text-xs md:text-sm font-medium text-slate-500">Selected Bundle</dt>
                 <dd className="text-sm md:text-base font-medium text-slate-900">{selectedBundle?.name}</dd>
                 <dd className="text-[10px] md:text-xs text-slate-500">{selectedBundle?.modules.length} modules included</dd>
               </div>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 md:p-6 shadow-sm mb-4">
          <div className="flex justify-between items-center mb-3">
             <h4 className="font-medium text-sm md:text-base text-slate-900">Modules to be installed</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedBundle?.modules.map((mod) => (
              <span key={mod} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] md:text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                {mod}
              </span>
            ))}
            {(!selectedBundle?.modules || selectedBundle.modules.length === 0) && (
                <span className="text-xs text-slate-500 italic">No specific modules selected.</span>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 pb-2">
           By clicking "Create Company", you agree to the Terms of Service for ERP03.
        </div>
      </div>

      <div className="flex justify-between items-center mt-2 pt-4 border-t border-slate-100 flex-shrink-0 bg-white">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-slate-100 hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary-600 text-white hover:bg-primary-600/90 h-10 px-6 py-2 min-w-[140px] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Company'
          )}
        </button>
      </div>

      {/* Progress Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {error ? 'Creation Failed' : isSubmitting ? 'Creating Company...' : 'Company Created!'}
              </h3>
              {!isSubmitting && (
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Progress Steps */}
            <div className="space-y-3 mb-6">
              {progressSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="shrink-0">
                    {step.status === 'loading' && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {step.status === 'done' && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {step.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    {step.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-200"></div>
                    )}
                  </div>
                  <span className={`text-sm ${
                    step.status === 'loading' ? 'text-blue-600 font-medium' :
                    step.status === 'done' ? 'text-green-600' :
                    step.status === 'error' ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-900 mb-1">Error</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {error && (
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    closeModal();
                    setTimeout(handleCreate, 100);
                  }}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {isSubmitting && (
              <p className="text-center text-sm text-gray-500">
                Please wait, this may take a few moments...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
