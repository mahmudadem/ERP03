import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { companyModulesApi } from '../../../api/companyModules';
import { systemMetadataApi } from '../../../api/systemMetadata';
import {
  Calculator,
  Calendar,
  DollarSign,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  Search,
  Badge,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { COATreePreview } from '../components/COATreePreview';
import { loadSystemVoucherTypes, SystemVoucherType } from '../services/voucherTypesService';
import { getCountryDefaults } from '../utils/countryDefaults';

interface AccountingSetupData {
  fiscalYearStart: string; // MM-DD format
  fiscalYearEnd: string; // MM-DD format
  baseCurrency: string;
  coaTemplate: string; // Changed to string to support API
  selectedVoucherTypes?: string[]; // IDs of voucher types to include
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
  locale: string;
}

interface CoaTemplate {
  id: string; // Changed to string to match API
  name: string;
  description: string;
  recommended: string;
  accountCount: number;
  complexity: 'low' | 'medium' | 'high' | 'custom';
  accounts?: Array<{
    code: string;
    name: string;
    type: string;
    parentCode?: string | null;
  }>;
}

/**
 * Accounting Module Initialization Wizard
 * Multi-step wizard to configure accounting module
 */
export const AccountingInitializationWizard: React.FC = () => {
  const { companyId, company } = useCompanyAccess();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingInitialization, setIsCheckingInitialization] = useState(true);
  const [isAlreadyInitialized, setIsAlreadyInitialized] = useState(false);
  
  // Dynamic data from API
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [coaTemplates, setCoaTemplates] = useState<CoaTemplate[]>([]);
  const [systemVoucherTypes, setSystemVoucherTypes] = useState<SystemVoucherType[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [setupData, setSetupData] = useState<AccountingSetupData>({
    fiscalYearStart: '01-01', // Jan 1
    fiscalYearEnd: '12-31', // Dec 31
    baseCurrency: '',
    coaTemplate: 'standard',
    selectedVoucherTypes: [], // Start with none selected
  });

  // Search functionality for COA templates
  const [templateSearch, setTemplateSearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');

  // Check if module is already initialized - prevent re-running wizard
  useEffect(() => {
    const checkInitializationStatus = async () => {
      if (!companyId) {
        setIsCheckingInitialization(false);
        return;
      }

      try {
        const modules = await companyModulesApi.list(companyId);
        const accountingModule = modules.find((m: any) => m.moduleCode === 'accounting');
        
        if (accountingModule?.initialized) {
          console.warn('[AccountingWizard] Module already initialized');
          setIsAlreadyInitialized(true);
        }
      } catch (err) {
        console.error('[AccountingWizard] Failed to check initialization status:', err);
        // Allow wizard to proceed if check fails (fail open)
      } finally {
        setIsCheckingInitialization(false);
      }
    };

    checkInitializationStatus();
  }, [companyId]);

  // Fetch currencies and COA templates on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setIsLoadingData(true);
        const [currenciesData, templatesData, voucherTypesData] = await Promise.all([
          systemMetadataApi.getCurrencies(),
          systemMetadataApi.getCoaTemplates(),
          loadSystemVoucherTypes(),
        ]);
        setCurrencies(currenciesData);
        setCoaTemplates(templatesData);
        setSystemVoucherTypes(voucherTypesData);
        
        // Auto-select recommended voucher types
        const recommended = voucherTypesData
          .filter(vt => vt.isRecommended)
          .map(vt => vt.id);
        
        // Use smart defaults from company country
        const countryDefaults = company?.country ? getCountryDefaults(company.country) : { currency: '', fiscalYearStart: '01-01', fiscalYearEnd: '12-31' };
        console.log('[AccountingWizard] Applied defaults for', company?.country, countryDefaults);

        setSetupData(prev => ({
          ...prev,
          fiscalYearStart: countryDefaults.fiscalYearStart,
          fiscalYearEnd: countryDefaults.fiscalYearEnd,
          baseCurrency: countryDefaults.currency,
          selectedVoucherTypes: recommended.length > 0 ? recommended : voucherTypesData.map(vt => vt.id),
        }));
      } catch (err) {
        console.error('Failed to load metadata:', err);
        setError('Failed to load wizard data. Please refresh the page.');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMetadata();
  }, [company?.country]); // Re-run if company country loads late

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!companyId) return;

    try {
      setIsCompleting(true);
      setError(null);

      // Initialize module with setup data
      await companyModulesApi.initialize(companyId, 'accounting', setupData);

      // Redirect to accounting module
      navigate('/accounting', { replace: true });
    } catch (err: any) {
      console.error('Failed to initialize accounting module:', err);
      setError(err.response?.data?.message || 'Failed to complete setup. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  // Helper function for complexity badges
  const getComplexityBadge = (complexity: string) => {
    const badges = {
      custom: { color: 'bg-purple-100 text-purple-700', label: 'Custom' },
      low: { color: 'bg-green-100 text-green-700', label: 'Simple' },
      medium: { color: 'bg-yellow-100 text-yellow-700', label: 'Medium' },
      high: { color: 'bg-red-100 text-red-700', label: 'Advanced' },
    };
    return badges[complexity as keyof typeof badges] || badges.medium;
  };

  const steps = [
    {
      title: 'Welcome',
      icon: Calculator,
      content: (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calculator className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Accounting Setup
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Let's configure your accounting foundation. This wizard will help you set up:
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto text-left">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Calendar className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Fiscal Year</h3>
              <p className="text-sm text-gray-600">Define your accounting period</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <DollarSign className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Base Currency</h3>
              <p className="text-sm text-gray-600">Set your default currency</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <BookOpen className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Chart of Accounts</h3>
              <p className="text-sm text-gray-600">Choose your account template</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Fiscal Year',
      icon: Calendar,
      content: (
        <div className="py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Set Your Fiscal Year</h2>
          <p className="text-gray-600 mb-8 text-center">
            Choose the start and end dates for your accounting year
          </p>
          
          <div className="max-w-md mx-auto space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fiscal Year Start (Month-Day)
              </label>
              <input
                type="text"
                value={setupData.fiscalYearStart}
                onChange={(e) => setSetupData({ ...setupData, fiscalYearStart: e.target.value })}
                placeholder="MM-DD (e.g., 01-01)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">Format: MM-DD (e.g., 01-01 for January 1st)</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fiscal Year End (Month-Day)
              </label>
              <input
                type="text"
                value={setupData.fiscalYearEnd}
                onChange={(e) => setSetupData({ ...setupData, fiscalYearEnd: e.target.value })}
                placeholder="MM-DD (e.g., 12-31)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">Format: MM-DD (e.g., 12-31 for December 31st)</p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Common Options:</strong><br />
                • Calendar Year: 01-01 to 12-31<br />
                • Fiscal Year (US): 10-01 to 09-30<br />
                • Fiscal Year (UK): 04-01 to 03-31
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Base Currency',
      icon: DollarSign,
      content: (
        <div className="py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Select Base Currency</h2>
          <p className="text-gray-600 mb-8 text-center">
            This will be your primary currency for all transactions
          </p>
          
          
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search currencies..."
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                <span className="ml-3 text-gray-600">Loading currencies...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 p-1">
                {(() => {
                  const companyCurrency = company?.country ? getCountryDefaults(company.country).currency : '';
                  
                  return currencies
                    .filter(c => 
                      c.code.toLowerCase().includes(currencySearch.toLowerCase()) || 
                      c.name.toLowerCase().includes(currencySearch.toLowerCase())
                    )
                    .sort((a, b) => {
                      if (a.code === companyCurrency) return -1;
                      if (b.code === companyCurrency) return 1;
                      if (a.code === setupData.baseCurrency) return -1;
                      if (b.code === setupData.baseCurrency) return 1;
                      return a.code.localeCompare(b.code);
                    })
                    .map((currency) => (
                      <button
                        key={currency.code}
                        onClick={() => setSetupData({ ...setupData, baseCurrency: currency.code })}
                        className={`p-3 rounded-lg border-2 transition-all text-left hover:border-primary-500 flex flex-col items-center justify-center gap-1 ${
                          setupData.baseCurrency === currency.code
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">{currency.symbol}</span>
                          <span className="font-bold text-gray-900">{currency.code}</span>
                        </div>
                        <p className="text-xs text-center text-gray-600 truncate w-full">{currency.name}</p>
                        {currency.code === companyCurrency && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 rounded-full mt-1">Recommended</span>
                        )}
                      </button>
                    ));
                })()}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Chart of Accounts',
      icon: BookOpen,
      content: (() => {
        const selectedTemplate = coaTemplates.find(t => t.id === setupData.coaTemplate);
        
        // Filter templates based on search
        const filteredTemplates = coaTemplates.filter(template => {
          if (!templateSearch) return true;
          const searchLower = templateSearch.toLowerCase();
          return (
            template.name.toLowerCase().includes(searchLower) ||
            template.description.toLowerCase().includes(searchLower) ||
            template.recommended.toLowerCase().includes(searchLower)
          );
        });
        
        return (
          <div className="py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Choose Chart of Accounts Template
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Select a template that matches your business complexity
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {/* Template Selection */}
              <div className="flex flex-col">
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Template List - Scrollable */}
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 min-h-0">
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                    <span className="ml-3 text-gray-600">Loading templates...</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No templates found</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Try adjusting your search criteria
                    </p>
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSetupData({ ...setupData, coaTemplate: template.id })}
                      className={`w-full p-6 rounded-lg border-2 transition-all text-left hover:border-primary-500 ${
                        setupData.coaTemplate === template.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{template.name}</h3>
                          <p className="text-sm text-gray-600">{template.description}</p>
                        </div>
                        {setupData.coaTemplate === template.id && (
                          <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {template.recommended}
                        </div>
                        <div className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getComplexityBadge(template.complexity).color}`}>
                          {getComplexityBadge(template.complexity).label}
                        </div>
                        <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          {template.accountCount} {template.accountCount === 1 ? 'account' : 'accounts'}
                        </div>
                      </div>
                    </button>
                  ))
                )}
                </div>
              </div>

              {/* Preview Panel */}
              <div className="h-full min-h-0">
                {selectedTemplate && selectedTemplate.accounts ? (
                  <COATreePreview accounts={selectedTemplate.accounts} />
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Select a template to preview</p>
                    <p className="text-sm text-gray-500 mt-1">
                      You'll see the account structure here
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })(),
    },
    {
      title: 'Voucher Types',
      icon: FileCheck,
      content: (() => {
        const toggleVoucherType = (voucherId: string) => {
          setSetupData(prev => {
            const current = prev.selectedVoucherTypes || [];
            const isSelected = current.includes(voucherId);
            
            return {
              ...prev,
              selectedVoucherTypes: isSelected
                ? current.filter(id => id !== voucherId)
                : [...current, voucherId]
            };
          });
        };

        const selectAll = () => {
          setSetupData(prev => ({
            ...prev,
            selectedVoucherTypes: systemVoucherTypes.map(vt => vt.id)
          }));
        };

        const selectNone = () => {
          setSetupData(prev => ({
            ...prev,
            selectedVoucherTypes: []
          }));
        };

        return (
          <div className="py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Select Voucher Types
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Choose which voucher types to include in your accounting setup
            </p>

            {/* Selection Controls */}
            <div className="flex justify-between items-center mb-6 max-w-4xl mx-auto">
              <p className="text-sm text-gray-600">
                {setupData.selectedVoucherTypes?.length || 0} of {systemVoucherTypes.length} selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded transition"
                >
                  Select All
                </button>
                <button
                  onClick={selectNone}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Voucher Types Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {isLoadingData ? (
                <div className="col-span-2 flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                  <span className="ml-3 text-gray-600">Loading voucher types...</span>
                </div>
              ) : systemVoucherTypes.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No voucher types available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Contact your system administrator to configure voucher types
                  </p>
                </div>
              ) : (
                systemVoucherTypes.map((voucherType) => {
                  const isSelected = setupData.selectedVoucherTypes?.includes(voucherType.id);
                  
                  return (
                    <button
                      key={voucherType.id}
                      onClick={() => toggleVoucherType(voucherType.id)}
                      className={`p-5 rounded-lg border-2 transition-all text-left hover:border-primary-500 ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">{voucherType.name}</h3>
                            {voucherType.isRecommended && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Prefix: <span className="font-mono font-semibold">{voucherType.prefix}</span>
                          </p>
                          {voucherType.description && (
                            <p className="text-sm text-gray-500">{voucherType.description}</p>
                          )}
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-4xl mx-auto">
              <div className="flex">
                <FileCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> You can add more voucher types later from the Voucher Designer, 
                    or clone the default ones to customize them.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })(),
    },
    {
      title: 'Review & Confirm',
      icon: CheckCircle,
      content: (() => {
        const selectedTemplate = coaTemplates.find(t => t.id === setupData.coaTemplate);
        const selectedCurrency = currencies.find(c => c.code === setupData.baseCurrency);

        return (
          <div className="py-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Review Your Configuration
            </h2>
            <p className="text-gray-600 mb-8 text-center">
              Please review your selections before initializing the accounting module
            </p>

            {/* Warning Banner */}
            <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-yellow-800">Important Notice</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p className="mb-2">
                      <strong>Initialization is permanent:</strong> Once completed, you cannot run this wizard again.
                    </p>
                    <p>
                      <strong>Changes allowed:</strong> You can modify these settings later from the Accounting Settings page.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Summary */}
            <div className="space-y-4">
              {/* Fiscal Year */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <Calendar className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Fiscal Year Period</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Start Date</p>
                        <p className="text-base font-medium text-gray-900">{setupData.fiscalYearStart}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">End Date</p>
                        <p className="text-base font-medium text-gray-900">{setupData.fiscalYearEnd}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Base Currency */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <DollarSign className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Base Currency</h3>
                    {selectedCurrency && (
                      <div>
                        <p className="text-base font-medium text-gray-900">
                          {selectedCurrency.name} ({selectedCurrency.code})
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Symbol: {selectedCurrency.symbol}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* COA Template */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <BookOpen className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Chart of Accounts Template</h3>
                    {selectedTemplate && (
                      <div>
                        <p className="text-base font-medium text-gray-900 mb-1">{selectedTemplate.name}</p>
                        <p className="text-sm text-gray-600 mb-3">{selectedTemplate.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getComplexityBadge(selectedTemplate.complexity).color}`}>
                            {getComplexityBadge(selectedTemplate.complexity).label}
                          </span>
                          <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                            {selectedTemplate.accountCount} {selectedTemplate.accountCount === 1 ? 'account' : 'accounts'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Voucher Types */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <FileCheck className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Selected Voucher Types</h3>
                    {setupData.selectedVoucherTypes && setupData.selectedVoucherTypes.length > 0 ? (
                      <div className="space-y-2">
                        {setupData.selectedVoucherTypes.map(id => {
                          const vt = systemVoucherTypes.find(v => v.id === id);
                          return vt ? (
                            <div key={id} className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-primary-600" />
                              <span className="font-medium">{vt.name}</span>
                              <span className="text-sm text-gray-500">({vt.prefix})</span>
                            </div>
                          ) : null;
                        })}
                        <p className="text-sm text-gray-600 mt-3">
                          Total: {setupData.selectedVoucherTypes.length} voucher type(s)
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">No voucher types selected</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Ready to proceed? Click <strong>"Complete Setup"</strong> below to initialize your accounting module with these settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })(),
    },
  ];

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  // Show loading while checking if module is already initialized
  if (isCheckingInitialization || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading wizard...</p>
        </div>
      </div>
    );
  }

  // Show "Already Configured" message if module is initialized
  if (isAlreadyInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-6">
            <div className="flex items-center gap-3 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Already Configured</h1>
                <p className="text-primary-100 text-sm">Accounting module is ready to use</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-primary-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Your accounting module has already been set up
            </h2>
            
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              The accounting module wizard can only be run once. Your chart of accounts, 
              fiscal year, and base currency have already been configured.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Need to make changes?
              </h3>
              <p className="text-sm text-blue-700">
                To modify your accounting configuration, please go to the Accounting Settings page 
                or contact your system administrator.
              </p>
            </div>

            <button
              onClick={() => navigate('/accounting')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 
                       text-white font-semibold rounded-lg hover:from-primary-600 hover:to-primary-700 
                       transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Go to Accounting Module
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      {/* Content */}
      <div className="w-full max-w-5xl h-[750px] flex flex-col bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Compact Progress Dots - Inside Card */}
        <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
              {steps.map((_, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                
                return (
                  <div key={index} className="flex items-center flex-1">
                    {/* Progress Dot */}
                    <div
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-white'
                          : isCurrent
                          ? 'bg-white ring-2 ring-white/50'
                          : 'bg-white/30'
                      }`}
                    />
                    
                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2">
                        <div
                          className={`h-full transition-all duration-300 ${
                            index < currentStep ? 'bg-white' : 'bg-white/30'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Step Info */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-white/90">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-xs font-semibold text-white">
                {Math.round(((currentStep + 1) / steps.length) * 100)}%
              </span>
            </div>
          </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-8 min-h-0">
          {currentStepData.content}
        </div>

          {/* Error */}
          {error && (
            <div className="px-8 pb-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            </div>
          )}

        {/* Navigation */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete Setup
                  </>
                )}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default AccountingInitializationWizard;
