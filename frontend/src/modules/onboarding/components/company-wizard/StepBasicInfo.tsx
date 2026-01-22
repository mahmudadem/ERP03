
import React, { useRef } from 'react';
import { WizardStepProps } from './types';
import { COUNTRIES } from './countries';
import { Upload, X, Building2, Globe, Loader2, Search, Check, Info } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { processImage } from '../../../../lib/image-utils';
import { getCountryDefaults } from '../../../accounting/utils/countryDefaults';

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB (original limit for selection)
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/x-icon'];

export const StepBasicInfo: React.FC<WizardStepProps> = ({ data, updateData, onNext, onBack }) => {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = React.useState(false);
  const [showDefaultInfo, setShowDefaultInfo] = React.useState(false);
  const countryInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Show defaults info when country is selected (Permanent until closed)
  React.useEffect(() => {
    if (data.country) {
      setShowDefaultInfo(true);
    } else {
      setShowDefaultInfo(false);
    }
  }, [data.country]);

  // Filter countries based on search
  const filteredCountries = React.useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const lowerSearch = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.toLowerCase().includes(lowerSearch));
  }, [countrySearch]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(event.target as Node)
      ) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validation
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.ico')) {
        setErrors(prev => ({ ...prev, logo: "Only PNG, JPG, ICO or WEBP images are allowed." }));
        return;
      }

      if (file.size > MAX_LOGO_SIZE) {
        setErrors(prev => ({ ...prev, logo: "Logo must be smaller than 5MB." }));
        return;
      }

      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.logo;
        return newErrors;
      });

      try {
        setIsProcessing(true);
        // Process/Compress image to standard size (max 512px)
        const processedDataUrl = await processImage(file, 512, 0.85);
        updateData({ logo: file, logoPreviewUrl: processedDataUrl });
      } catch (err) {
        setErrors(prev => ({ ...prev, logo: "Failed to process image. please try another one." }));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const clearLogo = () => {
    updateData({ logo: null, logoPreviewUrl: null });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.logo;
      return newErrors;
    });
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
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
                    errors.companyName ? "border-red-500 focus-visible:border-red-500" : ""
                )}
                />
            </div>
            {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
            </div>

            {/* Country - Searchable */}
            <div className="space-y-2 md:col-span-1">
            <label htmlFor="country" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Country / Region <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  ref={countryInputRef}
                  id="country"
                  type="text"
                  placeholder="Search countries..."
                  value={isCountryDropdownOpen ? countrySearch : data.country || ''}
                  onChange={(e) => {
                    setCountrySearch(e.target.value);
                    if (!isCountryDropdownOpen) setIsCountryDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setIsCountryDropdownOpen(true);
                    setCountrySearch('');
                  }}
                  className={cn(
                      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-0 transition-colors",
                      errors.country ? "border-red-500 focus-visible:border-red-500" : ""
                  )}
                  autoComplete="off"
                />

                {/* Dropdown */}
                {isCountryDropdownOpen && (
                  <div
                    ref={countryDropdownRef}
                    className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
                  >
                    {filteredCountries.length > 0 ? (
                      filteredCountries.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            const defaults = getCountryDefaults(c);
                            updateData({ 
                              country: c,
                              currency: defaults.currency,
                              timezone: defaults.timezone,
                              language: defaults.language,
                              dateFormat: defaults.dateFormat
                            });
                            setCountrySearch('');
                            setIsCountryDropdownOpen(false);
                            if (errors.country) setErrors({ ...errors, country: '' });
                          }}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 transition-colors text-left",
                            data.country === c ? "bg-primary-50 text-primary-700 font-medium" : "text-slate-700"
                          )}
                        >
                          <span>{c}</span>
                          {data.country === c && <Check className="h-4 w-4 text-primary-600" />}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-slate-500 text-center">
                        No countries found
                      </div>
                    )}
                  </div>
                )}
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
                className="flex-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-colors"
            />
            </div>

            {/* Logo Upload - Shared Row */}
            <div className="space-y-2 md:col-span-1 flex flex-col">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Company Logo <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            
            {!data.logoPreviewUrl ? (
                <div className={cn(
                    "flex-1 min-h-[120px] flex justify-center items-center rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 transition-colors relative group",
                    errors.logo ? "border-red-500 bg-red-50/10" : ""
                )}>
                <div className="text-center p-4">
                    {isProcessing ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
                        <p className="text-[10px] text-slate-500 mt-2 font-medium uppercase tracking-wider">Optimizing...</p>
                      </div>
                    ) : (
                      <>
                        <div className={cn(
                            "mx-auto h-8 w-8 text-slate-300 group-hover:text-primary-600 transition-colors",
                            errors.logo ? "text-red-300" : ""
                        )}>
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
                        <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, ICO, WEBP</p>
                      </>
                    )}
                </div>
                </div>
            ) : (
                <div className="flex-1 min-h-[120px] flex items-center justify-center gap-4 p-4 border rounded-lg bg-slate-50/50 relative group">
                <div className="relative h-20 w-20 rounded-md overflow-hidden bg-white border shadow-sm transition-transform group-hover:scale-105 duration-300 flex items-center justify-center p-1">
                    <img src={data.logoPreviewUrl} alt="Logo preview" className="max-h-full max-w-full w-auto h-auto object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{data.logo?.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">Ready for Documents</p>
                </div>
                <button
                    type="button"
                    onClick={clearLogo}
                    className="p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                    aria-label="Remove logo"
                >
                    <X className="h-4 w-4" />
                </button>
                </div>
            )}
            {errors.logo && <p className="text-[10px] text-red-500 font-medium mt-1">{errors.logo}</p>}
            </div>
        </div>

        {/* Smart Defaults Info Box */}
        {showDefaultInfo && data.country && (() => {
           const defaults = getCountryDefaults(data.country!);
           return (
             <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
               <div className="flex-1">
                 <p className="text-xs text-blue-700 font-medium">Auto-Configuration Enabled</p>
                 <div className="text-[11px] text-slate-500 mt-1 leading-relaxed space-y-1">
                    <p>Based on <strong>{data.country}</strong>, we've applied the following smart defaults:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                        <li>Currency: <strong>{defaults.currency}</strong></li>
                        <li>Language: <strong>{defaults.language === 'ar' ? 'Arabic' : defaults.language === 'tr' ? 'Turkish' : 'English'}</strong></li>
                        {defaults.timezone && <li>Timezone: <strong>{defaults.timezone}</strong></li>}
                        {defaults.dateFormat && <li>Date Format: <strong>{defaults.dateFormat}</strong></li>}
                    </ul>
                    <p className="text-[10px] text-slate-400 mt-1">These settings can be customized in your company profile later.</p>
                 </div>
               </div>
               <button onClick={() => setShowDefaultInfo(false)} className="text-slate-400 hover:text-slate-600 self-start">
                 <X className="h-3 w-3" />
               </button>
             </div>
           );
        })()}
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
