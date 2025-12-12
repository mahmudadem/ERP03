
import React from 'react';
import { WizardStepProps } from './types';
import { Check, ArrowRight } from 'lucide-react';

export const StepSuccess: React.FC<WizardStepProps & { onComplete: () => void }> = ({ onComplete }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 md:py-12 text-center animate-in zoom-in-95 duration-500">
      <div className="h-16 w-16 md:h-24 md:w-24 rounded-full bg-green-100 flex items-center justify-center mb-4 md:mb-6">
        <Check className="h-8 w-8 md:h-12 md:w-12 text-green-600" />
      </div>
      
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Company Created Successfully!</h2>
      <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto mb-6 md:mb-8 px-4">
        The base container for your new company has been initialized.
      </p>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 md:mb-8 max-w-sm w-full text-left mx-4">
        <h4 className="font-semibold text-xs md:text-sm text-slate-800 mb-2">What's Next?</h4>
        <ul className="space-y-2 text-xs md:text-sm text-slate-600">
          <li className="flex gap-2">
            <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">1</div>
            <span>Setup accounting & currency settings</span>
          </li>
          <li className="flex gap-2">
            <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">2</div>
            <span>Invite users and assign roles</span>
          </li>
        </ul>
      </div>

      <button
        onClick={onComplete}
        className="inline-flex items-center justify-center rounded-md text-sm md:text-base font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary-600 text-white hover:bg-primary-600/90 h-10 md:h-11 px-6 md:px-8 py-2 shadow-lg hover:shadow-xl transform transition-all active:scale-95"
      >
        Go to Company Dashboard
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </div>
  );
};
