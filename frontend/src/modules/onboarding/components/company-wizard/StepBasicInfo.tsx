
import React from 'react';
import { WizardStepProps, COUNTRIES } from './types';
import { Upload, X, Building2, Globe } from 'lucide-react';
import { cn } from '../../../../lib/utils';

export const StepBasicInfo: React.FC<WizardStepProps> = ({ data, updateData, onNext, onBack }) => {
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      updateData({ logo: file, logoPreviewUrl: previewUrl });
    }
  };

  const clearLogo = () => {
    updateData({ logo: null, logoPreviewUrl: null });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!data.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!data.country) newErrors.country = "Please select a country";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full w-full animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 md:pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            
            {/* Company Name */}
            <div className="space-y-2 md:col-span-1">
            <label htmlFor="companyName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Company Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                id="companyName"
                type="text"
                placeholder="e.g. Acme Corp"
                value={data.companyName}
                onChange={(e) => {
                    updateData({ companyName: e.target.value });
                    if (errors.companyName) setErrors({ ...errors, companyName: '' });
                }}
                className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    errors.companyName ? "border-red-500 focus-visible:ring-red-500" : ""
                )}
                />
            </div>
            {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
            </div>

            {/* Country */}
            <div className="space-y-2 md:col-span-1">
            <label htmlFor="country" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Country / Region <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <select
                id="country"
                value={data.country}
                onChange={(e) => {
                    updateData({ country: e.target.value });
                    if (errors.country) setErrors({ ...errors, country: '' });
                }}
                className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-no-repeat",
                    errors.country ? "border-red-500 focus-visible:ring-red-500" : ""
                )}
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: `right 0.5rem center`,
                    backgroundSize: `1.5em 1.5em`
                }}
                >
                <option value="" disabled>Select a country</option>
                {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                ))}
                </select>
            </div>
            {errors.country && <p className="text-xs text-red-500">{errors.country}</p>}
            </div>

            {/* Description - Shared Row */}
            <div className="space-y-2 md:col-span-1 flex flex-col">
            <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
                id="description"
                placeholder="Briefly describe your company..."
                value={data.description}
                onChange={(e) => updateData({ description: e.target.value })}
                className="flex-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            </div>

            {/* Logo Upload - Shared Row */}
            <div className="space-y-2 md:col-span-1 flex flex-col">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Company Logo <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            
            {!data.logoPreviewUrl ? (
                <div className="flex-1 min-h-[120px] flex justify-center items-center rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 transition-colors relative group">
                <div className="text-center p-4">
                    <div className="mx-auto h-8 w-8 text-slate-300 group-hover:text-primary-600 transition-colors">
                    <Upload className="h-full w-full" />
                    </div>
                    <div className="mt-2 flex text-xs leading-5 text-slate-600 justify-center">
                    <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer rounded-md font-semibold text-primary-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-600 focus-within:ring-offset-2 hover:text-primary-600/80"
                    >
                        <span>Upload</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                    </label>
                    <p className="pl-1">or drag & drop</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                </div>
                </div>
            ) : (
                <div className="flex-1 min-h-[120px] flex items-center gap-3 p-3 border rounded-lg bg-slate-50 relative">
                <div className="relative h-14 w-14 rounded-md overflow-hidden border bg-white flex-shrink-0">
                    <img src={data.logoPreviewUrl} alt="Logo preview" className="h-full w-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{data.logo?.name}</p>
                    <p className="text-xs text-slate-500">{(data.logo!.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                    type="button"
                    onClick={clearLogo}
                    className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                    aria-label="Remove logo"
                >
                    <X className="h-4 w-4" />
                </button>
                </div>
            )}
            </div>
        </div>
      </div>

      {/* Footer - Pinned to bottom */}
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 bg-white flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-slate-100 hover:text-accent-foreground h-10 px-4 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary-600 text-white hover:bg-primary-600/90 h-10 px-8 py-2"
        >
          Next Step
        </button>
      </div>
    </form>
  );
};
