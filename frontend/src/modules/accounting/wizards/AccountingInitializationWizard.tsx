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
} from 'lucide-react';

interface AccountingSetupData {
  fiscalYearStart: string; // MM-DD format
  fiscalYearEnd: string; // MM-DD format
  baseCurrency: string;
  coaTemplate: string; // Changed to string to support API
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
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Accounting Module Initialization Wizard
 * Multi-step wizard to configure accounting module
 */
export const AccountingInitializationWizard: React.FC = () => {
  const { companyId } = useCompanyAccess();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dynamic data from API
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [coaTemplates, setCoaTemplates] = useState<CoaTemplate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [setupData, setSetupData] = useState<AccountingSetupData>({
    fiscalYearStart: '01-01', // Jan 1
    fiscalYearEnd: '12-31', // Dec 31
    baseCurrency: 'USD',
    coaTemplate: 'standard',
  });

  // Fetch currencies and COA templates on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setIsLoadingData(true);
        const [currenciesData, templatesData] = await Promise.all([
          systemMetadataApi.getCurrencies(),
          systemMetadataApi.getCoaTemplates(),
        ]);
        setCurrencies(currenciesData);
        setCoaTemplates(templatesData);
      } catch (err) {
        console.error('Failed to load metadata:', err);
        setError('Failed to load wizard data. Please refresh the page.');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMetadata();
  }, []);

  const handleNext = () => {
    if (currentStep < 3) {
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
      await companyModulesApi.initialize(companyId, 'accounting', {
        completedAt: new Date().toISOString(),
        config: setupData,
      });

      // Redirect to accounting module
      navigate('/accounting', { replace: true });
    } catch (err: any) {
      console.error('Failed to initialize accounting module:', err);
      setError(err.response?.data?.message || 'Failed to complete setup. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const steps = [
    {
      title: 'Welcome',
      icon: Calculator,
      content: (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calculator className="w-10 h-10 text-teal-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Accounting Setup
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Let's configure your accounting foundation. This wizard will help you set up:
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto text-left">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Calendar className="w-8 h-8 text-teal-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Fiscal Year</h3>
              <p className="text-sm text-gray-600">Define your accounting period</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <DollarSign className="w-8 h-8 text-teal-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Base Currency</h3>
              <p className="text-sm text-gray-600">Set your default currency</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <BookOpen className="w-8 h-8 text-teal-600 mb-3" />
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
          
          <div className="max-w-2xl mx-auto">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <span className="ml-3 text-gray-600">Loading currencies...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {currencies.map((currency) => (
                  <button
                    key={currency.code}
                    onClick={() => setSetupData({ ...setupData, baseCurrency: currency.code })}
                    className={`p-4 rounded-lg border-2 transition-all text-left hover:border-teal-500 ${
                      setupData.baseCurrency === currency.code
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{currency.symbol}</span>
                    <span className="font-bold text-gray-900">{currency.code}</span>
                  </div>
                  <p className="text-sm text-gray-600">{currency.name}</p>
                </button>
              ))}
            </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Chart of Accounts',
      icon: BookOpen,
      content: (
        <div className="py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Choose Chart of Accounts Template
          </h2>
          <p className="text-gray-600 mb-8 text-center">
            Select a template that matches your business complexity
          </p>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <span className="ml-3 text-gray-600">Loading templates...</span>
              </div>
            ) : (
              coaTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSetupData({ ...setupData, coaTemplate: template.id })}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left hover:border-teal-500 ${
                    setupData.coaTemplate === template.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{template.name}</h3>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </div>
                    {setupData.coaTemplate === template.id && (
                      <CheckCircle className="w-6 h-6 text-teal-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {template.recommended}
                </div>
              </button>
            ))
            )}
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm font-medium text-teal-600">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Step Header */}
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-8 py-6">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <StepIcon className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">{currentStepData.title}</h1>
            </div>
          </div>

          {/* Step Content */}
          <div className="p-8">
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
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
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
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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
    </div>
  );
};

export default AccountingInitializationWizard;
