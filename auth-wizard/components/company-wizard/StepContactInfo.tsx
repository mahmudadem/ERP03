
import React from 'react';
import { WizardStepProps } from './types';
import { Mail, Shield } from 'lucide-react';
import { cn } from '../../utils';

export const StepContactInfo: React.FC<WizardStepProps> = ({ data, updateData, onNext, onBack }) => {
  const [error, setError] = React.useState('');

  const validate = () => {
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setError('Please enter a valid business email address.');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full w-full animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto">
      <div className="flex-1 space-y-6 md:space-y-8 overflow-y-auto min-h-0 pr-2">
        
        <div className="text-center mt-4">
            <div className="inline-flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-blue-50 mb-3 md:mb-4">
                <Mail className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900">Contact Information</h3>
            <p className="text-sm md:text-base text-slate-500 mt-1 md:mt-2 px-4">Where should we send important updates about this company?</p>
        </div>

        {/* Email Field */}
        <div className="space-y-3 px-2 md:px-0">
          <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Business Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              id="email"
              type="email"
              placeholder="admin@company.com"
              value={data.email || ''}
              onChange={(e) => {
                updateData({ email: e.target.value });
                if (error) setError('');
              }}
              className={cn(
                "flex h-10 md:h-12 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm md:text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                error ? "border-red-500 focus-visible:ring-red-500" : ""
              )}
            />
          </div>
          {/* Helper Description */}
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
             <Shield className="h-3 w-3" />
             We will send billing, security, and admin notifications here.
          </p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

      </div>

      {/* Navigation Footer */}
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 w-full flex-shrink-0 bg-white">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-slate-100 hover:text-accent-foreground h-10 px-4 py-2"
        >
          Back
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2"
        >
          Next Step
        </button>
      </div>
    </form>
  );
};
