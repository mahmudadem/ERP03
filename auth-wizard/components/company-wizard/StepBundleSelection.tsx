
import React from 'react';
import { WizardStepProps, AVAILABLE_BUNDLES, Bundle } from './types';
import { CheckCircle2, ShieldAlert, Search } from 'lucide-react';
import { cn } from '../../utils';

export const StepBundleSelection: React.FC<WizardStepProps> = ({ data, updateData, onNext, onBack }) => {
  const [selectedBundleId, setSelectedBundleId] = React.useState<string | null>(data.selectedBundleId || 'empty-company');
  const [searchQuery, setSearchQuery] = React.useState("");
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    if (!data.selectedBundleId) {
       updateData({ selectedBundleId: 'empty-company' });
    }
  }, []);

  const handleSelect = (id: string) => {
    setSelectedBundleId(id);
    updateData({ selectedBundleId: id });
    setError("");
  };

  const handleNext = () => {
    if (!selectedBundleId) {
      setError("Please select a bundle to proceed.");
      return;
    }
    onNext();
  };

  const filteredBundles = React.useMemo(() => {
    let bundles = [...AVAILABLE_BUNDLES];
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      bundles = bundles.filter(b => 
        b.name.toLowerCase().includes(lowerQuery) || 
        b.description.toLowerCase().includes(lowerQuery)
      );
    }
    return bundles.sort((a, b) => {
      if (a.id === 'empty-company') return -1;
      if (b.id === 'empty-company') return 1;
      return 0;
    });
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Header & Search - Fixed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 flex-shrink-0">
        <div>
           <h3 className="text-lg md:text-xl font-bold text-slate-800">Select a Bundle</h3>
           <p className="text-sm md:text-base text-slate-500">Choose a starting template.</p>
        </div>
        <div className="relative w-full sm:w-64">
           <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
           <input 
              type="text" 
              placeholder="Search bundles..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
           />
        </div>
      </div>
      
      {/* Bundle Grid Container - Scrollable Area */}
      {/* We use flex-1 to take available space, min-h-0 to allow shrinking, overflow-y-auto to scroll internally */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 md:pr-2 -mr-1 md:-mr-2">
        {filteredBundles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBundles.map((bundle) => (
              <BundleCard 
                key={bundle.id} 
                bundle={bundle} 
                isSelected={selectedBundleId === bundle.id} 
                onSelect={() => handleSelect(bundle.id)} 
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
             <Search className="h-8 w-8 text-slate-300 mb-2" />
             <p className="text-base">No bundles found.</p>
          </div>
        )}
        
        {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md border border-red-200 text-sm">
                <ShieldAlert className="h-4 w-4" />
                <span className="font-medium">{error}</span>
            </div>
        )}
      </div>

      {/* Footer - Fixed */}
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 bg-white flex-shrink-0">
        <div className="hidden sm:block text-xs text-slate-400">
          {filteredBundles.length} bundles
        </div>
        <div className="flex gap-3 ml-auto">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-slate-100 hover:text-accent-foreground h-10 px-4 py-2"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2"
          >
            Next Step
          </button>
        </div>
      </div>
    </div>
  );
};

// Sub-component for Bundle Cards
interface BundleCardProps {
  bundle: Bundle;
  isSelected: boolean;
  onSelect: () => void;
}

const BundleCard: React.FC<BundleCardProps> = ({ bundle, isSelected, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col bg-white",
        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 hover:border-slate-300"
      )}
    >
      {/* Header */}
      <div className="mb-2 pr-6">
        <div className="flex items-center gap-2">
             <h4 className="font-bold text-lg md:text-xl text-slate-900 line-clamp-1">{bundle.name}</h4>
             {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
        </div>
        <p className="text-slate-600 text-sm md:text-base mt-1 leading-normal line-clamp-2 min-h-[2.5rem]">{bundle.description}</p>
      </div>

      <div className="w-full h-px bg-slate-100 my-2"></div>

      {/* Included Modules */}
      <div className="mt-1 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {bundle.modules.length > 0 ? (
            bundle.modules.slice(0, 4).map((module) => (
              <span key={module} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] md:text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {module}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">No modules</span>
          )}
          {bundle.modules.length > 4 && (
             <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] md:text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                +{bundle.modules.length - 4}
             </span>
          )}
        </div>
      </div>
    </div>
  );
};
