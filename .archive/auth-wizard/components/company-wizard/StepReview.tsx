
import React from 'react';
import { WizardStepProps, AVAILABLE_BUNDLES } from './types';
import { Building2, Globe, Box, Mail } from 'lucide-react';

export const StepReview: React.FC<WizardStepProps> = ({ data, updateData, onNext, onBack }) => {
  
  const selectedBundle = AVAILABLE_BUNDLES.find(b => b.id === data.selectedBundleId);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCreate = async () => {
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      onNext();
    }, 1500);
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
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-slate-100 hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 min-w-[140px] disabled:opacity-70"
        >
          {isSubmitting ? (
            <>Creating...</>
          ) : (
            'Create Company'
          )}
        </button>
      </div>
    </div>
  );
};
