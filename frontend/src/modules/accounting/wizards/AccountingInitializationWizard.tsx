import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom'; import { useQueryClient } from '@tanstack/react-query'; import { useCompanyAccess } from '../../../context/CompanyAccessContext'; import { companyModulesApi } from '../../../api/companyModules'; import { systemMetadataApi } from '../../../api/systemMetadata'; import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents'; import { Calculator, Calendar, DollarSign, BookOpen, ChevronRight, CheckCircle, Search, Badge, AlertTriangle, FileCheck} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { ModuleSetupWizardShell } from '../../../components/shared/ModuleSetupWizardShell';
import { COATreePreview } from '../components/COATreePreview';
import {
  loadSystemVoucherTypeGroups,
  SystemVoucherTypeGroup,
} from '../services/voucherTypesService';
import { getCountryDefaults } from '../utils/countryDefaults';
import {
  getLocalizedCoaTemplateSearchText,
  getLocalizedCoaTemplateText,
  getLocalizedCurrencyName,
  getLocalizedCurrencySearchText,
} from '../../../utils/localizedSystemMetadata';

interface AccountingSetupData {
  fiscalYearStart: string; // MM-DD format
  fiscalYearEnd: string; // MM-DD format
  baseCurrency: string;
  coaTemplate: string; // Changed to string to support API
  /**
   * Canonical voucherType keys the user picked (e.g. "journal_entry").
   * Expanded to template ids at submit time so every form variant of every
   * selected type installs as a locked + inactive default.
   */
  selectedTypeKeys?: string[];
  periodScheme: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL';
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
  const { t } = useTranslation('accounting');
  const { t: tCommon } = useTranslation('common');
  const { companyId, company, refreshCompany } = useCompanyAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingInitialization, setIsCheckingInitialization] = useState(true);
  const [isAlreadyInitialized, setIsAlreadyInitialized] = useState(false);
  
  // Dynamic data from API
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [coaTemplates, setCoaTemplates] = useState<CoaTemplate[]>([]);
  const [voucherTypeGroups, setVoucherTypeGroups] = useState<SystemVoucherTypeGroup[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [setupData, setSetupData] = useState<AccountingSetupData>({
    fiscalYearStart: '01-01', // Jan 1
    fiscalYearEnd: '12-31', // Dec 31
    baseCurrency: '',
    coaTemplate: 'standard',
    selectedTypeKeys: [], // Start with none selected
    periodScheme: 'MONTHLY',
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
        const [currenciesData, templatesData, typeGroupsData] = await Promise.all([
          systemMetadataApi.getCurrencies(),
          systemMetadataApi.getCoaTemplates(),
          loadSystemVoucherTypeGroups('ACCOUNTING'),
        ]);
        setCurrencies(currenciesData);
        setCoaTemplates(templatesData);
        setVoucherTypeGroups(typeGroupsData);

        // Auto-select recommended types; if none flagged, default to all types.
        const recommended = typeGroupsData.filter(g => g.isRecommended).map(g => g.typeKey);

        // Use smart defaults from company country
        const countryDefaults = company?.country ? getCountryDefaults(company.country) : { currency: '', fiscalYearStart: '01-01', fiscalYearEnd: '12-31' };
        console.log('[AccountingWizard] Applied defaults for', company?.country, countryDefaults);

        setSetupData(prev => ({
          ...prev,
          fiscalYearStart: countryDefaults.fiscalYearStart,
          fiscalYearEnd: countryDefaults.fiscalYearEnd,
          baseCurrency: prev.baseCurrency || countryDefaults.currency || company?.baseCurrency || '',
          selectedTypeKeys: recommended.length > 0 ? recommended : typeGroupsData.map(g => g.typeKey),
        }));
      } catch (err) {
        console.error('Failed to load metadata:', err);
        setError(t('initializationWizard.errors.loadData'));
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMetadata();
  }, [company?.country, company?.baseCurrency]); // Re-run if company profile loads late

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

      if (!setupData.baseCurrency) {
        setError(t('initializationWizard.errors.baseCurrencyRequired'));
        return;
      }

      // Expand each selected type key into every template id (form variant)
      // for that type. The backend sync still takes template ids; the wizard
      // bundles "pick one type, install all its forms" at the call site.
      const selectedTemplateIds = voucherTypeGroups
        .filter((g) => setupData.selectedTypeKeys?.includes(g.typeKey))
        .flatMap((g) => g.forms.map((f) => f.id));

      // Initialize module with setup data
      await companyModulesApi.initialize(companyId, 'accounting', {
        ...setupData,
        selectedVoucherTypes: selectedTemplateIds,
      });

      // Refresh cached module status before navigating so the guard does not
      // bounce us back to /accounting/setup based on a stale "uninitialized" snapshot.
      emitCompanyModulesRefresh({ companyId, moduleCode: 'accounting' });
      await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
      await refreshCompany();
      navigate('/accounting', { replace: true });
    } catch (err: any) {
      console.error('Failed to initialize accounting module:', err);
      setError(err.response?.data?.message || t('initializationWizard.errors.complete'));
    } finally {
      setIsCompleting(false);
    }
  };

  // Helper function for complexity badges
  const getComplexityBadge = (complexity: string) => {
    const badges = {
      custom: { color: 'bg-purple-100 text-purple-700', label: t('initializationWizard.complexity.custom') },
      low: { color: 'bg-green-100 text-green-700', label: t('initializationWizard.complexity.low') },
      medium: { color: 'bg-yellow-100 text-yellow-700', label: t('initializationWizard.complexity.medium') },
      high: { color: 'bg-red-100 text-red-700', label: t('initializationWizard.complexity.high') },
    };
    return badges[complexity as keyof typeof badges] || badges.medium;
  };

  const steps = [
    {
      title: t('initializationWizard.steps.welcome'),
      icon: Calculator,
      content: (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calculator className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t('initializationWizard.welcome.title')}
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            {t('initializationWizard.welcome.description')}
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto text-start">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Calendar className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">{t('initializationWizard.welcome.fiscalYearTitle')}</h3>
              <p className="text-sm text-gray-600">{t('initializationWizard.welcome.fiscalYearDescription')}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <DollarSign className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">{t('initializationWizard.welcome.baseCurrencyTitle')}</h3>
              <p className="text-sm text-gray-600">{t('initializationWizard.welcome.baseCurrencyDescription')}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <BookOpen className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">{t('initializationWizard.welcome.coaTitle')}</h3>
              <p className="text-sm text-gray-600">{t('initializationWizard.welcome.coaDescription')}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t('initializationWizard.steps.fiscalYear'),
      icon: Calendar,
      content: (
        <div className="py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t('initializationWizard.fiscalYear.title')}</h2>
          <p className="text-gray-600 mb-8 text-center">
            {t('initializationWizard.fiscalYear.description')}
          </p>
          
          <div className="max-w-md mx-auto space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('initializationWizard.fiscalYear.startLabel')}
              </label>
              <input
                type="text"
                value={setupData.fiscalYearStart}
                onChange={(e) => setSetupData({ ...setupData, fiscalYearStart: e.target.value })}
                placeholder={t('initializationWizard.fiscalYear.startPlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('initializationWizard.fiscalYear.startHelp')}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('initializationWizard.fiscalYear.endLabel')}
              </label>
              <input
                type="text"
                value={setupData.fiscalYearEnd}
                onChange={(e) => setSetupData({ ...setupData, fiscalYearEnd: e.target.value })}
                placeholder={t('initializationWizard.fiscalYear.endPlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('initializationWizard.fiscalYear.endHelp')}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('initializationWizard.fiscalYear.periodSchemeLabel')}
              </label>
              <select
                value={setupData.periodScheme}
                onChange={(e) => setSetupData({ ...setupData, periodScheme: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="MONTHLY">{t('initializationWizard.periodSchemes.monthlyWithCount')}</option>
                <option value="QUARTERLY">{t('initializationWizard.periodSchemes.quarterlyWithCount')}</option>
                <option value="SEMI_ANNUAL">{t('initializationWizard.periodSchemes.semiAnnualWithCount')}</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">{t('initializationWizard.fiscalYear.periodSchemeHelp')}</p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>{t('initializationWizard.fiscalYear.commonOptions')}</strong><br />
                {t('initializationWizard.fiscalYear.calendarYear')}<br />
                {t('initializationWizard.fiscalYear.usFiscalYear')}<br />
                {t('initializationWizard.fiscalYear.ukFiscalYear')}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t('initializationWizard.steps.baseCurrency'),
      icon: DollarSign,
      content: (
        <div className="py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t('initializationWizard.currency.title')}</h2>
          <p className="text-gray-600 mb-8 text-center">
            {t('initializationWizard.currency.description')}
          </p>
          
          
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('initializationWizard.currency.searchPlaceholder')}
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
                <span className="ms-3 text-gray-600">{t('initializationWizard.currency.loading')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 p-1">
                {(() => {
                  const companyCurrency = company?.country ? getCountryDefaults(company.country).currency : '';
                  
                  return currencies
                    .filter(c =>
                      getLocalizedCurrencySearchText(c, tCommon).includes(
                        currencySearch.toLocaleLowerCase()
                      )
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
                        className={`p-3 rounded-lg border-2 transition-all text-start hover:border-primary-500 flex flex-col items-center justify-center gap-1 ${
                          setupData.baseCurrency === currency.code
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">{currency.symbol}</span>
                          <span className="font-bold text-gray-900">{currency.code}</span>
                        </div>
                        <p className="text-xs text-center text-gray-600 truncate w-full">
                          {getLocalizedCurrencyName(currency, tCommon)}
                        </p>
                        {currency.code === companyCurrency && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 rounded-full mt-1">{t('initializationWizard.common.recommended')}</span>
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
      title: t('initializationWizard.steps.chartOfAccounts'),
      icon: BookOpen,
      content: (() => {
        const selectedTemplate = coaTemplates.find(t => t.id === setupData.coaTemplate);
        
        // Filter templates based on search
        const filteredTemplates = coaTemplates.filter(template => {
          if (!templateSearch) return true;
          const searchLower = templateSearch.toLowerCase();
          return getLocalizedCoaTemplateSearchText(template, tCommon).includes(searchLower);
        });
        
        return (
          <div className="py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {t('initializationWizard.coa.title')}
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              {t('initializationWizard.coa.description')}
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {/* Template Selection */}
              <div className="flex flex-col">
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('initializationWizard.coa.searchPlaceholder')}
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full ps-10 pe-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Template List - Scrollable */}
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 min-h-0">
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                    <span className="ms-3 text-gray-600">{t('initializationWizard.coa.loading')}</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">{t('initializationWizard.coa.noTemplates')}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('initializationWizard.coa.adjustSearch')}
                    </p>
                  </div>
                ) : (
                  filteredTemplates
                    .sort((a, b) => {
                      if (a.id === 'standard') return -1;
                      if (b.id === 'standard') return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSetupData({ ...setupData, coaTemplate: template.id })}
                      className={`w-full p-6 rounded-lg border-2 transition-all text-start hover:border-primary-500 ${
                        setupData.coaTemplate === template.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {getLocalizedCoaTemplateText(template, 'name', tCommon)}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {getLocalizedCoaTemplateText(template, 'description', tCommon)}
                          </p>
                        </div>
                        {setupData.coaTemplate === template.id && (
                          <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {getLocalizedCoaTemplateText(template, 'recommended', tCommon)}
                        </div>
                        <div className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getComplexityBadge(template.complexity).color}`}>
                          {getComplexityBadge(template.complexity).label}
                        </div>
                        <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          {t('initializationWizard.coa.accountCount', { total: template.accountCount })}
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
                    <p className="text-gray-600 font-medium">{t('initializationWizard.coa.selectToPreview')}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('initializationWizard.coa.previewHelp')}
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
      title: t('initializationWizard.steps.voucherTypes'),
      icon: FileCheck,
      content: (() => {
        const toggleType = (typeKey: string) => {
          setSetupData(prev => {
            const current = prev.selectedTypeKeys || [];
            const isSelected = current.includes(typeKey);

            return {
              ...prev,
              selectedTypeKeys: isSelected
                ? current.filter(k => k !== typeKey)
                : [...current, typeKey]
            };
          });
        };

        const selectAll = () => {
          setSetupData(prev => ({
            ...prev,
            selectedTypeKeys: voucherTypeGroups.map(g => g.typeKey)
          }));
        };

        const selectNone = () => {
          setSetupData(prev => ({
            ...prev,
            selectedTypeKeys: []
          }));
        };

        return (
          <div className="py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {t('initializationWizard.voucherTypes.title')}
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              {t('initializationWizard.voucherTypes.description')}
            </p>

            {/* Selection Controls */}
            <div className="flex justify-between items-center mb-6 max-w-4xl mx-auto">
              <p className="text-sm text-gray-600">
                {t('initializationWizard.voucherTypes.selectedCount', {
                  selected: setupData.selectedTypeKeys?.length || 0,
                  total: voucherTypeGroups.length,
                })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded transition"
                >
                  {t('initializationWizard.voucherTypes.selectAll')}
                </button>
                <button
                  onClick={selectNone}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded transition"
                >
                  {t('initializationWizard.voucherTypes.clearAll')}
                </button>
              </div>
            </div>

            {/* Voucher Types Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {isLoadingData ? (
                <div className="col-span-2 flex items-center justify-center py-12">
                  <Spinner size="lg" />
                  <span className="ms-3 text-gray-600">{t('initializationWizard.voucherTypes.loading')}</span>
                </div>
              ) : voucherTypeGroups.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">{t('initializationWizard.voucherTypes.noneAvailable')}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('initializationWizard.voucherTypes.contactAdmin')}
                  </p>
                </div>
              ) : (
                voucherTypeGroups.map((group) => {
                  const isSelected = setupData.selectedTypeKeys?.includes(group.typeKey);
                  const formCount = group.forms.length;
                  const variantLabels = group.forms
                    .map((f) => {
                      if (f.persona) return f.persona.charAt(0).toUpperCase() + f.persona.slice(1);
                      const match = f.name.match(/\(([^)]+)\)/);
                      return match ? match[1] : null;
                    })
                    .filter(Boolean) as string[];

                  return (
                    <button
                      key={group.typeKey}
                      onClick={() => toggleType(group.typeKey)}
                      className={`p-5 rounded-lg border-2 transition-all text-start hover:border-primary-500 ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900">
                              {t(`initializationWizard.voucherTypes.names.${group.typeKey}`, { defaultValue: group.name })}
                            </h3>
                            {group.isRecommended && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                {t('initializationWizard.common.recommended')}
                              </span>
                            )}
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                              {t('initializationWizard.voucherTypes.defaultFormCount', { total: formCount })}
                            </span>
                          </div>
                          {variantLabels.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              {t('initializationWizard.voucherTypes.variants', { variants: variantLabels.join(' · ') })}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0 ms-2" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg max-w-4xl mx-auto">
              <div className="flex items-start gap-2">
                <FileCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 space-y-1">
                  <p className="font-semibold">{t('initializationWizard.voucherTypes.installNoticeTitle')}</p>
                  <p>{t('initializationWizard.voucherTypes.installNoticeDescription')}</p>
                  <ul className="list-disc list-inside ml-1 space-y-0.5">
                    <li>{t('initializationWizard.voucherTypes.activateInstruction')}</li>
                    <li>{t('initializationWizard.voucherTypes.cloneInstruction')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      })(),
    },
    {
      title: t('initializationWizard.steps.review'),
      icon: CheckCircle,
      content: (() => {
        const selectedTemplate = coaTemplates.find(t => t.id === setupData.coaTemplate);
        const selectedCurrency = currencies.find(c => c.code === setupData.baseCurrency);

        return (
          <div className="py-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {t('initializationWizard.review.title')}
            </h2>
            <p className="text-gray-600 mb-8 text-center">
              {t('initializationWizard.review.description')}
            </p>

            {/* Warning Banner */}
            <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="ms-3">
                  <h3 className="text-sm font-semibold text-yellow-800">{t('initializationWizard.review.noticeTitle')}</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p className="mb-2">
                      {t('initializationWizard.review.permanentNotice')}
                    </p>
                    <p>
                      {t('initializationWizard.review.changesNotice')}
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
                  <Calendar className="w-6 h-6 text-primary-600 me-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">{t('initializationWizard.review.startDate')}</p>
                        <p className="text-base font-medium text-gray-900">{setupData.fiscalYearStart}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{t('initializationWizard.review.endDate')}</p>
                        <p className="text-base font-medium text-gray-900">{setupData.fiscalYearEnd}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('initializationWizard.review.periodScheme')}</p>
                      <p className="text-base font-medium text-gray-900">
                        {setupData.periodScheme === 'MONTHLY'
                          ? t('initializationWizard.periodSchemes.monthly')
                          : setupData.periodScheme === 'QUARTERLY'
                            ? t('initializationWizard.periodSchemes.quarterly')
                            : t('initializationWizard.periodSchemes.semiAnnual')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Base Currency */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <DollarSign className="w-6 h-6 text-primary-600 me-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('initializationWizard.steps.baseCurrency')}</h3>
                    {selectedCurrency && (
                      <div>
                        <p className="text-base font-medium text-gray-900">
                          {getLocalizedCurrencyName(selectedCurrency, tCommon)} ({selectedCurrency.code})
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t('initializationWizard.review.symbol', { symbol: selectedCurrency.symbol })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* COA Template */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <BookOpen className="w-6 h-6 text-primary-600 me-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('initializationWizard.review.coaTemplate')}</h3>
                    {selectedTemplate && (
                      <div>
                        <p className="text-base font-medium text-gray-900 mb-1">
                          {getLocalizedCoaTemplateText(selectedTemplate, 'name', tCommon)}
                        </p>
                        <p className="text-sm text-gray-600 mb-3">
                          {getLocalizedCoaTemplateText(selectedTemplate, 'description', tCommon)}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getComplexityBadge(selectedTemplate.complexity).color}`}>
                            {getComplexityBadge(selectedTemplate.complexity).label}
                          </span>
                          <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                            {t('initializationWizard.coa.accountCount', { total: selectedTemplate.accountCount })}
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
                  <FileCheck className="w-6 h-6 text-primary-600 me-3 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('initializationWizard.review.selectedVoucherTypes')}</h3>
                    {setupData.selectedTypeKeys && setupData.selectedTypeKeys.length > 0 ? (
                      <div className="space-y-2">
                        {setupData.selectedTypeKeys.map(typeKey => {
                          const group = voucherTypeGroups.find(g => g.typeKey === typeKey);
                          return group ? (
                            <div key={typeKey} className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-primary-600" />
                              <span className="font-medium">
                                {t(`initializationWizard.voucherTypes.names.${group.typeKey}`, { defaultValue: group.name })}
                              </span>
                              <span className="text-sm text-gray-500">
                                ({t('initializationWizard.voucherTypes.defaultFormCount', { total: group.forms.length })})
                              </span>
                            </div>
                          ) : null;
                        })}
                        <p className="text-sm text-gray-600 mt-3">
                          {t('initializationWizard.review.voucherSummary', {
                            typeCount: setupData.selectedTypeKeys.length,
                            formCount: voucherTypeGroups
                              .filter(g => setupData.selectedTypeKeys?.includes(g.typeKey))
                              .reduce((sum, g) => sum + g.forms.length, 0),
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">{t('initializationWizard.review.noVoucherTypes')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="ms-3">
                  <p className="text-sm text-blue-700">
                    {t('initializationWizard.review.ready')}
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

  // Show loading while checking if module is already initialized
  if (isCheckingInitialization || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="xl" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('initializationWizard.common.loadingWizard')}</p>
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
                <h1 className="text-2xl font-bold">{t('initializationWizard.alreadyConfigured.title')}</h1>
                <p className="text-primary-100 text-sm">{t('initializationWizard.alreadyConfigured.subtitle')}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-primary-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('initializationWizard.alreadyConfigured.heading')}
            </h2>
            
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t('initializationWizard.alreadyConfigured.description')}
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-start max-w-md mx-auto">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                {t('initializationWizard.alreadyConfigured.changesTitle')}
              </h3>
              <p className="text-sm text-blue-700">
                {t('initializationWizard.alreadyConfigured.changesDescription')}
              </p>
            </div>

            <button
              onClick={async () => {
                emitCompanyModulesRefresh({ companyId, moduleCode: 'accounting' });
                await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
                navigate('/accounting', { replace: true });
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600
                       text-white font-semibold rounded-lg hover:from-primary-600 hover:to-primary-700
                       transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {t('initializationWizard.alreadyConfigured.goToModule')}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModuleSetupWizardShell
      steps={steps.map((step) => step.title)}
      currentStep={currentStep}
      error={error}
      submitting={isCompleting}
      backLabel={t('initializationWizard.common.back')}
      nextLabel={t('initializationWizard.common.next')}
      completeLabel={t('initializationWizard.common.completeSetup')}
      submittingLabel={t('initializationWizard.common.completing')}
      onBack={handleBack}
      onNext={handleNext}
      onComplete={handleComplete}
    >
      {currentStepData.content}
    </ModuleSetupWizardShell>
  );
};

export default AccountingInitializationWizard;
